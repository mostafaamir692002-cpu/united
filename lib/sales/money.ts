import { Prisma } from "@prisma/client";

/**
 * Line arithmetic for sales documents, in Decimal — never floats. Pure, so the same
 * function prices an order line, a quotation line and an invoice line, and is unit
 * tested on its own.
 *
 *   gross    = quantity × unit price                       (rounded to 2 dp)
 *   discount = gross × discount% / 100                     (rounded to 2 dp)
 *   net      = gross − discount
 *   tax      = net × tax rate% / 100                       (rounded to 2 dp)
 *   total    = net + tax
 *
 * Rounding is per line, half-up, to the currency's minor unit — what the Egyptian
 * e-invoice expects (it validates line totals, then sums them).
 */

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const r2 = (v: Prisma.Decimal) => v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export type LineInput = { quantity: Prisma.Decimal.Value; unitPrice: Prisma.Decimal.Value; discountPct?: Prisma.Decimal.Value; taxRate?: Prisma.Decimal.Value };
export type LineAmounts = { gross: Prisma.Decimal; discount: Prisma.Decimal; net: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal };

export function lineAmounts(l: LineInput): LineAmounts {
  const gross = r2(D(l.quantity).times(D(l.unitPrice)));
  const discount = r2(gross.times(D(l.discountPct ?? 0)).dividedBy(100));
  const net = gross.minus(discount);
  const tax = r2(net.times(D(l.taxRate ?? 0)).dividedBy(100));
  return { gross, discount, net, tax, total: net.plus(tax) };
}

export function sumAmounts(lines: LineAmounts[]): LineAmounts {
  const z = D(0);
  return lines.reduce(
    (a, l) => ({ gross: a.gross.plus(l.gross), discount: a.discount.plus(l.discount), net: a.net.plus(l.net), tax: a.tax.plus(l.tax), total: a.total.plus(l.total) }),
    { gross: z, discount: z, net: z, tax: z, total: z }
  );
}

/** Amounts as strings for JSON (exact; the client never does arithmetic on them). */
export function amountsJSON(a: LineAmounts) {
  return { gross: a.gross.toFixed(2), discount: a.discount.toFixed(2), net: a.net.toFixed(2), tax: a.tax.toFixed(2), total: a.total.toFixed(2) };
}
