import { requirePagePermission } from "@/lib/session-guard";
import { AccessDenied } from "@/components/AccessDenied";
import { dailyOperationsSummary } from "@/lib/orders-service";
import { STATUS_LABEL, STATUS_DOT } from "@/lib/orderPresentation";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";
import { PrintBar } from "@/components/print/PrintBar";

const OPEN_ORDER: OrderStatus[] = ["new", "preparing", "ready_for_loading", "loading", "loaded"];

const HEALTH_LABEL: Record<string, string> = {
  healthy: "🟢 التشغيل سليم",
  attention: "🟡 محتاج متابعة",
  critical: "🔴 محتاج تدخل عاجل",
};

export default async function DailyReportPrintPage() {
  const gate = await requirePagePermission("reports.view");
  if (!gate.ok) return <AccessDenied missing={gate.missing} role={gate.user.role} />;
  const data = await dailyOperationsSummary();

  return (
    <main className="min-h-screen bg-white">
      <PrintBar backHref="/supervisor/report" />
      <div className="print-sheet max-w-3xl mx-auto p-6 text-united-dark">
        <div className="flex items-center justify-between border-b-4 border-united-dark pb-4 mb-5">
          <div>
            <div className="font-extrabold text-xl">UNITED — تقرير التشغيل اليومي</div>
            <div className="text-xs text-united-dark/60">Daily Operations Report</div>
          </div>
          <div className="text-sm font-bold" dir="ltr">
            {data.date}
          </div>
        </div>

        <div className="border-2 border-united-dark/20 rounded-lg p-3 mb-5 print-break-inside-avoid">
          <div className="font-extrabold">
            {HEALTH_LABEL[data.health.level] ?? data.health.level}
            {data.health.reasons.length > 0 && (
              <span className="font-normal text-sm text-united-dark/60"> — {data.health.reasons.join(" · ")}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-6 print-break-inside-avoid">
          <div className="border border-united-dark/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-extrabold">{data.ordersReceivedToday}</div>
            <div className="text-xs text-united-dark/60">أوردر وصل النهارده</div>
          </div>
          <div className="border border-united-dark/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-extrabold">{data.dispatchedToday}</div>
            <div className="text-xs text-united-dark/60">اتحرك النهارده</div>
          </div>
          <div className="border border-united-dark/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-extrabold">{data.exceptionsActive}</div>
            <div className="text-xs text-united-dark/60">استثناءات محتاجة تدخل</div>
          </div>
          <div className="border border-united-dark/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-extrabold">{data.completionPct != null ? `${data.completionPct}%` : "—"}</div>
            <div className="text-xs text-united-dark/60">نسبة الإنجاز</div>
          </div>
          <div className="border border-united-dark/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-extrabold">{data.stalledCount}</div>
            <div className="text-xs text-united-dark/60">أوردر متوقف من فترة</div>
          </div>
        </div>

        <h2 className="font-extrabold mb-2 print-break-inside-avoid">الأوردرات الشغالة دلوقتي</h2>
        <table className="w-full text-sm border-collapse mb-6">
          <tbody>
            <tr className="border-b border-united-border">
              {OPEN_ORDER.map((s) => (
                <td key={s} className="p-2 text-center">
                  <div className="font-extrabold text-lg">{data.pipelineNow[s] ?? 0}</div>
                  <div className="text-[11px] text-united-dark/50">
                    {STATUS_DOT[s]} {STATUS_LABEL[s]}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <h2 className="font-extrabold mb-2 print-break-inside-avoid">أوردرات النهارده حسب الحالة</h2>
        <table className="w-full text-sm border-collapse mb-6">
          <tbody>
            <tr className="border-b border-united-border">
              {ORDER_STATUSES.map((s) => (
                <td key={s} className="p-2 text-center">
                  <div className="font-extrabold text-lg">{data.byStatusToday[s] ?? 0}</div>
                  <div className="text-[11px] text-united-dark/50">
                    {STATUS_DOT[s]} {STATUS_LABEL[s]}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <h2 className="font-extrabold mb-2 print-break-inside-avoid">الكميات — أوردرات النهارده</h2>
        <table className="w-full text-sm border-collapse mb-6">
          <tbody>
            <tr className="border-b border-united-border">
              <td className="p-2 text-center">
                <div className="font-extrabold text-lg">{data.quantitiesToday.required}</div>
                <div className="text-[11px] text-united-dark/50">مطلوب</div>
              </td>
              <td className="p-2 text-center">
                <div className="font-extrabold text-lg">{data.quantitiesToday.prepared}</div>
                <div className="text-[11px] text-united-dark/50">اتجهز</div>
              </td>
              <td className="p-2 text-center">
                <div className="font-extrabold text-lg">{data.quantitiesToday.loaded}</div>
                <div className="text-[11px] text-united-dark/50">اتحمل</div>
              </td>
            </tr>
          </tbody>
        </table>

        {data.bottleneck.byStage.length > 0 && (
          <>
            <h2 className="font-extrabold mb-2 print-break-inside-avoid">أين الاختناق دلوقتي</h2>
            <table className="w-full text-sm border-collapse mb-6">
              <thead>
                <tr className="bg-united-dark text-white">
                  <th className="p-2 text-right">المرحلة</th>
                  <th className="p-2 text-center">عدد الأوردرات</th>
                  <th className="p-2 text-center">متوسط الانتظار (دقيقة)</th>
                  <th className="p-2 text-center">أطول انتظار (دقيقة)</th>
                </tr>
              </thead>
              <tbody>
                {data.bottleneck.byStage.map((b) => (
                  <tr
                    key={b.status}
                    className={`border-b border-united-border print-break-inside-avoid ${
                      b.status === data.bottleneck.currentBottleneckStage ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="p-2 text-right font-bold">
                      {STATUS_DOT[b.status]} {STATUS_LABEL[b.status]}
                      {b.status === data.bottleneck.currentBottleneckStage && " ← الاختناق الحالي"}
                    </td>
                    <td className="p-2 text-center">{b.count}</td>
                    <td className="p-2 text-center">{b.avgMinutes}</td>
                    <td className="p-2 text-center">{b.maxMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {data.needsAttention.length > 0 && (
          <>
            <h2 className="font-extrabold mb-2 print-break-inside-avoid">
              محتاج تدخل ({data.needsAttentionTotal})
            </h2>
            <table className="w-full text-sm border-collapse mb-6">
              <thead>
                <tr className="bg-united-dark text-white">
                  <th className="p-2 text-right">الأوردر</th>
                  <th className="p-2 text-right">السبب</th>
                  <th className="p-2 text-right">الإجراء المقترح</th>
                  <th className="p-2 text-center">من (دقيقة)</th>
                </tr>
              </thead>
              <tbody>
                {data.needsAttention.map((n) => (
                  <tr key={n.id} className="border-b border-united-border print-break-inside-avoid">
                    <td className="p-2 text-right font-bold">
                      {n.customerName} ({n.orderNumber})
                    </td>
                    <td className="p-2 text-right">{n.reasonLabel}</td>
                    <td className="p-2 text-right">{n.recommendedAction}</td>
                    <td className="p-2 text-center">{n.minutesInStage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {data.exceptionsInformational > 0 && (
          <p className="text-sm text-united-dark/60 mb-6 print-break-inside-avoid">
            + {data.exceptionsInformational} أوردر فيه فرق معتمد بالفعل (مش محتاج تدخل).
          </p>
        )}

        <div className="grid grid-cols-2 gap-6 mt-10 text-sm print-break-inside-avoid">
          <div>
            <div className="border-b border-united-dark h-14" />
            <div className="text-united-dark/60 mt-1">توقيع المشرف</div>
          </div>
          <div>
            <div className="border-b border-united-dark h-14" />
            <div className="text-united-dark/60 mt-1">التاريخ / الوقت</div>
          </div>
        </div>

        <p className="text-[10px] text-united-dark/30 mt-8">اتطبع {new Date().toLocaleString("ar-EG")}</p>
      </div>
    </main>
  );
}
