"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPatch, apiPost, ApiClientError, errorMessage } from "@/lib/api-client";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useToast } from "@/components/ui/Toast";
import { usePermissions } from "@/lib/use-session";
import { invalidateStockData } from "@/lib/stockInvalidation";
import { Field, Tabs, fmtMoney, fmtQty, LOCATION_TYPE_LABEL, useLocations, type StockRow } from "./shared";
import { MoveForms } from "./MoveForms";

/**
 * The stock controller's screen: what is where, what is free to sell, what is about
 * to expire, what did not add up when an order left — and the forms that move stock.
 * Supervisors additionally see value. Everything shown is derived from the ledger on
 * the server; this screen never adds quantities itself.
 */

type Tab = "stock" | "move" | "expiring" | "exceptions" | "documents" | "valuation";

export function InventoryView() {
  const { can, isLoading } = usePermissions();
  const [tab, setTab] = useState<Tab>("stock");
  const [productId, setProductId] = useState<string | null>(null);

  // Deep links: /stock/inventory?tab=exceptions, ?doc=<id> (from the approvals inbox).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("tab") as Tab | null;
    if (t) setTab(t);
    if (sp.get("doc")) setTab("documents");
    if (sp.get("product")) setProductId(sp.get("product"));
  }, []);

  const exceptions = useQuery({
    queryKey: ["stock", "inventory", "exceptions", "open"],
    queryFn: () => apiFetch<{ exceptions: ExceptionDTO[] }>("/api/inventory/exceptions"),
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingState />;
  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "stock", label: "الرصيد" },
    { key: "move", label: "حركة" },
    { key: "expiring", label: "قرب الانتهاء" },
    { key: "exceptions", label: "فروقات الصرف", badge: exceptions.data?.exceptions.length },
    { key: "documents", label: "المستندات" },
    ...(can("stock.valuation.view") ? [{ key: "valuation" as Tab, label: "قيمة المخزون" }] : []),
  ];

  return (
    <div className="p-4 max-w-5xl mx-auto pb-10 flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-united-dark">إدارة المخزون</h1>
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {productId ? (
        <ProductPanel productId={productId} onClose={() => setProductId(null)} />
      ) : (
        <>
          {tab === "stock" && <StockList onOpen={setProductId} />}
          {tab === "move" && <MoveForms />}
          {tab === "expiring" && <Expiring onOpen={setProductId} />}
          {tab === "exceptions" && <Exceptions />}
          {tab === "documents" && <Documents />}
          {tab === "valuation" && <Valuation />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StockList({ onOpen }: { onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const q = useQuery({
    queryKey: ["stock", "inventory", "stock"],
    queryFn: () => apiFetch<{ warehouse: { code: string; name: string }; rows: StockRow[] }>("/api/inventory/stock"),
    refetchInterval: 20_000,
  });
  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (q.data?.rows ?? []).filter((r) => (!onlyLow || r.belowReorder) && (!f || r.productName.toLowerCase().includes(f) || (r.productNameAr ?? "").includes(f)));
  }, [q.data, filter, onlyLow]);
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const showValue = rows.some((r) => r.stockValue !== null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input className="field" placeholder="دوّر على صنف" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button type="button" onClick={() => setOnlyLow(!onlyLow)} className={`tap-target shrink-0 rounded-xl px-4 font-extrabold text-sm ${onlyLow ? "bg-united-warn text-white" : "bg-united-dark/5 text-united-dark"}`}>
          تحت حد الطلب
        </button>
      </div>
      <p className="text-xs font-bold text-united-muted">{q.data?.warehouse.name} · المتاح = الموجود − المحجوز − الحجر</p>
      {rows.length === 0 && <EmptyState icon="📦" title="مفيش أصناف" />}
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.productId}>
            <button type="button" onClick={() => onOpen(r.productId)} className="card p-4 w-full text-start flex flex-col gap-2 active:scale-[0.99] transition">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-united-dark">{r.productNameAr ?? r.productName}</span>
                {r.belowMin ? (
                  <span className="rounded-full bg-united-danger/10 text-united-danger px-2 text-xs font-extrabold">تحت الحد الأدنى</span>
                ) : r.belowReorder ? (
                  <span className="rounded-full bg-united-warn/10 text-united-warn px-2 text-xs font-extrabold">اطلب</span>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="موجود" value={fmtQty(r.onHand)} />
                <Stat label="محجوز" value={fmtQty(r.reserved)} />
                <Stat label="متاح" value={fmtQty(r.available)} strong />
              </div>
              <div className="flex justify-between text-xs font-bold text-united-muted">
                <span>{r.unit}</span>
                {showValue && <span dir="ltr">{fmtMoney(r.stockValue)}</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl px-2 py-2 ${strong ? "bg-united-green/10" : "bg-united-dark/[0.03]"}`}>
      <div className="text-[11px] font-extrabold text-united-muted">{label}</div>
      <div dir="ltr" className={`font-extrabold ${strong ? "text-united-green text-lg" : "text-united-dark"}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Bucket = { locationId: string; locationCode: string; locationType: string; lotId: string | null; lotNumber: string | null; receivedDate: string | null; expiryDate: string | null; quantity: string };
type ProductDetail = {
  product: {
    id: string; name: string; nameAr: string | null; unit: string; version: number;
    shelfLifeDays: number | null; removalStrategy: string; costingMethod: string; standardCost: string | null; coldChain: boolean;
    reorderPointQty: string | null; minStockQty: string | null; maxStockQty: string | null;
    packagings: { id: string; uomCode: string; qtyInBaseUnit: string; active: boolean; uom: { nameAr: string | null; name: string } }[];
  };
  onHand: string; quarantined: string; expired: string; sellableOnHand: string; reserved: string; available: string; today: string;
  buckets: Bucket[];
  reservations: { id: string; quantity: string; sourceType: string; sourceId: string; createdBy: string; createdAt: string }[];
  movements: { id: string; kind: string; quantity: string; occurredAt: string; actorName: string; unitCost: string | null; location: { code: string }; lot: { lotNumber: string } | null; document: { number: string } | null; intake: { receiptNumber: string } | null }[];
  valuation: { averageCost: string | null; value: string } | null;
};

const KIND_LABEL: Record<string, string> = {
  intake: "استلام", intake_correction: "تصحيح استلام", intake_void: "إلغاء استلام", adjustment: "تسوية",
  transfer_out: "تحويل (خارج)", transfer_in: "تحويل (داخل)", issue: "صرف لأوردر", customer_return: "مرتجع عميل",
  supplier_return: "مرتجع لمورد", scrap: "هالك",
};

function ProductPanel({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { can } = usePermissions();
  const q = useQuery({
    queryKey: ["stock", "inventory", "product", productId],
    queryFn: () => apiFetch<ProductDetail>(`/api/inventory/products/${productId}`),
    refetchInterval: 20_000,
  });
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const d = q.data;
  const u = d.product.unit;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold text-united-dark">{d.product.nameAr ?? d.product.name}</h2>
        <button type="button" className="btn-secondary" onClick={onClose}>رجوع</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <Stat label="موجود" value={fmtQty(d.onHand, u)} />
        <Stat label="في الحجر" value={fmtQty(d.quarantined, u)} />
        <Stat label="منتهي الصلاحية" value={fmtQty(d.expired, u)} />
        <Stat label="محجوز" value={fmtQty(d.reserved, u)} />
        <Stat label="متاح" value={fmtQty(d.available, u)} strong />
      </div>
      {d.valuation && (
        <div className="card p-3 flex justify-between font-extrabold">
          <span>القيمة: <span dir="ltr">{fmtMoney(d.valuation.value)}</span></span>
          <span>متوسط التكلفة: <span dir="ltr">{d.valuation.averageCost ?? "—"}</span></span>
        </div>
      )}

      <section className="card p-4 flex flex-col gap-2">
        <h3 className="font-extrabold text-united-dark">فين الرصيد (بترتيب الصرف {d.product.removalStrategy === "fefo" ? "FEFO" : "FIFO"})</h3>
        {d.buckets.length === 0 && <p className="text-sm font-bold text-united-muted">مفيش رصيد.</p>}
        <ul className="flex flex-col divide-y divide-united-dark/5">
          {d.buckets.map((b) => (
            <BucketRow key={`${b.locationId}:${b.lotId}`} b={b} unit={u} today={d.today} canEditLot={can("stock.sort")} />
          ))}
        </ul>
      </section>

      {d.reservations.length > 0 && (
        <section className="card p-4 flex flex-col gap-2">
          <h3 className="font-extrabold text-united-dark">حجوزات</h3>
          {d.reservations.map((r) => (
            <ReservationRow key={r.id} r={r} unit={u} canRelease={can("stock.reserve")} />
          ))}
        </section>
      )}

      {can("stock.manage_products") && <ProductSettings d={d} />}

      <section className="card p-4 flex flex-col gap-2">
        <h3 className="font-extrabold text-united-dark">آخر الحركات</h3>
        <ul className="flex flex-col divide-y divide-united-dark/5 text-sm">
          {d.movements.map((m) => (
            <li key={m.id} className="py-2 flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-extrabold">{KIND_LABEL[m.kind] ?? m.kind} · {m.document?.number ?? m.intake?.receiptNumber ?? ""}</span>
                <span className="text-xs font-bold text-united-muted">{m.location.code}{m.lot ? ` · ${m.lot.lotNumber}` : ""} · {m.actorName} · {new Date(m.occurredAt).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <span dir="ltr" className={`font-extrabold ${Number(m.quantity) < 0 ? "text-united-danger" : "text-united-green"}`}>{Number(m.quantity) > 0 ? "+" : ""}{fmtQty(m.quantity)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function BucketRow({ b, unit, today, canEditLot }: { b: Bucket; unit: string; today: string; canEditLot: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [expiry, setExpiry] = useState(b.expiryDate ?? "");
  const [reason, setReason] = useState("");
  const expired = b.expiryDate && b.expiryDate < today;
  return (
    <li className="py-2 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-extrabold">{b.locationCode} <span className="text-xs text-united-muted">({LOCATION_TYPE_LABEL[b.locationType] ?? b.locationType})</span></span>
          <span className="text-xs font-bold text-united-muted">
            {b.lotNumber ?? "رصيد قبل الدفعات"}
            {b.expiryDate && <span className={expired ? "text-united-danger" : ""}> · صلاحية {b.expiryDate}</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span dir="ltr" className="font-extrabold">{fmtQty(b.quantity, unit)}</span>
          {canEditLot && b.lotId && (
            <button type="button" className="text-xs font-extrabold text-united-green underline" onClick={() => setEditing(!editing)}>الصلاحية</button>
          )}
        </div>
      </div>
      {editing && b.lotId && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiPatch(`/api/inventory/lots/${b.lotId}`, { expiry_date: expiry || null, reason });
              invalidateStockData(qc);
              toast.show("اتعدلت الصلاحية", "success");
              setEditing(false);
            } catch (err) {
              toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
            }
          }}
        >
          <input type="date" className="field flex-1" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          <input className="field flex-[2]" placeholder="السبب (مطلوب)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn-primary">حفظ</button>
        </form>
      )}
    </li>
  );
}

function ReservationRow({ r, unit, canRelease }: { r: ProductDetail["reservations"][number]; unit: string; canRelease: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2 border-b border-united-dark/5 pb-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold">{r.sourceType === "order" ? "أوردر" : "يدوي"} · {r.createdBy}</span>
        <span className="flex items-center gap-2">
          <span dir="ltr" className="font-extrabold">{fmtQty(r.quantity, unit)}</span>
          {canRelease && <button type="button" className="text-xs font-extrabold text-united-danger underline" onClick={() => setOpen(!open)}>فك الحجز</button>}
        </span>
      </div>
      {open && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiPost(`/api/inventory/reservations/${r.id}/release`, { reason });
              invalidateStockData(qc);
              toast.show("اتفك الحجز", "success");
            } catch (err) {
              toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
            }
          }}
        >
          <input className="field" placeholder="السبب (مطلوب)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn-danger">فك</button>
        </form>
      )}
    </div>
  );
}

function ProductSettings({ d }: { d: ProductDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { uoms } = useLocations();
  const p = d.product;
  const [form, setForm] = useState({
    shelf_life_days: p.shelfLifeDays?.toString() ?? "",
    removal_strategy: p.removalStrategy,
    reorder_point_qty: p.reorderPointQty ?? "",
    min_stock_qty: p.minStockQty ?? "",
    max_stock_qty: p.maxStockQty ?? "",
    cold_chain: p.coldChain,
  });
  const [pack, setPack] = useState({ uom: "", qty: "" });
  const set = (k: keyof typeof form, v: string | boolean) => setForm({ ...form, [k]: v });
  const blankToNull = (v: string) => (v.trim() === "" ? null : v.trim());
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPatch(`/api/inventory/products/${p.id}/settings`, {
        shelf_life_days: form.shelf_life_days.trim() === "" ? null : Number(form.shelf_life_days),
        removal_strategy: form.removal_strategy,
        reorder_point_qty: blankToNull(form.reorder_point_qty),
        min_stock_qty: blankToNull(form.min_stock_qty),
        max_stock_qty: blankToNull(form.max_stock_qty),
        cold_chain: form.cold_chain,
        expected_version: p.version,
      });
      invalidateStockData(qc);
      toast.show("اتحفظت إعدادات الصنف", "success");
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
    }
  }
  async function addPack(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost(`/api/inventory/products/${p.id}/packagings`, { uom: pack.uom, qty_in_base_unit: pack.qty });
      invalidateStockData(qc);
      toast.show("اتحفظت التعبئة", "success");
      setPack({ uom: "", qty: "" });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
    }
  }
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-extrabold text-united-dark">إعدادات المخزون للصنف</h3>
      <form onSubmit={save} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="مدة الصلاحية (يوم)"><input className="field" inputMode="numeric" dir="ltr" value={form.shelf_life_days} onChange={(e) => set("shelf_life_days", e.target.value)} /></Field>
        <Field label="ترتيب الصرف">
          <select className="field font-bold" value={form.removal_strategy} onChange={(e) => set("removal_strategy", e.target.value)}>
            <option value="fefo">الأقرب انتهاءً أولاً (FEFO)</option>
            <option value="fifo">الأقدم استلاماً أولاً (FIFO)</option>
          </select>
        </Field>
        <Field label="حد إعادة الطلب"><input className="field" inputMode="decimal" dir="ltr" value={form.reorder_point_qty} onChange={(e) => set("reorder_point_qty", e.target.value)} /></Field>
        <Field label="الحد الأدنى"><input className="field" inputMode="decimal" dir="ltr" value={form.min_stock_qty} onChange={(e) => set("min_stock_qty", e.target.value)} /></Field>
        <Field label="الحد الأقصى"><input className="field" inputMode="decimal" dir="ltr" value={form.max_stock_qty} onChange={(e) => set("max_stock_qty", e.target.value)} /></Field>
        <label className="tap-target flex items-center gap-2 font-extrabold">
          <input type="checkbox" className="w-6 h-6" checked={form.cold_chain} onChange={(e) => set("cold_chain", e.target.checked)} />
          سلسلة تبريد
        </label>
        <button className="btn-primary col-span-full">حفظ</button>
      </form>
      <h4 className="font-extrabold text-united-dark text-sm">التعبئة (كام {p.unit} في كل وحدة)</h4>
      <ul className="flex flex-wrap gap-2">
        {p.packagings.map((x) => (
          <li key={x.id} className="rounded-xl bg-united-dark/5 px-3 py-2 text-sm font-extrabold" dir="ltr">
            1 {x.uomCode} = {fmtQty(x.qtyInBaseUnit)} {p.unit}{x.active ? "" : " (موقوفة)"}
          </li>
        ))}
      </ul>
      <form onSubmit={addPack} className="flex gap-2">
        <select className="field font-bold" value={pack.uom} onChange={(e) => setPack({ ...pack, uom: e.target.value })}>
          <option value="">الوحدة</option>
          {uoms.filter((x) => x.code !== p.unit).map((x) => (
            <option key={x.code} value={x.code}>{x.nameAr ?? x.name} ({x.code})</option>
          ))}
        </select>
        <input className="field" inputMode="decimal" dir="ltr" placeholder={`كام ${p.unit}`} value={pack.qty} onChange={(e) => setPack({ ...pack, qty: e.target.value })} />
        <button className="btn-secondary shrink-0">إضافة</button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Expiring({ onOpen }: { onOpen: (id: string) => void }) {
  const [days, setDays] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["stock", "inventory", "expiring", days],
    queryFn: () =>
      apiFetch<{ today: string; until: string; rows: { lotId: string; lotNumber: string; expiryDate: string; expired: boolean; daysLeft: number; product: { id: string; name: string; nameAr: string | null; unit: string }; supplier: string | null; locationCode: string; quantity: string }[] }>(
        `/api/inventory/reports/expiring${days !== null ? `?days=${days}` : ""}`
      ),
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={String(days ?? "default")}
        onChange={(v) => setDays(v === "default" ? null : Number(v))}
        items={[{ key: "default", label: "الافتراضي" }, { key: "0", label: "النهارده" }, { key: "3", label: "3 أيام" }, { key: "7", label: "أسبوع" }]}
      />
      {q.data.rows.length === 0 && <EmptyState icon="🍃" title={`مفيش حاجة هتنتهي لحد ${q.data.until}`} />}
      <ul className="flex flex-col gap-2">
        {q.data.rows.map((r) => (
          <li key={`${r.lotId}:${r.locationCode}`}>
            <button type="button" onClick={() => onOpen(r.product.id)} className={`card p-3 w-full text-start flex items-center justify-between gap-2 ${r.expired ? "border-2 border-united-danger/40" : ""}`}>
              <div className="flex flex-col">
                <span className="font-extrabold">{r.product.nameAr ?? r.product.name}</span>
                <span className="text-xs font-bold text-united-muted">{r.lotNumber} · {r.locationCode}{r.supplier ? ` · ${r.supplier}` : ""}</span>
              </div>
              <div className="flex flex-col items-end">
                <span dir="ltr" className="font-extrabold">{fmtQty(r.quantity, r.product.unit)}</span>
                <span className={`text-xs font-extrabold ${r.expired ? "text-united-danger" : r.daysLeft <= 1 ? "text-united-warn" : "text-united-muted"}`}>
                  {r.expired ? `منتهي من ${-r.daysLeft} يوم` : r.daysLeft === 0 ? "بينتهي النهارده" : `باقي ${r.daysLeft} يوم`}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

type ExceptionDTO = {
  id: string; orderId: string; productName: string; unit: string; requestedQty: string; issuedQty: string;
  reason: "unmapped" | "unit_mismatch" | "insufficient"; status: string; resolution: string | null; resolvedBy: string | null; version: number; createdAt: string;
  order: { orderNumber: string; customerName: string; deliveryDate: string };
  document: { number: string } | null;
};
const EXCEPTION_REASON: Record<ExceptionDTO["reason"], string> = {
  unmapped: "الصنف مش متربط بدليل الأصناف",
  unit_mismatch: "الوحدة مش بتتحول لوحدة الصنف",
  insufficient: "الرصيد المسجل كان أقل من اللي خرج",
};

function Exceptions() {
  const { can } = usePermissions();
  const [status, setStatus] = useState<"open" | "resolved" | "voided">("open");
  const q = useQuery({
    queryKey: ["stock", "inventory", "exceptions", status],
    queryFn: () => apiFetch<{ exceptions: ExceptionDTO[] }>(`/api/inventory/exceptions?status=${status}`),
    refetchInterval: 30_000,
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold text-united-muted">أوردرات خرجت والمخزون المسجل ماكفاش أو الصنف مش معروف. كل فرق لازم يتفسر: استلام اتسجل متأخر، جرد، أو ربط الصنف.</p>
      <Tabs value={status} onChange={setStatus} items={[{ key: "open", label: "مفتوحة" }, { key: "resolved", label: "اتحلت" }, { key: "voided", label: "اتلغت" }]} />
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && q.data.exceptions.length === 0 && <EmptyState icon="✅" title="مفيش فروقات" />}
      <ul className="flex flex-col gap-2">
        {q.data?.exceptions.map((x) => (
          <ExceptionCard key={x.id} x={x} canResolve={can("stock.adjust") && x.status === "open"} />
        ))}
      </ul>
    </div>
  );
}

function ExceptionCard({ x, canResolve }: { x: ExceptionDTO; canResolve: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState("");
  return (
    <li className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-extrabold">{x.productName}</span>
        <span className="text-xs font-bold text-united-muted">أوردر {x.order.orderNumber} · {x.order.customerName}</span>
      </div>
      <p className="text-sm font-bold text-united-warn">{EXCEPTION_REASON[x.reason]}</p>
      <p className="text-sm font-bold" dir="rtl">
        خرج <span dir="ltr">{fmtQty(x.requestedQty, x.unit)}</span> · اتصرف من الدفاتر <span dir="ltr">{fmtQty(x.issuedQty, x.unit)}</span>
        {x.document ? ` · ${x.document.number}` : ""}
      </p>
      {x.resolution && <p className="text-sm text-united-muted font-bold">الحل: {x.resolution} {x.resolvedBy ? `— ${x.resolvedBy}` : ""}</p>}
      {canResolve && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiPost(`/api/inventory/exceptions/${x.id}/resolve`, { resolution: text, expected_version: x.version });
              invalidateStockData(qc);
              toast.show("اتقفل الفرق", "success");
            } catch (err) {
              toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
            }
          }}
        >
          <input className="field" placeholder="إزاي اتحل؟ (مطلوب)" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-primary shrink-0">قفل</button>
        </form>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------

type DocumentDTO = {
  id: string; number: string; type: string; status: string; businessDate: string; reason: string | null; createdBy: string; reversalOfId: string | null;
  movements: { id: string; quantity: string; kind: string; location: { code: string }; lot: { lotNumber: string } | null; product: { name: string; unit: string } }[];
};
const DOC_TYPE: Record<string, string> = { transfer: "تحويل", adjustment: "تسوية", scrap: "هالك", customer_return: "مرتجع عميل", supplier_return: "مرتجع مورد", issue: "صرف" };
const DOC_STATUS: Record<string, { label: string; cls: string }> = {
  posted: { label: "متسجل", cls: "bg-united-green/10 text-united-green" },
  pending_approval: { label: "مستني موافقة", cls: "bg-united-warn/10 text-united-warn" },
  rejected: { label: "مرفوض", cls: "bg-united-danger/10 text-united-danger" },
  reversed: { label: "اتلغى", cls: "bg-united-dark/5 text-united-muted" },
};

function Documents() {
  const { can } = usePermissions();
  const [type, setType] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  useEffect(() => setHighlight(new URLSearchParams(window.location.search).get("doc")), []);
  const q = useQuery({
    queryKey: ["stock", "inventory", "documents", type],
    queryFn: () => apiFetch<{ documents: DocumentDTO[] }>(`/api/inventory/documents?limit=100${type ? `&type=${type}` : ""}`),
    refetchInterval: 30_000,
  });
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={type} onChange={setType} items={[{ key: "", label: "الكل" }, ...Object.entries(DOC_TYPE).map(([k, v]) => ({ key: k, label: v }))]} />
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && q.data.documents.length === 0 && <EmptyState icon="🗂️" title="مفيش مستندات" />}
      <ul className="flex flex-col gap-2">
        {q.data?.documents.map((d) => (
          <DocumentCard key={d.id} d={d} highlight={d.id === highlight} canReverse={can("stock.adjust") && d.status === "posted" && d.type !== "issue" && !d.reversalOfId} />
        ))}
      </ul>
    </div>
  );
}

function DocumentCard({ d, highlight, canReverse }: { d: DocumentDTO; highlight: boolean; canReverse: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(highlight);
  const [reason, setReason] = useState("");
  const st = DOC_STATUS[d.status] ?? { label: d.status, cls: "" };
  return (
    <li className={`card p-4 flex flex-col gap-2 ${highlight ? "border-2 border-united-green" : ""}`}>
      <button type="button" className="flex items-center justify-between gap-2 text-start" onClick={() => setOpen(!open)}>
        <span className="font-extrabold" dir="ltr">{d.number}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs font-bold text-united-muted">{DOC_TYPE[d.type] ?? d.type} · {d.businessDate}</span>
          <span className={`rounded-full px-2 text-xs font-extrabold ${st.cls}`}>{st.label}</span>
        </span>
      </button>
      {d.reason && <p className="text-sm font-bold text-united-muted">{d.reason} — {d.createdBy}</p>}
      {open && (
        <>
          <ul className="text-sm flex flex-col gap-1">
            {d.movements.map((m) => (
              <li key={m.id} className="flex justify-between">
                <span className="font-bold">{m.product.name} · {m.location.code}{m.lot ? ` · ${m.lot.lotNumber}` : ""}</span>
                <span dir="ltr" className="font-extrabold">{fmtQty(m.quantity, m.product.unit)}</span>
              </li>
            ))}
            {d.movements.length === 0 && <li className="text-united-muted font-bold">مفيش حركة لسه (مستني موافقة أو مرفوض)</li>}
          </ul>
          {canReverse && (
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const res = await apiPost<{ document: { number: string } }>(`/api/inventory/documents/${d.id}/reverse`, { reason });
                  invalidateStockData(qc);
                  toast.show(`اتلغى بـ ${res.document.number}`, "success");
                } catch (err) {
                  toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
                }
              }}
            >
              <input className="field" placeholder="سبب الإلغاء (مطلوب)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="btn-danger shrink-0">إلغاء المستند</button>
            </form>
          )}
        </>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------

function Valuation() {
  const q = useQuery({
    queryKey: ["stock", "inventory", "valuation"],
    queryFn: () =>
      apiFetch<{ totalValue: string; rows: { productId: string; productName: string; productNameAr: string | null; unit: string; costingMethod: string; quantity: string; value: string; averageCost: string | null; receivedWithoutCost: string }[] }>(
        "/api/inventory/reports/valuation"
      ),
  });
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4 flex justify-between font-extrabold text-lg">
        <span>إجمالي قيمة المخزون</span>
        <span dir="ltr">{fmtMoney(q.data.totalValue)}</span>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-united-muted text-xs">
              <th className="p-2 text-start">الصنف</th><th className="p-2">الطريقة</th><th className="p-2">الكمية</th><th className="p-2">متوسط التكلفة</th><th className="p-2">القيمة</th><th className="p-2">اتسجل من غير تكلفة</th>
            </tr>
          </thead>
          <tbody>
            {q.data.rows.map((r) => (
              <tr key={r.productId} className="border-t border-united-dark/5 font-bold">
                <td className="p-2">{r.productNameAr ?? r.productName}</td>
                <td className="p-2 text-center uppercase">{r.costingMethod}</td>
                <td className="p-2 text-center" dir="ltr">{fmtQty(r.quantity, r.unit)}</td>
                <td className="p-2 text-center" dir="ltr">{r.averageCost ?? "—"}</td>
                <td className="p-2 text-center" dir="ltr">{fmtMoney(r.value)}</td>
                <td className="p-2 text-center" dir="ltr">{Number(r.receivedWithoutCost) > 0 ? fmtQty(r.receivedWithoutCost, r.unit) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs font-bold text-united-muted">"اتسجل من غير تكلفة" = كميات اتسجلت قبل تسجيل الأسعار أو من غير سعر؛ دخلت المخزون بقيمة صفر، فمتوسط التكلفة بيكون أقل من الحقيقي لحد ما تخلص.</p>
    </div>
  );
}
