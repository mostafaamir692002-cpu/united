import type { OperationalHealthDTO } from "@/lib/client-types";

const LEVEL_STYLE: Record<OperationalHealthDTO["level"], string> = {
  healthy: "bg-united-green/10 border-united-green/30 text-united-dark",
  attention: "bg-amber-50 border-united-warn/40 text-united-dark",
  critical: "bg-red-50 border-united-danger/40 text-united-dark",
};

const LEVEL_LABEL: Record<OperationalHealthDTO["level"], string> = {
  healthy: "🟢 التشغيل سليم",
  attention: "🟡 محتاج متابعة",
  critical: "🔴 محتاج تدخل عاجل",
};

/** A rule-based (never a decorative score) read on "is the operation healthy
 * right now" — every word here maps to a real, visible count. */
export function OperationalHealthBanner({ health }: { health: OperationalHealthDTO }) {
  const { level, reasons, counts } = health;
  return (
    <div className={`card p-4 border-2 ${LEVEL_STYLE[level]}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-extrabold text-lg">{LEVEL_LABEL[level]}</span>
        {reasons.length > 0 && (
          <span className="text-sm font-bold text-united-dark/70">{reasons.join(" · ")}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-bold text-united-dark/60">
        <span>{counts.activeOrders} أوردر شغال</span>
        <span>{counts.readyLoadingBacklog} جاهز/بيتحمّل</span>
        <span>{counts.blockedApprovals} محتاج اعتماد</span>
        <span>{counts.stalledOrders} متوقف</span>
        <span>{counts.deliveryRisk} قريب/متأخر عن الميعاد</span>
      </div>
    </div>
  );
}
