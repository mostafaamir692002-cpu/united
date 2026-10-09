"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPatch, apiPost, ApiClientError, errorMessage } from "@/lib/api-client";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useToast } from "@/components/ui/Toast";
import { usePermissions } from "@/lib/use-session";
import { todayLocalISO } from "@/lib/localDate";
import { Field, Tabs, fmtMoney, fmtQty } from "@/components/stock/inventory/shared";
import { BillsView } from "@/components/purchasing/BillsView";

/**
 * Purchasing: suppliers and what they charge, requests for quotation, purchase orders
 * and their approval, and (for finance) supplier bills. Prices appear only for those
 * allowed to see them — the server leaves them out otherwise.
 */

type Tab = "orders" | "replenishment" | "rfqs" | "suppliers" | "bills";
type Catalog = { products: { id: string; name: string; nameAr: string | null; unit: string; packagings: { uomCode: string }[] }[] };
type SupplierRow = { id: string; code: string; name: string; type: string; phone: string | null; city: string | null; paymentTermsDays: number; leadTimeDays: number | null; active: boolean; version: number; taxRegistrationNo: string | null; email: string | null; address: string | null };
const fail = (toast: ReturnType<typeof useToast>, err: unknown) => toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");

export const PO_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "bg-united-dark/5" },
  pending_approval: { label: "مستني اعتماد", cls: "bg-united-warn/10 text-united-warn" },
  approved: { label: "معتمد", cls: "bg-blue-50 text-blue-700" },
  sent: { label: "اتبعت للمورد", cls: "bg-blue-50 text-blue-700" },
  partially_received: { label: "استلام جزئي", cls: "bg-united-warn/10 text-united-warn" },
  received: { label: "اتستلم", cls: "bg-united-green/10 text-united-green" },
  closed: { label: "مقفول", cls: "bg-united-dark/5 text-united-muted" },
  cancelled: { label: "ملغي", cls: "bg-united-danger/10 text-united-danger" },
};
const SUPPLIER_TYPE: Record<string, string> = { farm: "مزرعة", grower: "مزارع", wholesaler: "تاجر جملة", market_trader: "تاجر سوق العبور", importer: "مستورد", packaging: "تغليف", services: "خدمات", other: "أخرى" };

export function PurchasingView() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>("orders");
  const [poId, setPoId] = useState<string | null>(null);
  const [billId, setBillId] = useState<string | null>(null);
  const [rfqSeed, setRfqSeed] = useState<{ product_id: string; quantity: string; uom: string; unit_price: string }[] | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("po")) setPoId(sp.get("po"));
    // Approval links open a bill: /purchasing?bill=…
    if (sp.get("bill")) { setBillId(sp.get("bill")); setTab("bills"); }
    if (sp.get("tab")) setTab(sp.get("tab") as Tab);
  }, []);
  const tabs: { key: Tab; label: string }[] = [
    ...(can("purchasing.orders.view") ? [
      { key: "orders" as Tab, label: "أوامر الشراء" },
      ...(can("purchasing.rfq.manage") ? [{ key: "replenishment" as Tab, label: "اقتراحات التوريد" }] : []),
    ] : []),
    ...(can("purchasing.rfq.manage") ? [{ key: "rfqs" as Tab, label: "طلبات عروض الأسعار" }] : []),
    ...(can("purchasing.suppliers.view") ? [{ key: "suppliers" as Tab, label: "الموردين" }] : []),
    ...(can("purchasing.bills.view") ? [{ key: "bills" as Tab, label: "فواتير الموردين" }] : []),
  ];
  return (
    <div className="p-4 max-w-5xl mx-auto pb-10 flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-united-dark">المشتريات</h1>
      <Tabs value={tab} onChange={(t) => { setTab(t); setPoId(null); setBillId(null); }} items={tabs} />
      {poId ? (
        <PoDetail id={poId} onClose={() => setPoId(null)} />
      ) : tab === "orders" ? (
        <Orders onOpen={setPoId} />
      ) : tab === "replenishment" ? (
        <Replenishment onCreateRfq={(lines) => { setRfqSeed(lines); setTab("rfqs"); }} />
      ) : tab === "rfqs" ? (
        <Rfqs onOpenPo={setPoId} seedLines={rfqSeed ?? undefined} onSeedUsed={() => setRfqSeed(null)} />
      ) : tab === "bills" ? (
        <BillsView key={billId ?? "list"} initialBillId={billId} />
      ) : (
        <Suppliers />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------

type PoLine = { id: string; lineNo: number; productId: string; product: { name: string; nameAr: string | null; unit: string }; uomCode: string; quantity: string; baseQuantity: string; receivedGood: string; rejected: string; remaining: string; unitPrice?: string; discountPct?: string; taxRate?: string; priceSource?: string; amounts?: { total: string } };
type Po = { id: string; number: string; status: string; supplier: { id: string; code: string; name: string }; orderDate: string; expectedDate: string | null; notes: string | null; cancelReason: string | null; approvedBy: string | null; version: number; createdBy: string; lines: PoLine[]; total?: string; net?: string; taxTotal?: string; currencyCode?: string };

function Orders({ onOpen }: { onOpen: (id: string) => void }) {
  const { can } = usePermissions();
  const [status, setStatus] = useState("open");
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ["purchasing", "orders", status], queryFn: () => apiFetch<{ orders: Po[] }>(`/api/purchasing/orders${status === "open" ? "?open=1" : status ? `?status=${status}` : ""}`) });
  if (creating) return <NewPo onDone={(id) => { setCreating(false); if (id) onOpen(id); }} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-center">
        <div className="flex-1"><Tabs value={status} onChange={setStatus} items={[{ key: "open", label: "مفتوحة" }, { key: "draft", label: "مسودات" }, { key: "pending_approval", label: "مستنية اعتماد" }, { key: "", label: "الكل" }]} /></div>
        {can("purchasing.orders.manage") && <button type="button" className="btn-primary shrink-0" onClick={() => setCreating(true)}>+ أمر شراء</button>}
      </div>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && q.data.orders.length === 0 && <EmptyState icon="🛒" title="مفيش أوامر شراء" />}
      <ul className="flex flex-col gap-2">
        {q.data?.orders.map((po) => (
          <li key={po.id}>
            <button type="button" className="card p-3 w-full text-start flex justify-between gap-2" onClick={() => onOpen(po.id)}>
              <div>
                <div className="font-extrabold"><span dir="ltr">{po.number}</span> · {po.supplier.name}</div>
                <div className="text-xs font-bold text-united-muted">{po.lines.length} سطر · {po.orderDate}{po.expectedDate ? ` · متوقع ${po.expectedDate}` : ""}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`rounded-full px-2 text-xs font-extrabold ${PO_STATUS[po.status]?.cls}`}>{PO_STATUS[po.status]?.label}</span>
                {po.total !== undefined && <span dir="ltr" className="font-extrabold">{fmtMoney(po.total)}</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function useCatalog() {
  return useQuery({ queryKey: ["purchasing", "catalog"], queryFn: () => apiFetch<Catalog>("/api/sales/catalog"), staleTime: 60_000 });
}
function useSuppliers() {
  return useQuery({ queryKey: ["purchasing", "suppliers"], queryFn: () => apiFetch<{ suppliers: SupplierRow[] }>("/api/purchasing/suppliers") });
}

function LineEditor({ lines, setLines, withPrice }: { lines: { product_id: string; quantity: string; uom: string; unit_price: string }[]; setLines: (l: { product_id: string; quantity: string; uom: string; unit_price: string }[]) => void; withPrice: boolean }) {
  const catalog = useCatalog();
  const products = catalog.data?.products ?? [];
  const set = (i: number, patch: Partial<(typeof lines)[number]>) => setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  return (
    <div className="flex flex-col gap-2">
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
            {withPrice && <input className="field" inputMode="decimal" dir="ltr" placeholder="السعر (فاضي = المتفق عليه)" value={l.unit_price} onChange={(e) => set(i, { unit_price: e.target.value })} />}
          </div>
        );
      })}
      <button type="button" className="btn-secondary self-start" onClick={() => setLines([...lines, { product_id: "", quantity: "", uom: "", unit_price: "" }])}>+ سطر</button>
    </div>
  );
}

const cleanLines = (lines: { product_id: string; quantity: string; uom: string; unit_price: string }[]) =>
  lines.filter((l) => l.product_id && l.quantity).map((l) => ({ product_id: l.product_id, quantity: l.quantity, uom: l.uom || undefined, unit_price: l.unit_price || undefined }));

function NewPo({ onDone }: { onDone: (id?: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const suppliers = useSuppliers();
  const [supplierId, setSupplierId] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ product_id: "", quantity: "", uom: "", unit_price: "" }]);
  const [busy, setBusy] = useState(false);
  return (
    <form className="card p-4 flex flex-col gap-3" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      try {
        const r = await apiPost<{ order: Po }>("/api/purchasing/orders", { supplier_id: supplierId, expected_date: expected || undefined, notes: notes || undefined, lines: cleanLines(lines) });
        void qc.invalidateQueries({ queryKey: ["purchasing"] });
        toast.show(`اتعمل ${r.order.number}`, "success");
        onDone(r.order.id);
      } catch (err) { fail(toast, err); } finally { setBusy(false); }
    }}>
      <div className="flex justify-between"><h3 className="font-extrabold">أمر شراء جديد</h3><button type="button" className="btn-secondary" onClick={() => onDone()}>رجوع</button></div>
      <Field label="المورد">
        <select className="field font-bold" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">اختار المورد</option>
          {(suppliers.data?.suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
        </select>
      </Field>
      <Field label="تاريخ التوريد المتوقع"><input type="date" className="field" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
      <LineEditor lines={lines} setLines={setLines} withPrice />
      <input className="field" placeholder="ملاحظات للمورد" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className="btn-primary text-lg" disabled={busy || !supplierId}>{busy ? "بيتسجل..." : "حفظ كمسودة"}</button>
    </form>
  );
}

function PoDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const q = useQuery({ queryKey: ["purchasing", "order", id], queryFn: () => apiFetch<{ order: Po }>(`/api/purchasing/orders/${id}`) });
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const po = q.data.order;
  const manage = can("purchasing.orders.manage");
  const act = async (path: string, body: Record<string, unknown> = {}) => {
    try { await apiPost(`/api/purchasing/orders/${id}/${path}`, body); setReason(""); void qc.invalidateQueries({ queryKey: ["purchasing"] }); } catch (err) { fail(toast, err); }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center gap-2">
        <div>
          <h2 className="text-xl font-extrabold" dir="ltr">{po.number}</h2>
          <p className="text-sm font-bold text-united-muted">{po.supplier.code} · {po.supplier.name} · {po.orderDate}{po.expectedDate ? ` · متوقع ${po.expectedDate}` : ""}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>رجوع</button>
      </div>
      <span className={`self-start rounded-full px-3 py-1 text-sm font-extrabold ${PO_STATUS[po.status]?.cls}`}>{PO_STATUS[po.status]?.label}{po.approvedBy ? ` · اعتمد: ${po.approvedBy}` : ""}</span>
      <section className="card p-4 flex flex-col divide-y divide-united-dark/5">
        {po.lines.map((l) => (
          <div key={l.id} className="py-2 flex flex-col gap-1">
            <div className="flex justify-between text-sm font-extrabold">
              <span>{l.product.nameAr ?? l.product.name}</span>
              {l.amounts && <span dir="ltr">{fmtMoney(l.amounts.total)}</span>}
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-xs font-bold text-united-muted">
              <span dir="ltr">{fmtQty(l.quantity, l.uomCode)}{l.uomCode !== l.product.unit ? ` = ${fmtQty(l.baseQuantity, l.product.unit)}` : ""}{l.unitPrice ? ` × ${l.unitPrice}` : ""}</span>
              <span>اتستلم سليم {fmtQty(l.receivedGood, l.product.unit)}{Number(l.rejected) ? ` · مرفوض ${fmtQty(l.rejected, l.product.unit)}` : ""} · باقي {fmtQty(l.remaining, l.product.unit)}</span>
            </div>
          </div>
        ))}
        {po.total !== undefined && <div className="pt-2 flex justify-between font-extrabold"><span>الإجمالي</span><span dir="ltr">{fmtMoney(po.total)}</span></div>}
      </section>
      {po.cancelReason && <p className="text-sm font-bold text-united-muted">السبب: {po.cancelReason}</p>}
      {manage && !["cancelled", "closed", "received"].includes(po.status) && (
        <section className="card p-4 flex flex-wrap gap-2">
          {po.status === "draft" && <button type="button" className="btn-primary" onClick={() => act("submit")}>تقديم للاعتماد</button>}
          {po.status === "approved" && <button type="button" className="btn-primary" onClick={() => act("send")}>اتبعت للمورد</button>}
          <input className="field flex-1" placeholder="السبب (للإلغاء أو القفل)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {["draft", "pending_approval", "approved", "sent"].includes(po.status) && <button type="button" className="btn-danger" onClick={() => act("cancel", { reason })}>إلغاء</button>}
          {["sent", "partially_received"].includes(po.status) && <button type="button" className="btn-secondary" onClick={() => act("close", { reason })}>قفل (مش هيكمل)</button>}
        </section>
      )}
    </div>
  );
}

function Replenishment({ onCreateRfq }: { onCreateRfq: (lines: { product_id: string; quantity: string; uom: string; unit_price: string }[]) => void }) {
  const q = useQuery({ queryKey: ["purchasing", "replenishment"], queryFn: () => apiFetch<{ replenishment: { warehouse: { code: string; name: string }; suggestions: { productId: string; productName: string; unit: string; available: string; reorderPointQty: string; maxStockQty: string | null; suggestedQty: string }[] } }>("/api/purchasing/orders?replenishment=1") });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} />;
  const suggestions = q.data?.replenishment.suggestions ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-united-muted">اقتراحات حسب الرصيد الصالح للبيع والحجوزات · {q.data?.replenishment.warehouse.name}</div>
      {suggestions.length === 0 ? <div><EmptyState icon="📦" title="مفيش أصناف وصلت لحد إعادة الطلب" /><p className="text-center text-sm text-united-muted -mt-10">اضبط حد إعادة الطلب والحد الأقصى من كارت الصنف علشان تظهر اقتراحات التوريد.</p></div> : (
        <>
          <div className="flex justify-end"><button type="button" className="btn-primary" disabled={!Object.values(selected).some(Boolean)} onClick={() => onCreateRfq(suggestions.filter((s) => selected[s.productId]).map((s) => ({ product_id: s.productId, quantity: s.suggestedQty, uom: s.unit, unit_price: "" })))}>جهّز طلب عروض سعر للأصناف المحددة</button></div>
          <ul className="flex flex-col gap-2">{suggestions.map((s) => (
            <li key={s.productId}>
              <label className="card p-3 flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={!!selected[s.productId]} onChange={(e) => setSelected({ ...selected, [s.productId]: e.target.checked })} />
                <span className="flex-1"><strong>{s.productName}</strong><span className="block text-xs text-united-muted">متاح {fmtQty(s.available)} · حد الطلب {fmtQty(s.reorderPointQty)} · الهدف {s.maxStockQty ? fmtQty(s.maxStockQty) : fmtQty(s.reorderPointQty)}</span></span>
                <span className="font-extrabold">اطلب {fmtQty(s.suggestedQty)} {s.unit}</span>
              </label>
            </li>
          ))}</ul>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RFQs
// ---------------------------------------------------------------------------

type RfqDetail = {
  id: string; number: string; status: string; neededBy: string | null;
  invited: { supplier: { id: string; code: string; name: string }; status: string; validUntil: string | null }[];
  comparison: { line: { id: string; product: { name: string; nameAr: string | null; unit: string }; uomCode: string; quantity: string }; quotes: { supplier: { id: string; name: string }; unitPrice: string; leadTimeDays: number | null; awarded: boolean }[]; cheapestSupplierId: string | null }[];
  orders: { id: string; number: string; status: string }[];
};

function Rfqs({ onOpenPo, seedLines, onSeedUsed }: { onOpenPo: (id: string) => void; seedLines?: { product_id: string; quantity: string; uom: string; unit_price: string }[]; onSeedUsed: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (seedLines?.length) { setCreating(true); onSeedUsed(); } }, [seedLines, onSeedUsed]);
  const q = useQuery({ queryKey: ["purchasing", "rfqs"], queryFn: () => apiFetch<{ rfqs: { id: string; number: string; status: string; neededBy: string | null; _count: { lines: number; suppliers: number }; suppliers: { status: string }[] }[] }>("/api/purchasing/rfqs") });
  if (open) return <RfqView id={open} onClose={() => setOpen(null)} onOpenPo={onOpenPo} />;
  if (creating) return <NewRfq initialLines={seedLines} onDone={(id) => { setCreating(false); if (id) setOpen(id); }} />;
  return (
    <div className="flex flex-col gap-3">
      <button type="button" className="btn-primary self-start" onClick={() => setCreating(true)}>+ طلب عرض سعر</button>
      {q.data && q.data.rfqs.length === 0 && <EmptyState icon="📨" title="مفيش طلبات" />}
      <ul className="flex flex-col gap-2">
        {q.data?.rfqs.map((r) => (
          <li key={r.id}>
            <button type="button" className="card p-3 w-full text-start flex justify-between" onClick={() => setOpen(r.id)}>
              <span className="font-extrabold" dir="ltr">{r.number}</span>
              <span className="text-xs font-bold text-united-muted">{r._count.lines} صنف · {r.suppliers.filter((s) => s.status === "quoted").length}/{r._count.suppliers} ردّوا · {r.status}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewRfq({ onDone, initialLines }: { onDone: (id?: string) => void; initialLines?: { product_id: string; quantity: string; uom: string; unit_price: string }[] }) {
  const toast = useToast();
  const suppliers = useSuppliers();
  const [picked, setPicked] = useState<string[]>([]);
  const [neededBy, setNeededBy] = useState("");
  const [lines, setLines] = useState(initialLines?.length ? initialLines : [{ product_id: "", quantity: "", uom: "", unit_price: "" }]);
  return (
    <form className="card p-4 flex flex-col gap-3" onSubmit={async (e) => {
      e.preventDefault();
      try {
        const r = await apiPost<{ rfq: { id: string } }>("/api/purchasing/rfqs", { needed_by: neededBy || undefined, supplier_ids: picked, lines: cleanLines(lines).map(({ unit_price: _u, ...x }) => x) });
        onDone(r.rfq.id);
      } catch (err) { fail(toast, err); }
    }}>
      <div className="flex justify-between"><h3 className="font-extrabold">طلب عرض سعر</h3><button type="button" className="btn-secondary" onClick={() => onDone()}>رجوع</button></div>
      <Field label="مطلوب قبل"><input type="date" className="field" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} /></Field>
      <LineEditor lines={lines} setLines={setLines} withPrice={false} />
      <div className="flex flex-wrap gap-2">
        {(suppliers.data?.suppliers ?? []).map((s) => (
          <button type="button" key={s.id} onClick={() => setPicked(picked.includes(s.id) ? picked.filter((x) => x !== s.id) : [...picked, s.id])} className={`tap-target px-3 rounded-xl text-sm font-extrabold ${picked.includes(s.id) ? "bg-united-green text-white" : "bg-united-dark/5"}`}>{s.name}</button>
        ))}
      </div>
      <button className="btn-primary" disabled={!picked.length}>حفظ</button>
    </form>
  );
}

function RfqView({ id, onClose, onOpenPo }: { id: string; onClose: () => void; onOpenPo: (id: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [award, setAward] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<{ supplier: string; prices: Record<string, string> }>({ supplier: "", prices: {} });
  const q = useQuery({ queryKey: ["purchasing", "rfq", id], queryFn: () => apiFetch<{ rfq: RfqDetail }>(`/api/purchasing/rfqs/${id}`) });
  if (!q.data) return <LoadingState />;
  const r = q.data.rfq;
  const refresh = () => void qc.invalidateQueries({ queryKey: ["purchasing"] });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center"><h2 className="text-xl font-extrabold" dir="ltr">{r.number}</h2><button type="button" className="btn-secondary" onClick={onClose}>رجوع</button></div>
      <p className="text-sm font-bold text-united-muted">{r.status}{r.neededBy ? ` · مطلوب قبل ${r.neededBy}` : ""} · {r.invited.map((i) => `${i.supplier.name} (${i.status === "quoted" ? "ردّ" : i.status === "declined" ? "اعتذر" : "مستني"})`).join("، ")}</p>
      {r.status === "draft" && <button type="button" className="btn-primary self-start" onClick={async () => { try { await apiPost(`/api/purchasing/rfqs/${id}/send`, {}); refresh(); } catch (err) { fail(toast, err); } }}>اتبعت للموردين</button>}
      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-extrabold">المقارنة</h3>
        {r.comparison.map((c) => (
          <div key={c.line.id} className="border-b border-united-dark/5 pb-2">
            <div className="font-extrabold text-sm">{c.line.product.nameAr ?? c.line.product.name} · <span dir="ltr">{fmtQty(c.line.quantity, c.line.uomCode)}</span></div>
            {c.quotes.length === 0 && <p className="text-xs font-bold text-united-muted">مفيش عروض</p>}
            {c.quotes.map((x) => (
              <label key={x.supplier.id} className="flex items-center justify-between text-sm font-bold py-1">
                <span className="flex items-center gap-2">
                  {r.status === "sent" && <input type="radio" name={c.line.id} checked={award[c.line.id] === x.supplier.id} onChange={() => setAward({ ...award, [c.line.id]: x.supplier.id })} />}
                  {x.supplier.name}{x.supplier.id === c.cheapestSupplierId ? " ⭐ الأرخص" : ""}{x.awarded ? " ✓ اترسّى" : ""}{x.leadTimeDays != null ? ` · ${x.leadTimeDays} يوم` : ""}
                </span>
                <span dir="ltr">{x.unitPrice} / {c.line.uomCode}</span>
              </label>
            ))}
          </div>
        ))}
        {r.status === "sent" && (
          <button type="button" className="btn-primary self-start" disabled={!Object.keys(award).length} onClick={async () => {
            try {
              const res = await apiPost<{ orders: { id: string; number: string }[] }>(`/api/purchasing/rfqs/${id}/award`, { awards: Object.entries(award).map(([rfq_line_id, supplier_id]) => ({ rfq_line_id, supplier_id })) });
              toast.show(`اتعمل ${res.orders.map((o) => o.number).join("، ")}`, "success");
              refresh();
            } catch (err) { fail(toast, err); }
          }}>رسّي واعمل أوامر الشراء</button>
        )}
      </section>
      {r.status === "sent" && (
        <section className="card p-4 flex flex-col gap-2">
          <h3 className="font-extrabold">تسجيل عرض مورد</h3>
          <select className="field font-bold" value={quote.supplier} onChange={(e) => setQuote({ supplier: e.target.value, prices: {} })}>
            <option value="">المورد</option>
            {r.invited.map((i) => <option key={i.supplier.id} value={i.supplier.id}>{i.supplier.name}</option>)}
          </select>
          {quote.supplier && r.comparison.map((c) => (
            <div key={c.line.id} className="flex items-center gap-2 text-sm font-bold">
              <span className="flex-1">{c.line.product.nameAr ?? c.line.product.name} ({c.line.uomCode})</span>
              <input className="field w-32" inputMode="decimal" dir="ltr" placeholder="السعر" value={quote.prices[c.line.id] ?? ""} onChange={(e) => setQuote({ ...quote, prices: { ...quote.prices, [c.line.id]: e.target.value } })} />
            </div>
          ))}
          {quote.supplier && (
            <button type="button" className="btn-primary self-start" onClick={async () => {
              try {
                await apiPost(`/api/purchasing/rfqs/${id}/quotes`, { supplier_id: quote.supplier, lines: Object.entries(quote.prices).filter(([, v]) => v.trim()).map(([rfq_line_id, unit_price]) => ({ rfq_line_id, unit_price })) });
                setQuote({ supplier: "", prices: {} });
                refresh();
              } catch (err) { fail(toast, err); }
            }}>حفظ العرض</button>
          )}
        </section>
      )}
      {r.orders.length > 0 && (
        <div className="flex flex-wrap gap-2">{r.orders.map((o) => <button type="button" key={o.id} className="btn-secondary" onClick={() => onOpenPo(o.id)} dir="ltr">{o.number}</button>)}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

function Suppliers() {
  const { can } = usePermissions();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useSuppliers();
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "farm", payment_terms_days: "0", tax_registration_no: "" });
  if (open) return <SupplierDetail id={open} onClose={() => setOpen(null)} />;
  return (
    <div className="flex flex-col gap-3">
      {can("purchasing.suppliers.manage") && (
        <form className="card p-3 grid grid-cols-2 sm:grid-cols-5 gap-2" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await apiPost("/api/purchasing/suppliers", { name: form.name, type: form.type, payment_terms_days: Number(form.payment_terms_days || 0), tax_registration_no: form.tax_registration_no || undefined });
            setForm({ name: "", type: "farm", payment_terms_days: "0", tax_registration_no: "" });
            void qc.invalidateQueries({ queryKey: ["purchasing", "suppliers"] });
          } catch (err) { fail(toast, err); }
        }}>
          <input className="field col-span-2" placeholder="اسم المورد" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(SUPPLIER_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input className="field" inputMode="numeric" dir="ltr" placeholder="أيام السداد" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })} />
          <button className="btn-secondary">+ مورد</button>
        </form>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {q.data?.suppliers.map((s) => (
          <li key={s.id}>
            <button type="button" className="card p-3 w-full text-start" onClick={() => setOpen(s.id)}>
              <div className="flex justify-between"><span className="font-extrabold">{s.name}</span><span className="text-xs font-bold text-united-muted" dir="ltr">{s.code}</span></div>
              <div className="text-xs font-bold text-united-muted">{SUPPLIER_TYPE[s.type]} · {s.paymentTermsDays ? `آجل ${s.paymentTermsDays} يوم` : "كاش"}{s.leadTimeDays != null ? ` · توريد ${s.leadTimeDays} يوم` : ""}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SupplierDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = usePermissions();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["purchasing", "supplier", id], queryFn: () => apiFetch<{ supplier: SupplierRow & { contacts: { id: string; name: string; phone: string | null; isPrimary: boolean }[] } }>(`/api/purchasing/suppliers/${id}`) });
  const prices = useQuery({ queryKey: ["purchasing", "supplier", id, "prices"], queryFn: () => apiFetch<{ prices: { id: string; uomCode: string; unitPrice: string; validFrom: string; createdBy: string; product: { name: string; nameAr: string | null } }[] }>(`/api/purchasing/suppliers/${id}/prices`), enabled: can("purchasing.prices.view") });
  const catalog = useCatalog();
  const [terms, setTerms] = useState<{ days: string; lead: string } | null>(null);
  const [price, setPrice] = useState({ product_id: "", unit_price: "", valid_from: todayLocalISO() });
  if (!q.data) return <LoadingState />;
  const s = q.data.supplier;
  const refresh = () => void qc.invalidateQueries({ queryKey: ["purchasing"] });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center"><div><h2 className="text-xl font-extrabold">{s.name}</h2><p className="text-xs font-bold text-united-muted" dir="ltr">{s.code}{s.taxRegistrationNo ? ` · TAX ${s.taxRegistrationNo}` : ""}</p></div><button type="button" className="btn-secondary" onClick={onClose}>رجوع</button></div>
      <section className="card p-4 flex flex-col gap-2 text-sm font-bold">
        <div>{SUPPLIER_TYPE[s.type]} · {s.paymentTermsDays ? `آجل ${s.paymentTermsDays} يوم` : "كاش"} · {s.leadTimeDays != null ? `توريد خلال ${s.leadTimeDays} يوم` : "مدة التوريد مش متسجلة"}</div>
        {s.contacts.map((c) => <div key={c.id}>{c.name}{c.isPrimary ? " ⭐" : ""} · <span dir="ltr">{c.phone}</span></div>)}
        {can("purchasing.suppliers.manage") && (terms ? (
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            try { await apiPatch(`/api/purchasing/suppliers/${id}`, { payment_terms_days: Number(terms.days || 0), lead_time_days: terms.lead === "" ? null : Number(terms.lead), expected_version: s.version }); setTerms(null); refresh(); } catch (err) { fail(toast, err); }
          }}>
            <input className="field" dir="ltr" placeholder="أيام السداد" value={terms.days} onChange={(e) => setTerms({ ...terms, days: e.target.value })} />
            <input className="field" dir="ltr" placeholder="أيام التوريد" value={terms.lead} onChange={(e) => setTerms({ ...terms, lead: e.target.value })} />
            <button className="btn-primary shrink-0">حفظ</button>
          </form>
        ) : <button type="button" className="text-united-green underline self-start" onClick={() => setTerms({ days: String(s.paymentTermsDays), lead: s.leadTimeDays == null ? "" : String(s.leadTimeDays) })}>تعديل الشروط</button>)}
      </section>
      {can("purchasing.prices.view") && (
        <section className="card p-4 flex flex-col gap-2">
          <h3 className="font-extrabold">الأسعار المتفق عليها</h3>
          {can("purchasing.prices.manage") && (
            <form className="grid grid-cols-2 sm:grid-cols-4 gap-2" onSubmit={async (e) => {
              e.preventDefault();
              try { await apiPost(`/api/purchasing/suppliers/${id}/prices`, { valid_from: price.valid_from, prices: [{ product_id: price.product_id, unit_price: price.unit_price }] }); setPrice({ ...price, unit_price: "" }); refresh(); } catch (err) { fail(toast, err); }
            }}>
              <select className="field font-bold col-span-2" value={price.product_id} onChange={(e) => setPrice({ ...price, product_id: e.target.value })}>
                <option value="">الصنف</option>
                {(catalog.data?.products ?? []).map((p) => <option key={p.id} value={p.id}>{p.nameAr ?? p.name} ({p.unit})</option>)}
              </select>
              <input className="field" dir="ltr" inputMode="decimal" placeholder="السعر / الوحدة الأساسية" value={price.unit_price} onChange={(e) => setPrice({ ...price, unit_price: e.target.value })} />
              <input className="field" type="date" value={price.valid_from} onChange={(e) => setPrice({ ...price, valid_from: e.target.value })} />
              <button className="btn-secondary col-span-full">سجّل السعر</button>
            </form>
          )}
          <ul className="text-sm flex flex-col gap-1">
            {prices.data?.prices.map((p) => <li key={p.id} className="flex justify-between font-bold border-b border-united-dark/5 py-1"><span>{p.product.nameAr ?? p.product.name} · {p.uomCode}</span><span dir="ltr">{p.unitPrice} · من {p.validFrom}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
