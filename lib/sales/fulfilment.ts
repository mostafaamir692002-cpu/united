import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/rbac";
import type { Tx } from "@/lib/tx";
import type { ServiceActor } from "@/lib/core/actor";
import { productAvailability } from "@/lib/inventory/balances";
import { lockAvailability } from "@/lib/inventory/picking";
import { resolveWarehouse } from "@/lib/inventory/context";
import { toBaseQuantity } from "@/lib/inventory/packaging";
import { releaseReservationInTx, reserveInTx } from "@/lib/inventory/reservations";

/**
 * Keeps an order's stock reservations in step with its lines (when the
 * sales.auto_reserve policy is on).
 *
 * Each mapped, stock-tracked line holds one reservation for its required quantity in
 * the product's base unit — as much of it as is available. Reserving is best-effort:
 * an order is never refused for lack of stock (that is the dispatch policy's call);
 * it simply holds what there is, so the same kilo is not promised twice. A line whose
 * quantity changed has its reservation released and taken again.
 */
export async function syncOrderReservations(tx: Tx, orderId: string, actor: ServiceActor) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { include: { stockProduct: true }, orderBy: { id: "asc" } } } });
  if (!order || order.status === "cancelled" || order.status === "dispatched") return { reserved: 0 };
  const warehouse = await resolveWarehouse(tx, undefined);
  const lines: { itemId: string; productId: string; target: Prisma.Decimal }[] = [];
  for (const item of order.items) {
    const p = item.stockProduct;
    if (!p || !p.stockTracked) continue;
    try {
      lines.push({ itemId: item.id, productId: p.id, target: await toBaseQuantity(tx, p, new Prisma.Decimal(item.requiredQuantity).toDecimalPlaces(3), item.unit) });
    } catch (err) {
      if (err instanceof ApiError) continue; // a unit that does not convert is not reserved
      throw err;
    }
  }
  // Availability locks first, in one global order (as every other stock path).
  for (const id of [...new Set(lines.map((l) => l.productId))].sort()) await lockAvailability(tx, id, warehouse.id);
  let reserved = 0;
  for (const l of lines) {
    const current = await tx.stockReservation.findFirst({ where: { sourceType: "order", sourceId: orderId, sourceLineId: l.itemId, status: "active" } });
    if (current && current.quantity.equals(l.target)) continue;
    if (current) await releaseReservationInTx(tx, current, "تعديل كمية السطر", actor);
    const { available } = await productAvailability(tx, l.productId, warehouse.id);
    const qty = Prisma.Decimal.min(available, l.target);
    if (!qty.gt(0)) continue;
    await reserveInTx(tx, { productId: l.productId, warehouseId: warehouse.id, quantity: qty, sourceType: "order", sourceId: orderId, sourceLineId: l.itemId }, actor);
    reserved++;
  }
  return { reserved };
}
