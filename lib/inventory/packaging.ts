import { ApiError } from "@/lib/rbac";
import type { Tx } from "@/lib/tx";
import { convertQuantity, UomConversionError } from "@/lib/core/uom";
import { D, type Dec } from "@/lib/inventory/decimal";

type Db = Pick<Tx, "unitOfMeasure" | "productPackaging">;

/**
 * Converts a quantity someone counted (40 CRATE, 2 TON) into the product's base unit.
 * Same-category units convert through the global ratio; package units only through
 * THIS product's packaging. The result must be exact in the base unit's precision —
 * 2.5 crates of eggs is not a whole number of pieces, and is refused, not rounded.
 */
export async function toBaseQuantity(
  db: Db,
  product: { id: string; name: string; unit: string },
  qty: Dec,
  uomCode: string
): Promise<Dec> {
  if (uomCode === product.unit) return qty;
  const [from, base] = await Promise.all([
    db.unitOfMeasure.findUnique({ where: { code: uomCode } }),
    db.unitOfMeasure.findUnique({ where: { code: product.unit } }),
  ]);
  if (!from || !from.active) throw new ApiError(400, `الوحدة ${uomCode} مش معروفة`);
  const precision = base?.precision ?? 3;
  let out: Dec;
  if (base && from.category === base.category && from.category !== "package") {
    try {
      out = convertQuantity(qty, from, { ...base, precision: 9 });
    } catch (err) {
      if (err instanceof UomConversionError) throw new ApiError(400, err.message);
      throw err;
    }
  } else {
    const pack = await db.productPackaging.findUnique({ where: { productId_uomCode: { productId: product.id, uomCode } } });
    if (!pack || !pack.active) {
      throw new ApiError(400, `مفيش تعبئة ${uomCode} متعرّفة للصنف "${product.name}" — عرّفها من دليل الأصناف`);
    }
    out = qty.times(D(pack.qtyInBaseUnit));
  }
  const rounded = out.toDecimalPlaces(precision);
  if (!rounded.equals(out)) {
    throw new ApiError(400, `${qty.toFixed()} ${uomCode} = ${out.toFixed()} ${product.unit} — مش رقم صحيح بدقة الوحدة (${precision} خانات)`);
  }
  return rounded;
}
