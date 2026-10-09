"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, ApiClientError, errorMessage } from "@/lib/api-client";
import { LoadingState, EmptyState, ErrorState } from "@/components/States";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { useToast } from "@/components/ui/Toast";
import { MovementRow } from "@/components/stock/MovementRow";
import { invalidateStockData } from "@/lib/stockInvalidation";
import { fmtKg } from "@/lib/stockPresentation";
import { todayLocalISO } from "@/lib/localDate";
import type { MovementDTO, StockBalanceDTO } from "@/lib/stock-client-types";

export function LedgerView() {
  const [productId, setProductId] = useState("");
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["stock", "ledger", productId],
    queryFn: () =>
      apiFetch<{ movements: MovementDTO[]; currentStock: StockBalanceDTO[] }>(
        `/api/stock/ledger?limit=100${productId ? `&product_id=${productId}` : ""}`
      ),
    refetchInterval: 20_000,
  });

  const stock = data?.currentStock ?? [];
  const selected = stock.find((s) => s.productId === productId);

  return (
    <div className="p-4 max-w-3xl mx-auto pb-10 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-united-dark">سجل الحركات</h1>
        <LiveIndicator dataUpdatedAt={dataUpdatedAt} isLoading={isLoading} />
      </div>

      <p className="text-xs font-bold text-united-muted -mt-2">
        سجل مضاف عليه بس — مفيش تعديل ولا مسح. أي تصحيح بيتسجل كقيد جديد.
      </p>

      {stock.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          <FilterChip active={productId === ""} onClick={() => setProductId("")} label="الكل" />
          {stock.map((s) => (
            <FilterChip
              key={s.productId}
              active={productId === s.productId}
              onClick={() => setProductId(s.productId)}
              label={`${s.productName} · ${fmtKg(s.balanceKg)}`}
            />
          ))}
        </div>
      )}

      {selected && (
        <div className="card p-4 flex items-center justify-between">
          <span className="font-extrabold text-united-dark">رصيد {selected.productName}</span>
          <span dir="ltr" className="text-2xl font-extrabold text-united-green">
            {fmtKg(selected.balanceKg)} {selected.unit}
          </span>
        </div>
      )}

      <AdjustmentForm products={stock} />

      <section className="card p-4">
        {isLoading && <LoadingState />}
        {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !isError && (data?.movements.length ?? 0) === 0 && (
          <EmptyState icon="🧾" title="مفيش حركات مسجلة" />
        )}
        <ul className="flex flex-col divide-y divide-united-border">
          {data?.movements.map((m) => (
            <MovementRow key={m.id} movement={m} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-4 py-2 rounded-full text-sm font-extrabold whitespace-nowrap shrink-0 transition ${
        active ? "bg-united-green text-white" : "bg-united-dark/5 text-united-dark hover:bg-united-dark/10"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Manual stock correction — a stock count that disagrees with the ledger, spoilage, a
 * receipt that was never entered. Reason is mandatory because an unexplained balance
 * change is exactly the thing a ledger exists to prevent.
 */
function AdjustmentForm({ products }: { products: StockBalanceDTO[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary self-start text-sm">
        ⚖️ تسوية مخزون
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const n = Number(qty);
    if (!productId) return setError("اختار الصنف");
    if (!Number.isFinite(n) || n === 0) return setError("دخّل كمية موجبة أو سالبة (مش صفر)");
    if (!reason.trim()) return setError("لازم تكتب سبب التسوية");
    setBusy(true);
    try {
      await apiPost("/api/stock/adjustments", {
        product_id: productId,
        quantity_kg: n,
        effective_date: todayLocalISO(),
        reason,
      });
      await invalidateStockData(qc);
      toast.show("اتسجلت التسوية", "success");
      setQty("");
      setReason("");
      setOpen(false);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "حصل خطأ";
      setError(msg);
      toast.show(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4 flex flex-col gap-3">
      <h2 className="font-extrabold text-united-dark">تسوية مخزون</h2>
      {error && <p className="text-united-danger font-bold text-sm">{error}</p>}
      <select value={productId} onChange={(e) => setProductId(e.target.value)} className="field font-bold">
        <option value="">— اختار الصنف —</option>
        {products.map((p) => (
          <option key={p.productId} value={p.productId}>
            {p.productName} ({fmtKg(p.balanceKg)} {p.unit})
          </option>
        ))}
      </select>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        placeholder="الكمية (+ زيادة / − نقص)"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        className="field text-center text-xl font-extrabold"
      />
      <input
        placeholder="سبب التسوية (إجباري)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="field"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary flex-1 text-sm">
          سجّل التسوية
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 text-sm">
          رجوع
        </button>
      </div>
    </form>
  );
}
