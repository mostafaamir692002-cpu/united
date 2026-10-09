import { Prisma } from "@prisma/client";

/**
 * Unit conversion — exact decimal arithmetic, never JavaScript floats.
 *
 * Only units of the same category convert, through each unit's ratio to the
 * category's reference unit (KG, L, PIECE). Package units (crate, carton, pallet…)
 * have no fixed ratio and are refused here: how many kilos are in a crate depends on
 * the product, so that conversion lives with the product (Phase 2), not in a global
 * table where it would be wrong for every product but one.
 */

export type ConvertibleUnit = {
  code: string;
  category: string;
  ratioToReference: Prisma.Decimal | string | number | null;
  precision: number;
};

export class UomConversionError extends Error {}

export function convertQuantity(
  quantity: Prisma.Decimal | string | number,
  from: ConvertibleUnit,
  to: ConvertibleUnit
): Prisma.Decimal {
  const qty = new Prisma.Decimal(quantity);
  if (from.code === to.code) return qty.toDecimalPlaces(to.precision, Prisma.Decimal.ROUND_HALF_UP);
  if (from.category !== to.category) {
    throw new UomConversionError(`مينفعش تحويل ${from.code} (${from.category}) إلى ${to.code} (${to.category})`);
  }
  if (from.ratioToReference == null || to.ratioToReference == null) {
    throw new UomConversionError(`${from.code} ← ${to.code}: وحدات التعبئة بتتحول حسب الصنف، مش بمعامل ثابت`);
  }
  const fromRatio = new Prisma.Decimal(from.ratioToReference);
  const toRatio = new Prisma.Decimal(to.ratioToReference);
  if (!fromRatio.greaterThan(0) || !toRatio.greaterThan(0)) {
    throw new UomConversionError("معامل التحويل لازم يكون أكبر من صفر");
  }
  return qty.times(fromRatio).dividedBy(toRatio).toDecimalPlaces(to.precision, Prisma.Decimal.ROUND_HALF_UP);
}
