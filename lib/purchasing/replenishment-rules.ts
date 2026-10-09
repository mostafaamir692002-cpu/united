import { Prisma } from "@prisma/client";

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

/** Quantity to replenish to max (or to the trigger point if no max is configured). */
export function suggestedReplenishment(available: Prisma.Decimal.Value, reorderPoint: Prisma.Decimal.Value | null, maxStock: Prisma.Decimal.Value | null) {
  if (reorderPoint == null) return null;
  const current = D(available);
  const trigger = D(reorderPoint);
  if (current.greaterThanOrEqualTo(trigger)) return null;
  const target = maxStock == null ? trigger : D(maxStock);
  if (target.lessThan(trigger)) return null; // invalid legacy setup: ask the user to correct it
  return target.minus(current);
}
