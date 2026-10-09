import type { StockIssueException } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { assertPermission } from "@/lib/authz-core";
import { inTx, type Tx } from "@/lib/tx";
import { notify } from "@/lib/core/notifications";
import type { ServiceActor } from "@/lib/core/actor";
import { D, ZERO, type Dec } from "@/lib/inventory/decimal";
import { productAvailability } from "@/lib/inventory/balances";
import { lockAvailability } from "@/lib/inventory/picking";
import { resolveWarehouse } from "@/lib/inventory/context";
import { toBaseQuantity } from "@/lib/inventory/packaging";
import { issueStock, releaseAllForSource } from "@/lib/inventory/reservations";
import { reverseDocumentInTx } from "@/lib/inventory/documents";

/**
 * Order dispatch ↔ stock ledger.
 *
 * When an order leaves on a truck, what it carried leaves the books: one "issue"
 * document per dispatch, FEFO/FIFO-picked, consuming the order's own reservations.
 * The quantity issued per line is what was physically confirmed last — loaded, else
 * prepared, else required.
 *
 * A line the ledger cannot issue in full does not silently vanish:
 *   - the line names no known product (unmapped),
 *   - its unit has no conversion to the product's base unit (unit_mismatch),
 *   - the books hold less than what left (insufficient),
 * each becomes a StockIssueException for a stock controller to explain. Under the
 * "lenient" policy (default) dispatch proceeds — the goods are on the truck and the
 * books must not refuse reality — and what WAS on the books is issued. Under "strict",
 * a tracked product without enough stock blocks the dispatch instead. Products that
 * are not stock-tracked (services, packaging) are not issued and not exceptions.
 *
 * Stock never goes negative either way: the ledger's bucket constraint holds.
 */

export type DispatchPolicy = "lenient" | "strict";

type PlannedLine = { itemId: string; productId: string; productName: string; unit: string; requested: Dec; issue: Dec };
type Shortfall = { itemId: string; productId: string | null; productName: string; unit: string; requested: Dec; issued: Dec; reason: "unmapped" | "unit_mismatch" | "insufficient" };

const REASON_LABEL: Record<Shortfall["reason"], string> = {
  unmapped: "الصنف مش متربط بدليل الأصناف",
  unit_mismatch: "وحدة السطر مش بتتحول لوحدة الصنف",
  insufficient: "الرصيد المسجل أقل من اللي خرج",
};

function lineQuantity(i: { loadedQuantity: number | null; preparedQuantity: number | null; requiredQuantity: number }): Dec {
  const raw = i.loadedQuantity ?? i.preparedQuantity ?? i.requiredQuantity;
  return D(raw).toDecimalPlaces(3);
}

export async function issueForDispatch(tx: Tx, orderId: string, policy: DispatchPolicy, actor: ServiceActor) {
  // One live issue per dispatch. A reopened order had its issue reversed, so a
  // re-dispatch issues afresh; a second call for the same dispatch is a no-op.
  // (A reversal is itself a posted "issue" document for the same order; it is not
  // a live issue.)
  const live = await tx.inventoryDocument.findFirst({ where: { type: "issue", status: "posted", reversalOfId: null, sourceType: "order", sourceId: orderId } });
  if (live) return { document: live, exceptions: [] as StockIssueException[] };

  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { stockProduct: true }, orderBy: { id: "asc" } } },
  });
  const warehouse = await resolveWarehouse(tx, undefined);

  const planned: PlannedLine[] = [];
  const shortfalls: Shortfall[] = [];
  for (const item of order.items) {
    const requested = lineQuantity(item);
    if (!requested.gt(0)) continue;
    const product = item.stockProduct;
    if (!product) {
      shortfalls.push({ itemId: item.id, productId: null, productName: item.productName, unit: item.unit, requested, issued: ZERO, reason: "unmapped" });
      continue;
    }
    if (!product.stockTracked) continue;
    let base: Dec;
    try {
      base = await toBaseQuantity(tx, product, requested, item.unit);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      shortfalls.push({ itemId: item.id, productId: product.id, productName: product.name, unit: item.unit, requested, issued: ZERO, reason: "unit_mismatch" });
      continue;
    }
    planned.push({ itemId: item.id, productId: product.id, productName: product.name, unit: product.unit, requested: base, issue: base });
  }

  // Availability locks for every product up front, in one global order, so two
  // dispatches sharing products cannot deadlock (and nothing can reserve or remove
  // between measuring what is issuable and issuing it).
  const productIds = [...new Set(planned.map((p) => p.productId))].sort();
  for (const id of productIds) await lockAvailability(tx, id, warehouse.id);

  // What this order may take of each product: what is available to anyone, plus
  // what is already reserved for this very order. Shared across the order's lines.
  const issuable = new Map<string, Dec>();
  for (const id of productIds) {
    const { available, sellableOnHand } = await productAvailability(tx, id, warehouse.id);
    const own = await tx.stockReservation.aggregate({
      where: { productId: id, warehouseId: warehouse.id, sourceType: "order", sourceId: orderId, status: "active" },
      _sum: { quantity: true },
    });
    const free = Prisma.Decimal.min(available.plus(D(own._sum.quantity)), sellableOnHand);
    issuable.set(id, free.gt(0) ? free : ZERO);
  }
  for (const line of planned) {
    const left = issuable.get(line.productId)!;
    if (left.lessThan(line.requested)) {
      line.issue = left;
      shortfalls.push({ itemId: line.itemId, productId: line.productId, productName: line.productName, unit: line.unit, requested: line.requested, issued: left, reason: "insufficient" });
    }
    issuable.set(line.productId, left.minus(line.issue));
  }

  if (policy === "strict") {
    const blocking = shortfalls.filter((s) => s.reason === "insufficient");
    if (blocking.length) {
      throw new ApiError(
        409,
        `الرصيد مش كفاية لخروج الأوردر: ${blocking.map((s) => `${s.productName} (موجود ${s.issued.toFixed()} من ${s.requested.toFixed()} ${s.unit})`).join("، ")}`
      );
    }
  }

  const toIssue = planned.filter((l) => l.issue.gt(0));
  const issued = toIssue.length
    ? await issueStock(
        tx,
        {
          warehouseId: warehouse.id,
          sourceType: "order",
          sourceId: orderId,
          reference: `أوردر ${order.orderNumber ?? order.id} · ${order.customerName}`,
          lines: toIssue.map((l) => ({ productId: l.productId, quantity: l.issue, sourceLineId: l.itemId })),
        },
        actor
      )
    : null;

  // Anything still promised to this order is moot once it has left.
  await releaseAllForSource(tx, "order", orderId, "الأوردر خرج", actor);

  const exceptions: StockIssueException[] = [];
  for (const s of shortfalls) {
    const ex = await tx.stockIssueException.create({
      data: {
        orderId,
        orderItemId: s.itemId,
        documentId: issued?.document.id ?? null,
        productId: s.productId,
        productName: s.productName,
        unit: s.unit,
        requestedQty: s.requested,
        issuedQty: s.issued,
        reason: s.reason,
      },
    });
    exceptions.push(ex);
    await writeAudit(
      {
        userId: actor.id,
        userName: actor.name,
        role: actor.role,
        action: "stock_issue_exception_raised",
        entityType: "stock_issue_exception",
        entityId: ex.id,
        orderId,
        fieldChanged: s.reason,
        newValue: `${s.productName}: خرج ${s.requested.toFixed()} ${s.unit}، اتصرف من الدفاتر ${s.issued.toFixed()}`,
        source: "system",
        deviceId: actor.deviceId,
      },
      tx
    );
  }
  if (exceptions.length) {
    await notify(
      tx,
      { permission: "stock.adjust" },
      {
        type: "stock.issue_exception",
        severity: "warning",
        title: `أوردر ${order.orderNumber ?? ""} خرج و${exceptions.length === 1 ? "سطر" : `${exceptions.length} سطور`} مااتصرفوش بالكامل من المخزون`,
        body: shortfalls.map((s) => `${s.productName}: ${REASON_LABEL[s.reason]}`).join(" · "),
        entityType: "order",
        entityId: orderId,
        link: "/stock/inventory?tab=exceptions",
        dedupeKey: `issue-exception:${orderId}:${issued?.document.id ?? "none"}`,
      }
    );
  }
  return { document: issued?.document ?? null, exceptions };
}

/**
 * A dispatched order is being taken back (reopen or a supervisor override out of
 * "dispatched"): its stock issue is reversed at the cost it left at, and its open
 * exceptions are voided — they described a dispatch that is no longer the record.
 */
export async function reverseDispatchIssue(tx: Tx, orderId: string, reason: string, actor: ServiceActor) {
  const docs = await tx.inventoryDocument.findMany({ where: { type: "issue", status: "posted", reversalOfId: null, sourceType: "order", sourceId: orderId } });
  for (const d of docs) await reverseDocumentInTx(tx, d.id, `الأوردر اتفتح تاني: ${reason}`, actor);
  const open = await tx.stockIssueException.findMany({ where: { orderId, status: "open" } });
  for (const ex of open) {
    await tx.stockIssueException.update({
      where: { id: ex.id, version: ex.version },
      data: { status: "voided", resolution: `الأوردر اتفتح تاني: ${reason}`, resolvedById: actor.id, resolvedBy: actor.name, resolvedAt: new Date(), version: { increment: 1 } },
    });
    await writeAudit(
      {
        userId: actor.id,
        userName: actor.name,
        role: actor.role,
        action: "stock_issue_exception_voided",
        entityType: "stock_issue_exception",
        entityId: ex.id,
        orderId,
        reason,
        source: "system",
        deviceId: actor.deviceId,
      },
      tx
    );
  }
  return { reversed: docs.length, voided: open.length };
}

export async function listIssueExceptions(filters: { status?: string; orderId?: string }) {
  return prisma.stockIssueException.findMany({
    where: { status: filters.status ?? "open", ...(filters.orderId ? { orderId: filters.orderId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { order: { select: { orderNumber: true, customerName: true, deliveryDate: true } }, document: { select: { number: true } } },
  });
}

/** A stock controller explains a shortfall (late intake recorded, count corrected, …). */
export async function resolveIssueException(id: string, input: Record<string, unknown>, actor: ServiceActor) {
  assertPermission(actor, "stock.adjust");
  const resolution = typeof input.resolution === "string" ? input.resolution.trim() : "";
  if (!resolution) throw new ApiError(400, "اكتب إزاي اتحل الاستثناء ده");
  return inTx(async (tx) => {
    const ex = await tx.stockIssueException.findUnique({ where: { id } });
    if (!ex) throw new ApiError(404, "الاستثناء مش موجود");
    if (ex.status !== "open") throw new ApiError(409, "الاستثناء ده مقفول بالفعل");
    if (input.expected_version !== undefined && input.expected_version !== ex.version) throw new ApiError(409, "الاستثناء اتغيّر، حدّث الشاشة");
    let updated: StockIssueException;
    try {
      updated = await tx.stockIssueException.update({
        where: { id, version: ex.version, status: "open" },
        data: { status: "resolved", resolution, resolvedById: actor.id, resolvedBy: actor.name, resolvedAt: new Date(), version: { increment: 1 } },
      });
    } catch (err) {
      if ((err as { code?: string })?.code === "P2025") throw new ApiError(409, "الاستثناء اتغيّر، حدّث الشاشة");
      throw err;
    }
    await writeAudit(
      {
        userId: actor.id,
        userName: actor.name,
        role: actor.role,
        action: "stock_issue_exception_resolved",
        entityType: "stock_issue_exception",
        entityId: id,
        orderId: ex.orderId,
        newValue: resolution,
        source: "user",
        deviceId: actor.deviceId,
      },
      tx
    );
    return updated;
  });
}
