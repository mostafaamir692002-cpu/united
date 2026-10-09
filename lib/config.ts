// The shortage rules themselves. The tolerance is a business setting
// ("orders.shortage_review_threshold_pct", default 5%) — see lib/core/settings-registry.ts —
// so it is passed in rather than read from a constant here.

/** True when less was prepared/loaded than required. */
export function isShortage(required: number, actual: number | null | undefined) {
  if (actual == null) return false;
  return actual < required;
}

/** True when prepared/loaded differs from required — over OR under — by more than the
 * tolerance. Such an order is held until someone with orders.approve signs it off. */
export function needsSupervisorReview(
  required: number,
  actual: number | null | undefined,
  thresholdPct: number
) {
  if (actual == null || required === 0) return false;
  const diffPct = (Math.abs(required - actual) / required) * 100;
  return diffPct > thresholdPct;
}
