"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { ErrorState, LoadingState } from "@/components/States";
import { todayLocalISO } from "@/lib/localDate";
import { fmtMoney, fmtQty } from "@/components/stock/inventory/shared";

/** Management reports: finance (sales, margin, balances, stock value, cash, P&L) or operations (fulfilment, prep, loading, delivery, exceptions, stock age). */

const Tile = ({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) => (
  <div className="card p-3">
    <div className="text-xs font-bold text-united-muted">{label}</div>
    <div dir="ltr" className={`text-xl font-extrabold ${tone === "good" ? "text-united-green" : tone === "bad" ? "text-united-danger" : ""}`}>{value}</div>
  </div>
);
const Table = ({ head, rows }: { head: string[]; rows: (string | number | null)[][] }) => (
  <div className="card p-3 overflow-x-auto">
    <table className="w-full text-sm font-bold">
      <thead><tr className="text-xs text-united-muted">{head.map((h, i) => <th key={i} className={`p-1 ${i ? "text-end" : "text-start"}`}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-united-dark/5">{r.map((c, j) => <td key={j} className={`p-1 ${j ? "text-end" : ""}`} dir={j ? "ltr" : undefined}>{c ?? "—"}</td>)}</tr>)}</tbody>
    </table>
  </div>
);
const H = ({ children }: { children: React.ReactNode }) => <h2 className="text-lg font-extrabold mt-2">{children}</h2>;
const KIND: Record<string, string> = { intake: "استلام", intake_correction: "تصحيح استلام", intake_void: "إلغاء استلام", adjustment: "تسوية/جرد", transfer_out: "تحويل خارج", transfer_in: "تحويل داخل", issue: "صرف للعملاء", customer_return: "مرتجع عملاء", supplier_return: "مرتجع موردين", scrap: "هالك" };
const EX: Record<string, string> = { shortage: "عجز", damage: "تالف", rejection: "رفض العميل", delivery_failure: "فشل التسليم", loading_discrepancy: "فرق تحميل" };

export function ManagementView({ kind }: { kind: "finance" | "operations" | "cash-flow" }) {
  const [from, setFrom] = useState(`${todayLocalISO().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayLocalISO());
  const apiKind = kind === "cash-flow" ? "cash-flow" : kind;
  const q = useQuery({ queryKey: ["management", kind, from, to], queryFn: () => apiFetch<{ report: any }>(`/api/management/${apiKind}?from=${from}&to=${to}`) });
  return (
    <div className="p-4 max-w-5xl mx-auto pb-10 flex flex-col gap-3">
      <h1 className="text-2xl font-extrabold text-united-dark">{kind === "finance" ? "تقارير الإدارة" : kind === "cash-flow" ? "التدفقات النقدية" : "أداء التشغيل"}</h1>
      <div className="flex gap-2"><input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} /><input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <div className="flex gap-2 mb-2 flex-wrap">
        <a href="/management/finance" className={`btn-sm ${kind === "finance" ? "btn-primary" : "btn-ghost"}`}>تقارير الإدارة</a>
        <a href="/management/cash-flow" className={`btn-sm ${kind === "cash-flow" ? "btn-primary" : "btn-ghost"}`}>التدفقات النقدية</a>
      </div>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && (kind === "cash-flow" ? <CashFlow r={q.data.report} /> : kind === "finance" ? <Finance r={q.data.report} /> : <Operations r={q.data.report} />)}
    </div>
  );
}

function Finance({ r }: { r: any }) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="صافي المبيعات" value={fmtMoney(r.sales.revenue)} />
        <Tile label="تكلفة المبيعات" value={fmtMoney(r.sales.cost)} />
        <Tile label={`مجمل الربح${r.sales.grossMarginPct ? ` (${r.sales.grossMarginPct}%)` : ""}`} value={fmtMoney(r.sales.grossMargin)} tone={Number(r.sales.grossMargin) >= 0 ? "good" : "bad"} />
        <Tile label="النقدية والبنوك" value={fmtMoney(r.cash.total)} />
        <Tile label="مستحق من العملاء" value={fmtMoney(r.receivables.totals.total)} />
        <Tile label="مستحق للموردين" value={fmtMoney(r.payables.totals.total)} />
        <Tile label="قيمة المخزون" value={fmtMoney(r.inventory.value)} />
        <Tile label="صافي الربح (من القيود)" value={fmtMoney(r.profitAndLoss.net)} tone={Number(r.profitAndLoss.net) >= 0 ? "good" : "bad"} />
      </div>
      <H>الهامش حسب الصنف</H>
      <Table head={["الصنف", "الكمية", "المبيعات", "التكلفة", "الهامش", "%", "بسعر غير مؤكد*"]} rows={r.sales.byProduct.map((p: any) => [p.product, fmtQty(p.quantity), p.revenue, p.cost, p.margin, p.marginPct, Number(p.costUnknownQty ?? 0) > 0 ? fmtQty(p.costUnknownQty) : "—"])} />
      <p className="text-xs font-bold text-united-muted">* ْالكمية المباعة من غير تكلفة معروفة (اتسجلت قبل تسجيل سعر المورد) — الهامش بتاعها مؤقت لحد ما التكلفة الفعلية تتسجل.</p>
      <H>أكبر العملاء</H>
      <Table head={["العميل", "فواتير", "صافي المبيعات"]} rows={r.sales.byCustomer.map((c: any) => [c.name, c.invoices, c.net])} />
      <H>أعمار الديون</H>
      <Table head={["", "لسه", "1–30", "31–60", "61–90", "+90", "الإجمالي"]} rows={[["العملاء", r.receivables.totals.current, r.receivables.totals.d1_30, r.receivables.totals.d31_60, r.receivables.totals.d61_90, r.receivables.totals.d90_plus, r.receivables.totals.total], ["الموردين", r.payables.totals.current, r.payables.totals.d1_30, r.payables.totals.d31_60, r.payables.totals.d61_90, r.payables.totals.d90_plus, r.payables.totals.total]]} />
      <H>قائمة الدخل (القيود المرحّلة)</H>
      <Table head={["الحساب", "المبلغ"]} rows={[...r.profitAndLoss.lines.map((l: any) => [`${l.code} · ${l.name}`, l.amount]), ["صافي الربح", r.profitAndLoss.net]]} />
      <H>حركة المخزون</H>
      <Table head={["النوع", "الكمية", "القيمة"]} rows={r.stockMovement.map((m: any) => [KIND[m.kind] ?? m.kind, fmtQty(m.quantity), m.value])} />
      <H>أعلى أصناف المخزون قيمة</H>
      <Table head={["الصنف", "الكمية", "القيمة"]} rows={r.inventory.top.map((p: any) => [p.product, fmtQty(p.quantity, p.unit), p.value])} />
    </>
  );
}

function CashFlow({ r }: { r: any }) {
  const sectionLabels: Record<string, string> = { operating: "أنشطة تشغيلية", investing: "أنشطة استثمارية", financing: "أنشطة تمويلية" };
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="التدفق النقدي من الأنشطة التشغيلية" value={fmtMoney(r.sections.operating.total)} tone={Number(r.sections.operating.total) >= 0 ? "good" : "bad"} />
        <Tile label="الأنشطة الاستثمارية" value={fmtMoney(r.sections.investing.total)} tone={Number(r.sections.investing.total) >= 0 ? "good" : "bad"} />
        <Tile label="الأنشطة التمويلية" value={fmtMoney(r.sections.financing.total)} tone={Number(r.sections.financing.total) >= 0 ? "good" : "bad"} />
      </div>
      {["operating", "investing", "financing"].map((key) => (
        <div key={key}>
          <H>{sectionLabels[key]}</H>
          <Table head={["البيان", "المبلغ"]} rows={[
            ...r.sections[key].lines.map((l: any) => [l.label, fmtMoney(l.amount)]),
            ["الإجمالي", fmtMoney(r.sections[key].total)],
          ]} />
        </div>
      ))}
      <H>التغير في النقدية</H>
      <Table head={["البيان", "المبلغ"]} rows={[
        ["صافي التدفق النقدي", fmtMoney(r.netCashFlow)],
        ...r.cashAccounts.map((a: any) => [`رصيد ${a.name} أول الفترة`, fmtMoney(a.opening)]),
        ...r.cashAccounts.map((a: any) => [`رصيد ${a.name} آخر الفترة`, fmtMoney(a.closing)]),
        ...r.cashAccounts.map((a: any) => [`التغير في ${a.name}`, fmtMoney(a.change)]),
        ["إجمالي رصيد أول الفترة", fmtMoney(r.cashTotal.opening)],
        ["إجمالي رصيد آخر الفترة", fmtMoney(r.cashTotal.closing)],
        ["صافي التغير", fmtMoney(r.cashTotal.change)],
      ]} />
    </>
  );
}

function Operations({ r }: { r: any }) {
  const f = r.fulfilment;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="أوردرات" value={String(f.orders)} />
        <Tile label="خرجت" value={String(f.dispatched)} />
        <Tile label="نسبة التجهيز من المطلوب" value={f.preparedPct ? `${f.preparedPct}%` : "—"} />
        <Tile label="نسبة التسليم من اللي خرج" value={f.delivery.deliveredPct ? `${f.delivery.deliveredPct}%` : "—"} tone="good" />
        <Tile label="رحلات" value={`${r.loading.completed}/${r.loading.trips}`} />
        <Tile label="متوسط التحميل (دقيقة)" value={r.loading.avgLoadMinutes == null ? "—" : String(r.loading.avgLoadMinutes)} />
        <Tile label="من الخروج للتسليم (دقيقة)" value={r.loading.avgDispatchToDoneMinutes == null ? "—" : String(r.loading.avgDispatchToDoneMinutes)} />
        <Tile label="ملغي" value={String(f.cancelled)} />
      </div>
      <H>التسليم</H>
      <Table head={["", "خرج", "اتسلم", "عجز", "تالف", "مرفوض"]} rows={[["الكميات", fmtQty(f.delivery.shipped), fmtQty(f.delivery.delivered), fmtQty(f.delivery.shortage), fmtQty(f.delivery.damaged), fmtQty(f.delivery.rejected)]]} />
      <Table head={["السواق", "اتسلم", "جزئي", "فشل", "لسه"]} rows={r.delivery.map((d: any) => [d.driver, d.delivered, d.partial, d.failed, d.pending])} />
      <H>التجهيز</H>
      <Table head={["المجهّز", "أوردرات", "متوسط الوقت (دقيقة)"]} rows={r.preparation.map((p: any) => [p.preparer, p.orders, p.avgMinutes])} />
      <H>الاستثناءات</H>
      <Table head={["النوع", "مفتوح", "اتقفل", "متوسط وقت الحل (ساعة)"]} rows={r.exceptions.map((e: any) => [EX[e.type] ?? e.type, e.open, e.resolved, e.avgHoursToResolve])} />
      <H>عمر المخزون الحالي (أيام من الاستلام)</H>
      <Table head={["العمر", "الكمية", "لوطات"]} rows={r.inventoryAging.map((a: any) => [a.bucket, fmtQty(a.quantity), a.lots])} />
    </>
  );
}
