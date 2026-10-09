"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, ApiClientError, errorMessage } from "@/lib/api-client";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useToast } from "@/components/ui/Toast";
import { usePermissions } from "@/lib/use-session";
import { Field, Tabs, fmtMoney, fmtQty } from "@/components/stock/inventory/shared";

/**
 * Quotations: write an offer for a customer, send it, record the answer, and turn an
 * accepted one into an order with its prices. Prices come from the customer's list;
 * typing a different one needs the price-override permission (the server decides).
 */

type Amounts = { gross: string; discount: string; net: string; tax: string; total: string };
type QRow = { id: string; number: string; status: string; validUntil: string; deliveryDate: string | null; expired: boolean; customer: { code: string; name: string; nameAr: string | null }; totals: Amounts; lineCount: number; order: { id: string; orderNumber: string } | null };
type QDetail = QRow & {
  version: number; notes: string | null; decisionNote: string | null; createdBy: string;
  lines: { id: string; lineNo: number; uomCode: string; quantity: string; unitPrice: string; discountPct: string; taxRate: string; priceSource: string; product: { name: string; nameAr: string | null }; amounts: Amounts }[];
};
type Catalog = { products: { id: string; name: string; nameAr: string | null; unit: string; packagings: { uomCode: string }[] }[] };

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "bg-united-dark/5" },
  sent: { label: "اتبعت", cls: "bg-blue-50 text-blue-700" },
  accepted: { label: "اتقبل", cls: "bg-united-green/10 text-united-green" },
  rejected: { label: "اترفض", cls: "bg-united-danger/10 text-united-danger" },
  converted: { label: "بقى أوردر", cls: "bg-united-green text-white" },
  cancelled: { label: "اتلغى", cls: "bg-united-dark/5 text-united-muted" },
};
const fail = (toast: ReturnType<typeof useToast>, err: unknown) => toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");

export function QuotationsView() {
  const { can } = usePermissions();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ["sales", "quotations", status], queryFn: () => apiFetch<{ quotations: QRow[] }>(`/api/sales/quotations${status ? `?status=${status}` : ""}`) });
  if (open) return <QuotationDetail id={open} onClose={() => setOpen(null)} />;
  if (creating) return <NewQuotation onDone={(id) => { setCreating(false); if (id) setOpen(id); }} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-center">
        <div className="flex-1"><Tabs value={status} onChange={setStatus} items={[{ key: "", label: "الكل" }, { key: "draft", label: "مسودات" }, { key: "sent", label: "مبعوتة" }, { key: "accepted", label: "مقبولة" }, { key: "expired", label: "منتهية" }]} /></div>
        {can("sales.quotations.manage") && <button type="button" className="btn-primary shrink-0" onClick={() => setCreating(true)}>+ عرض سعر</button>}
      </div>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && q.data.quotations.length === 0 && <EmptyState icon="📄" title="مفيش عروض أسعار" />}
      <ul className="flex flex-col gap-2">
        {q.data?.quotations.map((x) => (
          <li key={x.id}>
            <button type="button" className="card p-3 w-full text-start flex justify-between gap-2" onClick={() => setOpen(x.id)}>
              <div>
                <div className="font-extrabold"><span dir="ltr">{x.number}</span> · {x.customer.nameAr ?? x.customer.name}</div>
                <div className="text-xs font-bold text-united-muted">{x.lineCount} سطر · صالح لحد {x.validUntil}{x.order ? ` · ${x.order.orderNumber}` : ""}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`rounded-full px-2 text-xs font-extrabold ${x.expired ? "bg-united-warn/10 text-united-warn" : STATUS[x.status]?.cls}`}>{x.expired ? "انتهت صلاحيته" : STATUS[x.status]?.label}</span>
                <span dir="ltr" className="font-extrabold">{fmtMoney(x.totals.total)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewQuotation({ onDone }: { onDone: (id?: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const customers = useQuery({ queryKey: ["sales", "customers", "", false], queryFn: () => apiFetch<{ customers: { id: string; code: string; name: string; nameAr: string | null }[] }>("/api/sales/customers?q=") });
  const catalog = useQuery({ queryKey: ["sales", "catalog"], queryFn: () => apiFetch<Catalog>("/api/sales/catalog"), staleTime: 60_000 });
  const [customerId, setCustomerId] = useState("");
  const [delivery, setDelivery] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ product_id: "", quantity: "", uom: "", unit_price: "", discount_pct: "" }]);
  const [busy, setBusy] = useState(false);
  const products = catalog.data?.products ?? [];
  const set = (i: number, patch: Partial<(typeof lines)[number]>) => setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  return (
    <form
      className="card p-4 flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const body = {
            customer_id: customerId,
            delivery_date: delivery || undefined,
            valid_until: validUntil || undefined,
            notes: notes || undefined,
            lines: lines.filter((l) => l.product_id && l.quantity).map((l) => ({ product_id: l.product_id, quantity: l.quantity, uom: l.uom || undefined, unit_price: l.unit_price || undefined, discount_pct: l.discount_pct || undefined })),
          };
          const r = await apiPost<{ quotation: { id: string; number: string } }>("/api/sales/quotations", body);
          void qc.invalidateQueries({ queryKey: ["sales", "quotations"] });
          toast.show(`اتعمل ${r.quotation.number}`, "success");
          onDone(r.quotation.id);
        } catch (err) { fail(toast, err); } finally { setBusy(false); }
      }}
    >
      <div className="flex justify-between items-center"><h3 className="font-extrabold">عرض سعر جديد</h3><button type="button" className="btn-secondary" onClick={() => onDone()}>رجوع</button></div>
      <Field label="العميل">
        <select className="field font-bold" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">اختار العميل</option>
          {(customers.data?.customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.nameAr ?? c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="تاريخ التسليم (الأسعار على أساسه)"><input type="date" className="field" value={delivery} onChange={(e) => setDelivery(e.target.value)} /></Field>
        <Field label="صالح لحد (فاضي = الافتراضي)"><input type="date" className="field" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
      </div>
      {lines.map((l, i) => {
        const p = products.find((x) => x.id === l.product_id);
        return (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-t border-united-dark/5 pt-2">
            <select className="field font-bold col-span-2" value={l.product_id} onChange={(e) => set(i, { product_id: e.target.value, uom: "" })}>
              <option value="">الصنف</option>
              {products.map((x) => <option key={x.id} value={x.id}>{x.nameAr ?? x.name}</option>)}
            </select>
            <input className="field" inputMode="decimal" dir="ltr" placeholder="الكمية" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} />
            <select className="field" value={l.uom} onChange={(e) => set(i, { uom: e.target.value })}>
              <option value="">{p?.unit ?? "الوحدة"}</option>
              {(p?.packagings ?? []).map((x) => <option key={x.uomCode} value={x.uomCode}>{x.uomCode}</option>)}
            </select>
            <input className="field" inputMode="decimal" dir="ltr" placeholder="السعر (فاضي = القائمة)" value={l.unit_price} onChange={(e) => set(i, { unit_price: e.target.value })} />
          </div>
        );
      })}
      <button type="button" className="btn-secondary self-start" onClick={() => setLines([...lines, { product_id: "", quantity: "", uom: "", unit_price: "", discount_pct: "" }])}>+ سطر</button>
      <input className="field" placeholder="ملاحظات للعميل" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className="btn-primary text-lg" disabled={busy || !customerId}>{busy ? "بيتسجل..." : "حفظ كمسودة"}</button>
    </form>
  );
}

function QuotationDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState("");
  const q = useQuery({ queryKey: ["sales", "quotation", id], queryFn: () => apiFetch<{ quotation: QDetail }>(`/api/sales/quotations/${id}`) });
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const x = q.data.quotation;
  const refresh = () => void qc.invalidateQueries({ queryKey: ["sales"] });
  const act = async (action: string) => {
    try { await apiPost(`/api/sales/quotations/${id}/transition`, { action, note: note || undefined, expected_version: x.version }); setNote(""); refresh(); } catch (err) { fail(toast, err); }
  };
  const canManage = can("sales.quotations.manage");
  const open = !x.expired;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center gap-2">
        <div>
          <h2 className="text-xl font-extrabold" dir="ltr">{x.number}</h2>
          <p className="text-sm font-bold text-united-muted">{x.customer.nameAr ?? x.customer.name} · صالح لحد {x.validUntil}{x.deliveryDate ? ` · تسليم ${x.deliveryDate}` : ""}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>رجوع</button>
      </div>
      <span className={`self-start rounded-full px-3 py-1 text-sm font-extrabold ${x.expired ? "bg-united-warn/10 text-united-warn" : STATUS[x.status]?.cls}`}>{x.expired ? "انتهت صلاحيته" : STATUS[x.status]?.label}</span>
      <section className="card p-4 flex flex-col divide-y divide-united-dark/5">
        {x.lines.map((l) => (
          <div key={l.id} className="py-2 flex justify-between gap-2 text-sm">
            <div>
              <div className="font-extrabold">{l.product.nameAr ?? l.product.name}</div>
              <div className="text-xs font-bold text-united-muted" dir="rtl"><span dir="ltr">{fmtQty(l.quantity, l.uomCode)} × {l.unitPrice}</span>{Number(l.discountPct) > 0 ? ` − ${l.discountPct}%` : ""}{Number(l.taxRate) > 0 ? ` + ض ${l.taxRate}%` : ""} · {l.priceSource === "list" ? "قائمة" : "يدوي"}</div>
            </div>
            <span dir="ltr" className="font-extrabold">{fmtMoney(l.amounts.total)}</span>
          </div>
        ))}
        <div className="pt-2 flex justify-between font-extrabold"><span>الإجمالي (ضريبة {fmtMoney(x.totals.tax)})</span><span dir="ltr">{fmtMoney(x.totals.total)}</span></div>
      </section>
      {x.decisionNote && <p className="text-sm font-bold text-united-muted">ملاحظة: {x.decisionNote}</p>}
      {x.order && <Link href={`/orders/${x.order.id}`} className="btn-secondary self-start">الأوردر {x.order.orderNumber}</Link>}
      {canManage && !["converted", "rejected", "cancelled"].includes(x.status) && (
        <section className="card p-4 flex flex-col gap-2">
          <input className="field" placeholder="ملاحظة / سبب (مطلوب للرفض والإلغاء)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {x.status === "draft" && open && <button type="button" className="btn-primary" onClick={() => act("send")}>اتبعت للعميل</button>}
            {x.status === "sent" && open && <button type="button" className="btn-primary" onClick={() => act("accept")}>العميل وافق</button>}
            {x.status === "sent" && <button type="button" className="btn-danger" onClick={() => act("reject")}>العميل رفض</button>}
            {["sent", "accepted"].includes(x.status) && open && can("orders.create") && (
              <button type="button" className="btn-primary" onClick={async () => {
                try {
                  const r = await apiPost<{ order: { id: string; orderNumber: string } }>(`/api/sales/quotations/${id}/convert`, {});
                  toast.show(`اتعمل الأوردر ${r.order.orderNumber}`, "success");
                  refresh();
                } catch (err) { fail(toast, err); }
              }}>حوّله لأوردر</button>
            )}
            <button type="button" className="btn-secondary" onClick={() => act("cancel")}>إلغاء العرض</button>
          </div>
        </section>
      )}
    </div>
  );
}
