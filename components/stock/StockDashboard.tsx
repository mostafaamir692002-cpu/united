"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { LoadingState, EmptyState, ErrorState } from "@/components/States";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { StatTile } from "@/components/stock/StatTile";
import { YieldMeter } from "@/components/stock/YieldMeter";
import { QuickIntakeForm } from "@/components/stock/QuickIntakeForm";
import { MovementRow } from "@/components/stock/MovementRow";
import { todayLocalISO } from "@/lib/localDate";
import { fmtKg, fmtYield, YIELD_TONE_CLASS, yieldTone } from "@/lib/stockPresentation";
import type { StockDashboardDTO } from "@/lib/stock-client-types";

export function StockDashboard() {
  // The tablet's own calendar day, not the server's — a shift that starts before
  // midnight UTC must still file its receipts under the day the operator is living in.
  const today = todayLocalISO();

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["stock", "dashboard", today],
    queryFn: () => apiFetch<StockDashboardDTO>(`/api/stock/dashboard?date=${today}`),
    refetchInterval: 15_000,
  });

  return (
    <div className="p-4 max-w-3xl mx-auto pb-10 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-united-dark">مخزون النهارده</h1>
        <LiveIndicator dataUpdatedAt={dataUpdatedAt} isLoading={isLoading} />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {[
          { href: "/stock/entries", label: "الاستلامات" },
          { href: "/stock/ledger", label: "سجل الحركات" },
          { href: "/stock/setup", label: "الموردين والأصناف" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-4 py-2 rounded-full text-sm font-extrabold whitespace-nowrap shrink-0 bg-united-dark/5 text-united-dark hover:bg-united-dark/10"
          >
            {l.label}
          </Link>
        ))}
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}

      {data && (
        <>
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatTile label="مستلم النهارده" value={fmtKg(data.today.receivedKg)} unit="كجم" sub={`${data.today.intakeCount} استلام`} />
            <StatTile label="صافي صالح" value={fmtKg(data.today.goodKg)} unit="كجم" tone="good" />
            <StatTile label="فرز / مرفوض" value={fmtKg(data.today.rejectedKg)} unit="كجم" tone={data.today.rejectedKg > 0 ? "warn" : "muted"} />
            <StatTile
              label="نسبة التصافي"
              value={fmtYield(data.today.yieldPct)}
              tone={({ good: "good", warn: "warn", bad: "bad", none: "muted" } as const)[yieldTone(data.today.yieldPct)]}
              sub={data.today.crates > 0 ? `${data.today.crates} قفص` : undefined}
            />
          </section>

          <QuickIntakeForm date={today} />

          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-extrabold text-united-dark">الرصيد الحالي</h2>
              <span dir="ltr" className="text-lg font-extrabold text-united-green">
                {fmtKg(data.totalStockKg)} كجم
              </span>
            </div>
            {data.currentStock.length === 0 ? (
              <EmptyState icon="📦" title="مفيش رصيد مسجل لحد دلوقتي" />
            ) : (
              <ul className="flex flex-col divide-y divide-united-border">
                {data.currentStock.map((s) => (
                  <li key={s.productId} className="flex items-center justify-between py-2.5">
                    <span className="font-bold text-united-dark">
                      {s.productName}
                      {!s.active && <span className="text-xs font-bold text-united-muted mr-2">(موقوف)</span>}
                    </span>
                    <span dir="ltr" className={`font-extrabold ${s.balanceKg > 0 ? "text-united-dark" : "text-united-muted"}`}>
                      {fmtKg(s.balanceKg)} {s.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] font-bold text-united-muted mt-3">
              الرصيد محسوب من سجل الحركات نفسه — مفيش رقم مخزون متخزّن يتظبط بالإيد.
            </p>
          </section>

          {data.todayByProduct.length > 0 && (
            <section className="card p-4">
              <h2 className="text-lg font-extrabold text-united-dark mb-3">أصناف النهارده</h2>
              <ul className="flex flex-col gap-3">
                {data.todayByProduct.map((p) => (
                  <li key={p.productId}>
                    <div className="flex items-center justify-between text-sm font-bold mb-1">
                      <span className="text-united-dark">{p.productName}</span>
                      <span dir="ltr" className="text-united-muted">
                        {fmtKg(p.goodKg)} / {fmtKg(p.receivedKg)} كجم
                      </span>
                    </div>
                    <YieldMeter pct={p.yieldPct} label={`${p.intakeCount} استلام`} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="grid sm:grid-cols-2 gap-3">
            <PeriodCard title="آخر ٧ أيام" totals={data.week} />
            <PeriodCard title="الشهر ده" totals={data.month} />
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-extrabold text-united-dark">أداء الموردين</h2>
              <span className="text-xs font-bold text-united-muted">الشهر ده</span>
            </div>
            {data.supplierPerformance.length === 0 ? (
              <EmptyState icon="🚚" title="مفيش توريدات مسجلة الشهر ده" />
            ) : (
              <ul className="flex flex-col divide-y divide-united-border">
                {data.supplierPerformance.map((s) => (
                  <li key={s.supplierId} className="py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-united-dark">{s.supplierName}</span>
                      <span dir="ltr" className={`font-extrabold ${YIELD_TONE_CLASS[yieldTone(s.yieldPct)]}`}>
                        {fmtYield(s.yieldPct)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-united-muted" dir="ltr">
                      <span>{s.intakeCount} توريد</span>
                      <span>· {fmtKg(s.receivedKg)} كجم مستلم</span>
                      <span>· {fmtKg(s.rejectedKg)} كجم مرفوض</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] font-bold text-united-muted mt-3">
              الأرقام دي من التوريدات المسجلة فعلاً بس — مفيش تقدير ولا ترتيب مصنوع.
            </p>
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-extrabold text-united-dark">آخر الحركات</h2>
              <Link href="/stock/ledger" className="text-sm font-extrabold text-united-green">
                السجل كامل ←
              </Link>
            </div>
            {data.recentMovements.length === 0 ? (
              <EmptyState icon="🧾" title="مفيش حركات لسه" />
            ) : (
              <ul className="flex flex-col divide-y divide-united-border">
                {data.recentMovements.slice(0, 8).map((m) => (
                  <MovementRow key={m.id} movement={m} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PeriodCard({ title, totals }: { title: string; totals: StockDashboardDTO["week"] }) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-united-dark">{title}</h3>
        <span className="text-xs font-bold text-united-muted">{totals.intakeCount} استلام</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="مستلم" value={fmtKg(totals.receivedKg)} />
        <Metric label="صالح" value={fmtKg(totals.goodKg)} tone="text-united-green" />
        <Metric label="مرفوض" value={fmtKg(totals.rejectedKg)} tone={totals.rejectedKg > 0 ? "text-united-warn" : "text-united-muted"} />
      </div>
      <YieldMeter pct={totals.yieldPct} />
    </div>
  );
}

function Metric({ label, value, tone = "text-united-dark" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div dir="ltr" className={`text-lg font-extrabold ${tone}`}>
        {value}
      </div>
      <div className="text-[11px] font-bold text-united-muted">{label}</div>
    </div>
  );
}
