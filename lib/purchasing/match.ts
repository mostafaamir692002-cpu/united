import { Prisma } from "@prisma/client";

/**
 * Three-way match of a supplier bill: each line's billed net (before tax) against what
 * the received GOOD quantity is worth at the AGREED price. Lines are judged one by one
 * — an over-charge on one line cannot hide behind an under-charge on another — and the
 * bill takes the worst verdict. A line with nothing agreed cannot be matched at all.
 */

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

export type MatchLine = { net: Prisma.Decimal; expectedNet: Prisma.Decimal | null };
export type MatchStatus = "matched" | "within_tolerance" | "variance" | "unpriced";

export function matchBill(lines: MatchLine[], tolerancePct: number) {
  const rank: Record<MatchStatus, number> = { matched: 0, within_tolerance: 1, variance: 2, unpriced: 3 };
  let worst: MatchStatus = "matched";
  let expected = D(0);
  let pricedNet = D(0);
  for (const l of lines) {
    let s: MatchStatus;
    if (l.expectedNet == null) s = "unpriced";
    else {
      expected = expected.plus(l.expectedNet);
      pricedNet = pricedNet.plus(l.net);
      const diff = D(l.net).minus(l.expectedNet).abs();
      s = diff.isZero() ? "matched" : diff.lessThanOrEqualTo(D(l.expectedNet).times(tolerancePct).dividedBy(100)) ? "within_tolerance" : "variance";
    }
    if (rank[s] > rank[worst]) worst = s;
  }
  // Over the lines that could be compared; an unpriced line has no variance to speak of.
  return { status: worst, expectedNet: expected, variance: pricedNet.minus(expected), needsApproval: worst === "variance" || worst === "unpriced" };
}

