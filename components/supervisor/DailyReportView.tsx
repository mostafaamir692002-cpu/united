"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { DailyReportDTO } from "@/lib/client-types";
import { LoadingState, ErrorState } from "@/components/States";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { STATUS_LABEL, STATUS_DOT } from "@/lib/orderPresentation";
import { qty } from "@/lib/format";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";
import { OperationalHealthBanner } from "./OperationalHealthBanner";
import { NeedsAttentionQueue } from "./NeedsAttentionQueue";

const OPEN_ORDER: OrderStatus[] = ["new", "preparing", "ready_for_loading", "loading", "loaded"];

export function DailyReportView() {
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["report", "daily"],
    queryFn: () => apiFetch<DailyReportDTO>("/api/reports/daily"),
    refetchInterval: 8000,
  });

  return (
    <div className="p-4 max-w-3xl mx-auto pb-10">
      <Link href="/supervisor" className="inline-flex items-center gap-1 text-united-muted font-bold mb-3">
        <span>→</span> رجوع لمركز التحكم
      </Link>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-extrabold text-united-dark">تقرير التشغيل اليومي</h1>
        <LiveIndicator dataUpdatedAt={dataUpdatedAt} isLoading={isLoading} />
      </div>
      {data && <p className="text-united-muted font-bold mb-4">{data.date}</p>}

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="no-print flex justify-end mb-3">
            <a
              href="/supervisor/report/print"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm px-4 py-2"
            >
              🖨️ طباعة التقرير
            </a>
          </div>

          <div className="mb-5">
            <OperationalHealthBanner health={data.health} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="card p-4 text-center">
              <div className="text-3xl font-extrabold text-united-dark">{data.ordersReceivedToday}</div>
              <div className="text-xs font-bold text-united-muted mt-1">أوردر وصل النهارده</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-extrabold text-united-green">{data.dispatchedToday}</div>
              <div className="text-xs font-bold text-united-muted mt-1">اتحرك النهارده</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-extrabold text-united-danger">{data.exceptionsActive}</div>
              <div className="text-xs font-bold text-united-muted mt-1">استثناءات محتاجة تدخل</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-extrabold text-united-dark">
                {data.completionPct != null ? `${data.completionPct}%` : "—"}
              </div>
              <div className="text-xs font-bold text-united-muted mt-1">نسبة إنجاز أوردرات النهارده</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-extrabold text-united-warn">{data.stalledCount}</div>
              <div className="text-xs font-bold text-united-muted mt-1">أوردر متوقف من فترة (bottleneck)</div>
            </div>
          </div>

          <div className="card p-5 mb-4">
            <h2 className="font-extrabold text-united-dark mb-3">الأوردرات الشغالة دلوقتي (كل الأيام)</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {OPEN_ORDER.map((s) => (
                <div key={s} className="border border-united-border rounded-lg p-2 text-center">
                  <div className="text-xl font-extrabold text-united-dark">{data.pipelineNow[s] ?? 0}</div>
                  <div className="text-xs font-bold text-united-muted flex items-center justify-center gap-1">
                    <span>{STATUS_DOT[s]}</span> {STATUS_LABEL[s]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {data.bottleneck.byStage.length > 0 && (
            <div className="card p-5 mb-4">
              <h2 className="font-extrabold text-united-dark mb-1">أين الاختناق دلوقتي</h2>
              <p className="text-xs text-united-muted mb-3">
                محسوب من وقت دخول كل أوردر مرحلته الحالية فعليًا (مش وقت آخر تعديل).
              </p>
              <div className="flex flex-col gap-2">
                {data.bottleneck.byStage.map((b) => (
                  <div
                    key={b.status}
                    className={`flex items-center justify-between rounded-lg border p-2 ${
                      b.status === data.bottleneck.currentBottleneckStage
                        ? "border-united-warn/40 bg-amber-50/50"
                        : "border-united-border"
                    }`}
                  >
                    <span className="font-bold text-united-dark flex items-center gap-1.5">
                      <span>{STATUS_DOT[b.status]}</span>
                      {STATUS_LABEL[b.status]}
                      {b.status === data.bottleneck.currentBottleneckStage && (
                        <span className="text-xs font-bold text-united-warn">← الاختناق الحالي</span>
                      )}
                    </span>
                    <span className="text-sm text-united-muted font-bold">
                      <span dir="ltr">{b.count}</span> أوردر · متوسط <span dir="ltr">{b.avgMinutes}</span> دقيقة · أطول{" "}
                      <span dir="ltr">{b.maxMinutes}</span> دقيقة
                    </span>
                  </div>
                ))}
              </div>
              {data.bottleneck.mostStalledOrder && (
                <Link
                  href={`/orders/${data.bottleneck.mostStalledOrder.id}`}
                  className="text-sm font-bold text-united-green mt-3 inline-block"
                >
                  ⏸️ أكتر أوردر واقف: {data.bottleneck.mostStalledOrder.customerName} (
                  {data.bottleneck.mostStalledOrder.orderNumber}) —{" "}
                  <span dir="ltr">{data.bottleneck.mostStalledOrder.minutesInStage}</span> دقيقة ←
                </Link>
              )}
            </div>
          )}

          <div className="mb-4">
            <NeedsAttentionQueue items={data.needsAttention} />
            {data.needsAttentionTotal > data.needsAttention.length && (
              <p className="text-xs text-united-muted mt-2">
                + {data.needsAttentionTotal - data.needsAttention.length} أوردر تاني محتاج تدخل —{" "}
                <Link href="/supervisor" className="text-united-green font-bold">
                  شوفهم كلهم في مركز التحكم
                </Link>
              </p>
            )}
          </div>

          <div className="card p-5 mb-4">
            <h2 className="font-extrabold text-united-dark mb-3">أوردرات النهارده حسب الحالة</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {ORDER_STATUSES.map((s) => (
                <div key={s} className="border border-united-border rounded-lg p-2 text-center">
                  <div className="text-xl font-extrabold text-united-dark">{data.byStatusToday[s] ?? 0}</div>
                  <div className="text-xs font-bold text-united-muted flex items-center justify-center gap-1">
                    <span>{STATUS_DOT[s]}</span> {STATUS_LABEL[s]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5 mb-4">
            <h2 className="font-extrabold text-united-dark mb-3">الكميات — أوردرات النهارده</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div dir="ltr" className="text-2xl font-extrabold text-united-dark">{qty(data.quantitiesToday.required)}</div>
                <div className="text-xs font-bold text-united-muted">مطلوب</div>
              </div>
              <div className="text-center">
                <div dir="ltr" className="text-2xl font-extrabold text-united-dark">{qty(data.quantitiesToday.prepared)}</div>
                <div className="text-xs font-bold text-united-muted">اتجهز</div>
              </div>
              <div className="text-center">
                <div dir="ltr" className="text-2xl font-extrabold text-united-dark">{qty(data.quantitiesToday.loaded)}</div>
                <div className="text-xs font-bold text-united-muted">اتحمل</div>
              </div>
            </div>
            <p className="text-[11px] text-united-dark/40 mt-2">
              الأرقام دي مجمّعة من كل الوحدات (KG/PC/...) مع بعض — للتفاصيل بالوحدة شوف صفحة إنتاج النهارده.
            </p>
          </div>

          {data.exceptionsInformational > 0 && (
            <p className="text-sm text-united-muted mb-2">
              + {data.exceptionsInformational} أوردر فيه فرق معتمد بالفعل (مش محتاج تدخل) —{" "}
              <Link href="/supervisor/exceptions" className="text-united-green font-bold">
                شوفهم في مركز الاستثناءات
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
