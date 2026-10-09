"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPatch, apiPost, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { usePermissions } from "@/lib/use-session";
import { fmtMoney, fmtQty } from "@/components/stock/inventory/shared";

type Amounts = { gross: string; discount: string; net: string; tax: string; total: string };
type Pricing = {
  creditStatus?: string | null;
  creditNote?: string | null;
  priceList: { code: string; name: string } | null;
  customer: { code: string; name: string; nameAr: string | null } | null;
  lines: {
    itemId: string; productName: string; unit: string; mapped: boolean; quantity: string; quantityBasis: "loaded" | "prepared" | "required";
    price: { unitPrice: string; discountPct: string; taxCode: string; taxRate: string; source: string; reason: string | null; setBy: string; version: number } | null;
    amounts: Amounts | null;
  }[];
  totals: Amounts;
  unpricedLines: number;
  commercial?: { delivery: { trip: string; status: string } | null; invoice: { id: string; number: string | null; status: string; total: string; open: string | null } | null };
};
const DELIVERY: Record<string, string> = { pending: "لسه في الطريق", delivered: "اتسلم كامل", partial: "اتسلم جزئي", failed: "فشل التسليم" };

const CREDIT: Record<string, string> = { warning: "عدّى الحد (تنبيه)", pending_approval: "مستني موافقة الحسابات", approved: "الحسابات وافقت", rejected: "الحسابات رفضت" };
const BASIS: Record<string, string> = { loaded: "المحمّل", prepared: "المجهّز", required: "المطلوب" };
const SOURCE: Record<string, string> = { list: "قائمة", manual: "يدوي", quotation: "عرض سعر" };

/** The commercial side of an order, for people who may see prices. The floor screens
 * never load this. */
export function OrderPricingPanel({ orderId }: { orderId: string }) {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ price: "", discount: "", reason: "" });
  const q = useQuery({
    queryKey: ["orders", orderId, "pricing"],
    queryFn: () => apiFetch<Pricing>(`/api/orders/${orderId}/pricing`),
    enabled: can("sales.pricing.view"),
    refetchInterval: 30_000,
  });
  if (!can("sales.pricing.view") || !q.data) return null;
  const p = q.data;
  const canOverride = can("sales.price_override");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["orders", orderId, "pricing"] });
  return (
    <section className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-extrabold text-united-dark">الأسعار والقيمة</h3>
        <span className="text-xs font-bold text-united-muted">{p.customer ? `${p.customer.code} · ` : "عميل غير مربوط · "}{p.priceList ? p.priceList.name : "مفيش قائمة أسعار"}</span>
      </div>
      {p.creditStatus && p.creditStatus !== "not_applicable" && p.creditStatus !== "ok" && (
        <p className={`text-sm font-extrabold ${p.creditStatus === "approved" ? "text-united-green" : "text-united-danger"}`}>
          الائتمان: {CREDIT[p.creditStatus] ?? p.creditStatus}{p.creditNote ? ` — ${p.creditNote}` : ""}
        </p>
      )}
      {p.commercial && (p.commercial.delivery || p.commercial.invoice) && (
        <div className="flex flex-wrap gap-2 text-sm font-extrabold">
          {p.commercial.delivery && <span className="rounded-full px-3 py-1 bg-blue-50 text-blue-700">{DELIVERY[p.commercial.delivery.status] ?? p.commercial.delivery.status} · <span dir="ltr">{p.commercial.delivery.trip}</span></span>}
          {p.commercial.invoice ? (
            <span className={`rounded-full px-3 py-1 ${p.commercial.invoice.open === "0.00" ? "bg-united-green/10 text-united-green" : "bg-united-warn/10 text-united-warn"}`}>
              {p.commercial.invoice.status === "draft" ? "فاتورة مسودة" : <>فاتورة <span dir="ltr">{p.commercial.invoice.number}</span></>} · {p.commercial.invoice.open === "0.00" ? "مدفوعة" : p.commercial.invoice.open ? <>باقي <span dir="ltr">{fmtMoney(p.commercial.invoice.open)}</span></> : <span dir="ltr">{fmtMoney(p.commercial.invoice.total)}</span>}
            </span>
          ) : (
            <span className="rounded-full px-3 py-1 bg-united-dark/5">لسه مااتفوترش</span>
          )}
        </div>
      )}
      {p.unpricedLines > 0 && <p className="text-sm font-extrabold text-united-warn">{p.unpricedLines} سطر من غير سعر (صنف مش مربوط أو مفيش سعر لليوم ده)</p>}
      <ul className="flex flex-col divide-y divide-united-dark/5">
        {p.lines.map((l) => (
          <li key={l.itemId} className="py-2 flex flex-col gap-1">
            <div className="flex justify-between gap-2 text-sm">
              <span className="font-extrabold">{l.productName}</span>
              <span dir="ltr" className="font-extrabold">{l.amounts ? fmtMoney(l.amounts.total) : "—"}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs font-bold text-united-muted">
              <span>
                <span dir="ltr">{fmtQty(l.quantity, l.unit)}</span> ({BASIS[l.quantityBasis]})
                {l.price && <> × <span dir="ltr">{l.price.unitPrice}</span>{Number(l.price.discountPct) > 0 ? ` − ${l.price.discountPct}%` : ""}{Number(l.price.taxRate) > 0 ? ` + ض ${l.price.taxRate}%` : ""} · {SOURCE[l.price.source]}{l.price.reason ? ` (${l.price.reason})` : ""}</>}
              </span>
              {canOverride && l.mapped && (
                <button type="button" className="text-united-green underline font-extrabold" onClick={() => { setEditing(editing === l.itemId ? null : l.itemId); setForm({ price: l.price?.unitPrice ?? "", discount: l.price?.discountPct ?? "0", reason: "" }); }}>
                  تعديل السعر
                </button>
              )}
            </div>
            {editing === l.itemId && (
              <form
                className="grid grid-cols-3 gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await apiPatch(`/api/orders/${orderId}/items/${l.itemId}/price`, { unit_price: form.price, discount_pct: form.discount || 0, reason: form.reason, expected_version: l.price?.version });
                    setEditing(null);
                    refresh();
                    toast.show("اتغير السعر", "success");
                  } catch (err) {
                    toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
                  }
                }}
              >
                <input className="field" inputMode="decimal" dir="ltr" placeholder="السعر" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                <input className="field" inputMode="decimal" dir="ltr" placeholder="خصم %" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
                <input className="field" placeholder="السبب (مطلوب)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                <button className="btn-primary col-span-3">حفظ السعر</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm font-bold">
        {[["قبل الخصم", p.totals.gross], ["الخصم", p.totals.discount], ["الضريبة", p.totals.tax], ["الإجمالي", p.totals.total]].map(([k, v]) => (
          <div key={k} className={`rounded-xl p-2 ${k === "الإجمالي" ? "bg-united-green/10 text-united-green" : "bg-united-dark/[0.03]"}`}>
            <dt className="text-xs text-united-muted">{k}</dt>
            <dd dir="ltr" className="font-extrabold">{fmtMoney(v)}</dd>
          </div>
        ))}
      </dl>
      {canOverride && (
        <button
          type="button"
          className="btn-secondary self-start"
          onClick={async () => {
            try {
              const r = await apiPost<{ priced: number }>(`/api/orders/${orderId}/reprice`, {});
              refresh();
              toast.show(r.priced ? `اتحدّث سعر ${r.priced} سطر` : "الأسعار متحدّثة", "success");
            } catch (err) {
              toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
            }
          }}
        >
          تحديث من قائمة الأسعار
        </button>
      )}
    </section>
  );
}
