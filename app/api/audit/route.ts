import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireOrderActor } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import type { Permission } from "@/lib/permissions";
import { visibleAuditRows } from "@/lib/security/audit-visibility";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    // The timeline of one order is part of working that order, so anyone who can see
    // orders can see it. The unfiltered log is a separate, higher permission.
    const actor = await requireOrderActor(req, orderId ? "orders.view" : "audit.view");
    const can = (p: Permission) => actor.permissions.includes(p);

    const all = await prisma.auditLog.findMany({
      where: orderId ? { orderId } : undefined,
      orderBy: { timestamp: "desc" },
      take: orderId ? 200 : 100,
      include: { order: { select: { orderNumber: true, customerName: true } } },
    });
    const logs = visibleAuditRows(all, can);

    // Item-level events only store the item id — resolve product names for display.
    const itemIds = [...new Set(logs.filter((l) => l.entityType === "order_item").map((l) => l.entityId))];
    const items = itemIds.length
      ? await prisma.orderItem.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, productName: true, unit: true },
        })
      : [];
    const itemById = new Map(items.map((i) => [i.id, i]));

    return NextResponse.json({
      logs: logs.map((l) => ({
        ...l,
        itemName: l.entityType === "order_item" ? itemById.get(l.entityId)?.productName ?? null : null,
        // A recorded quantity without its unit is not an operational fact.
        itemUnit: l.entityType === "order_item" ? itemById.get(l.entityId)?.unit ?? null : null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
