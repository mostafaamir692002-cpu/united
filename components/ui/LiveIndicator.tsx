"use client";

import { useEffect, useState } from "react";

function relativeTime(ms: number) {
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 3) return "دلوقتي";
  if (secs < 60) return `من ${secs} ثانية`;
  const mins = Math.round(secs / 60);
  return `من ${mins} دقيقة`;
}

/** Small "this is live" cue — a pulsing dot plus a relative last-updated time that
 * ticks on its own, so the operator trusts the screen without a manual refresh. */
export function LiveIndicator({
  dataUpdatedAt,
  isLoading,
}: {
  dataUpdatedAt?: number;
  isLoading?: boolean;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  if (isLoading || !dataUpdatedAt) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-united-muted">
      <span className="live-dot" />
      تحديث لحظي · آخر تحديث {relativeTime(dataUpdatedAt)}
    </div>
  );
}
