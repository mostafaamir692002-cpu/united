"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { usePermissions } from "@/lib/use-session";
import { newClientKey } from "@/lib/clientKey";
import { invalidateStockData } from "@/lib/stockInvalidation";
import type { SupplierDTO } from "@/lib/stock-client-types";
import { Field, LocationSelect, ProductSelect, Tabs } from "./shared";

/**
 * Stock movements, one form each, built for a tablet on the warehouse floor:
 * pick the product, the place, type the number, say why. Every form sends a fresh
 * idempotency key per attempt, so a double tap or a retry on a bad connection never
 * posts twice; the key is renewed only after a success.
 */

type Kind = "transfer" | "count" | "scrap" | "return_customer" | "return_supplier";

const newKey = newClientKey;

export function MoveForms({ initial }: { initial?: Kind }) {
  const { can } = usePermissions();
  const kinds: { key: Kind; label: string; allowed: boolean }[] = [
    { key: "transfer", label: "تحويل بين أماكن", allowed: can("stock.transfer") },
    { key: "count", label: "جرد / تسوية", allowed: can("stock.adjust") },
    { key: "scrap", label: "هالك", allowed: can("stock.adjust") },
    { key: "return_customer", label: "مرتجع من عميل", allowed: can("stock.receive") },
    { key: "return_supplier", label: "مرتجع لمورد", allowed: can("stock.receive") },
  ];
  const allowed = kinds.filter((k) => k.allowed);
  const [kind, setKind] = useState<Kind>(initial && allowed.some((k) => k.key === initial) ? initial : allowed[0]?.key ?? "transfer");
  if (allowed.length === 0) return <p className="card p-4 font-bold text-united-muted">مالكش صلاحية تسجل حركات مخزون.</p>;
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={kind} onChange={setKind} items={allowed.map((k) => ({ key: k.key, label: k.label }))} />
      {kind === "transfer" && <TransferForm />}
      {kind === "count" && <CountForm />}
      {kind === "scrap" && <ScrapForm />}
      {kind === "return_customer" && <ReturnForm direction="customer" />}
      {kind === "return_supplier" && <ReturnForm direction="supplier" />}
    </div>
  );
}

/** Shared submit plumbing: busy state, error line, toast, stock refresh, key rotation. */
function useSubmit() {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(newKey);
  async function run(path: string, body: Record<string, unknown>, onDone: (res: any) => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<any>(path, { ...body, idempotency_key: key });
      invalidateStockData(qc);
      setKey(newKey());
      onDone(res);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "حصل خطأ";
      setError(msg);
      toast.show(msg, "error");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run, toast };
}

function QtyInput({ value, onChange, label = "الكمية" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <Field label={label}>
      <input inputMode="decimal" dir="ltr" className="field text-2xl font-extrabold text-center" value={value} onChange={(e) => onChange(e.target.value.replace(",", "."))} />
    </Field>
  );
}

function TransferForm() {
  const s = useSubmit();
  const [productId, setProductId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="card p-4 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!productId || !from || !to || !qty) return s.setError("كمّل البيانات: الصنف، من، إلى، والكمية");
        void s.run("/api/inventory/transfers", { reason: reason.trim() || undefined, lines: [{ product_id: productId, quantity: qty, location_id: from, to_location_id: to }] }, (res) => {
          s.toast.show(`اتسجل ${res.document.number}`, "success");
          setQty("");
        });
      }}
    >
      {s.error && <p className="text-united-danger font-bold text-sm">{s.error}</p>}
      <Field label="الصنف"><ProductSelect value={productId} onChange={setProductId} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="من"><LocationSelect value={from} onChange={setFrom} /></Field>
        <Field label="إلى"><LocationSelect value={to} onChange={setTo} /></Field>
      </div>
      <QtyInput value={qty} onChange={setQty} />
      <input className="field" placeholder="ملاحظة (اختياري)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn-primary w-full text-lg" disabled={s.busy}>{s.busy ? "بيتسجل..." : "سجّل التحويل"}</button>
    </form>
  );
}

function CountForm() {
  const s = useSubmit();
  const [productId, setProductId] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState<"counted" | "delta">("counted");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="card p-4 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!productId || qty === "") return s.setError("اختار الصنف واكتب الكمية");
        if (mode === "counted" && !location) return s.setError("الجرد لازم يحدد المكان");
        if (!reason.trim()) return s.setError("اكتب سبب التسوية");
        const line = mode === "counted" ? { product_id: productId, location_id: location, counted_quantity: qty } : { product_id: productId, quantity: qty, location_id: location || undefined };
        void s.run("/api/inventory/adjustments", { reason, lines: [line] }, (res) => {
          s.toast.show(res.document.status === "pending_approval" ? `${res.document.number} مستني موافقة المشرف` : `اتسجل ${res.document.number}`, "success");
          setQty("");
        });
      }}
    >
      {s.error && <p className="text-united-danger font-bold text-sm">{s.error}</p>}
      <Tabs value={mode} onChange={setMode} items={[{ key: "counted", label: "عدّيت كام فعلياً" }, { key: "delta", label: "زيادة / نقص" }]} />
      <Field label="الصنف"><ProductSelect value={productId} onChange={setProductId} /></Field>
      <Field label="المكان"><LocationSelect value={location} onChange={setLocation} allowAny={mode === "delta"} anyLabel="أي مكان" /></Field>
      <QtyInput value={qty} onChange={setQty} label={mode === "counted" ? "الكمية المعدودة" : "الفرق (سالب للنقص)"} />
      <input className="field" placeholder="السبب (مطلوب)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <p className="text-xs font-bold text-united-muted">الفرق الكبير بيستنى موافقة المشرف قبل ما يتسجل.</p>
      <button className="btn-primary w-full text-lg" disabled={s.busy}>{s.busy ? "بيتسجل..." : "سجّل"}</button>
    </form>
  );
}

function ScrapForm() {
  const s = useSubmit();
  const [productId, setProductId] = useState("");
  const [location, setLocation] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="card p-4 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!productId || !qty) return s.setError("اختار الصنف واكتب الكمية");
        if (!reason.trim()) return s.setError("اكتب سبب الهالك");
        void s.run("/api/inventory/scrap", { reason, lines: [{ product_id: productId, quantity: qty, location_id: location || undefined }] }, (res) => {
          s.toast.show(`اتسجل ${res.document.number}`, "success");
          setQty("");
        });
      }}
    >
      {s.error && <p className="text-united-danger font-bold text-sm">{s.error}</p>}
      <Field label="الصنف"><ProductSelect value={productId} onChange={setProductId} /></Field>
      <Field label="من مكان"><LocationSelect value={location} onChange={setLocation} allowAny /></Field>
      <QtyInput value={qty} onChange={setQty} />
      <input className="field" placeholder="السبب: تالف / منتهي / ... (مطلوب)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn-danger w-full text-lg" disabled={s.busy}>{s.busy ? "بيتسجل..." : "سجّل الهالك"}</button>
    </form>
  );
}

function ReturnForm({ direction }: { direction: "customer" | "supplier" }) {
  const s = useSubmit();
  const suppliers = useQuery({
    queryKey: ["stock", "suppliers"],
    queryFn: () => apiFetch<{ suppliers: SupplierDTO[] }>("/api/stock/suppliers"),
    enabled: direction === "supplier",
    staleTime: 60_000,
  });
  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [location, setLocation] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="card p-4 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!productId || !qty) return s.setError("اختار الصنف واكتب الكمية");
        if (direction === "supplier" && !supplierId) return s.setError("اختار المورد");
        if (!reason.trim()) return s.setError("اكتب سبب المرتجع");
        void s.run(
          "/api/inventory/returns",
          { direction, reason, supplier_id: supplierId || undefined, order_id: orderId.trim() || undefined, lines: [{ product_id: productId, quantity: qty, location_id: location || undefined }] },
          (res) => {
            s.toast.show(`اتسجل ${res.document.number}`, "success");
            setQty("");
          }
        );
      }}
    >
      {s.error && <p className="text-united-danger font-bold text-sm">{s.error}</p>}
      {direction === "supplier" ? (
        <Field label="المورد">
          <select className="field font-bold" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">اختار المورد</option>
            {(suppliers.data?.suppliers ?? []).map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="رقم الأوردر (اختياري)">
          <input className="field" dir="ltr" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="مثال: 20261205-003" />
        </Field>
      )}
      <Field label="الصنف"><ProductSelect value={productId} onChange={setProductId} /></Field>
      <Field label={direction === "customer" ? "يدخل مكان (افتراضي: الحجر لحد الفحص)" : "يطلع من مكان"}>
        <LocationSelect value={location} onChange={setLocation} allowAny anyLabel={direction === "customer" ? "الحجر / الاستلام (افتراضي)" : "أي مكان (FEFO)"} />
      </Field>
      <QtyInput value={qty} onChange={setQty} />
      <input className="field" placeholder="السبب (مطلوب)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn-primary w-full text-lg" disabled={s.busy}>{s.busy ? "بيتسجل..." : "سجّل المرتجع"}</button>
    </form>
  );
}
