import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/rbac";

/**
 * Exact decimal arithmetic for quantities and money. Inventory never does float
 * arithmetic: values arrive as numbers or strings, become Decimals here, and leave as
 * strings (or, on the legacy stock API only, as numbers for the screens built on it).
 */
export const Dec = Prisma.Decimal;
export type Dec = Prisma.Decimal;

export const ZERO = new Prisma.Decimal(0);

export function D(v: Prisma.Decimal.Value | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(v ?? 0);
}

/** Parses a user-supplied quantity. Refuses NaN, infinities and over-precise input
 * rather than rounding it silently. */
export function parseQty(
  raw: unknown,
  label: string,
  opts: { allowZero?: boolean; allowNegative?: boolean; dp?: number } = {}
): Prisma.Decimal {
  const dp = opts.dp ?? 3;
  if (raw === null || raw === undefined || raw === "") throw new ApiError(400, `${label} مطلوب`);
  if (typeof raw !== "number" && typeof raw !== "string") throw new ApiError(400, `${label} لازم يكون رقم`);
  let d: Prisma.Decimal;
  try {
    d = new Prisma.Decimal(typeof raw === "string" ? raw.trim() : raw);
  } catch {
    throw new ApiError(400, `${label} لازم يكون رقم`);
  }
  if (!d.isFinite()) throw new ApiError(400, `${label} لازم يكون رقم`);
  if (!opts.allowNegative && d.lt(0)) throw new ApiError(400, `${label} مينفعش يكون بالسالب`);
  if (!opts.allowZero && d.isZero()) throw new ApiError(400, `${label} لازم يكون أكبر من صفر`);
  if (d.decimalPlaces() > dp) throw new ApiError(400, `${label}: أقصى عدد خانات عشرية ${dp}`);
  if (d.abs().greaterThan("1e12")) throw new ApiError(400, `${label} كبير أوي`);
  return d;
}

export function parseMoney(raw: unknown, label: string): Prisma.Decimal | null {
  if (raw === null || raw === undefined || raw === "") return null;
  return parseQty(raw, label, { allowZero: true, dp: 4 });
}

/** For the legacy stock API's numeric fields only. Exact for 3-dp quantities. */
export function num(v: Prisma.Decimal | null | undefined): number {
  return v == null ? 0 : Number(v.toFixed(3));
}

export const q3 = (d: Prisma.Decimal) => d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
export const q4 = (d: Prisma.Decimal) => d.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
