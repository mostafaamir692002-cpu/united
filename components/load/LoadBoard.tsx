"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, ApiClientError, errorMessage } from "@/lib/api-client";
import type { OrderDTO } from "@/lib/client-types";
import { OrderCard } from "@/components/OrderCard";
import { EmptyState, ErrorState } from "@/components/States";
import { BoardSkeleton } from "@/components/Skeleton";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { useToast } from "@/components/ui/Toast";
import { orderUrgency } from "@/lib/orderPresentation";
import { invalidateDerivedOrderData } from "@/lib/queryInvalidation";
import { applyOrderToCache } from "@/lib/orderCache";
import { useReadyForLoadingAlert } from "@/lib/liveAlerts";
import { useOperationalSettings } from "@/lib/use-operational-settings";

const URGENCY_RANK = { late: 0, soon: 1, ok: 2, none: 3 } as const;

export function LoadBoard() {
  const ops = useOperationalSettings();
  const qc = useQueryClient();
  const toast = useToast();
  const [vehicle, setVehicle] = useState("");
  const [driverName, setDriverName] = useState("");
  const [crateCounts, setCrateCounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch every non-final order so a brand-new order is visible here the instant it
  // arrives (read-only until it's actually ready to load), not just once it reaches
  // ready_for_loading — the loader tablet should show the same live picture as everyone else.
  const { data, isLoading, isError, error: queryError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["orders", "load"],
    queryFn: () =>
      apiFetch<{ orders: OrderDTO[] }>(
        "/api/orders?status=new,preparing,ready_for_loading,loading,loaded"
      ),
    refetchInterval: 3000,
  });

  useReadyForLoadingAlert(data?.orders);

  const orders = data?.orders ?? [];
  const upcoming = [...orders].filter((o) => o.status === "new" || o.status === "preparing");
  const active = [...orders]
    .filter((o) => o.status === "ready_for_loading" || o.status === "loading")
    .sort((a, b) => {
      const ua = URGENCY_RANK[orderUrgency(a.status, a.deliveryDate, a.deliveryTime, ops.deliverySoonMinutes)];
      const ub = URGENCY_RANK[orderUrgency(b.status, b.deliveryDate, b.deliveryTime, ops.deliverySoonMinutes)];
      return ua - ub;
    });
  const readyToDispatch = orders.filter((o) => o.status === "loaded");
  const canDispatch =
    vehicle.trim() &&
    driverName.trim() &&
    readyToDispatch.length > 0 &&
    readyToDispatch.every((o) => Number(crateCounts[o.id]) > 0);

  async function dispatchAll() {
    if (busy) return;
    if (
      !window.confirm(
        `متأكد العربية "${vehicle.trim()}" مع السواق "${driverName.trim()}" هتاخد ${readyToDispatch.length} أوردر دلوقتي؟`
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      for (const o of readyToDispatch) {
        const { order } = await apiPost<{ order: OrderDTO }>(`/api/orders/${o.id}/status`, {
          to: "dispatched",
          expected_version: o.version,
          vehicle: vehicle.trim(),
          driver_name: driverName.trim(),
          crate_count: Number(crateCounts[o.id]),
        });
        // Each dispatch is applied as it returns, so the board empties order by order
        // instead of sitting still until the whole run finishes and then reloading.
        applyOrderToCache(qc, order);
      }
      invalidateDerivedOrderData(qc);
      toast.show(`العربية خرجت 🚚 (${readyToDispatch.length} أوردر)`, "success");
      setVehicle("");
      setDriverName("");
      setCrateCounts({});
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "حصل خطأ";
      setError(msg);
      toast.show(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-extrabold text-united-dark">أوردرات التحميل</h1>
        <LiveIndicator dataUpdatedAt={dataUpdatedAt} isLoading={isLoading} />
      </div>

      {isLoading && <BoardSkeleton />}
      {isError && <ErrorState message={errorMessage(queryError)} onRetry={() => refetch()} />}
      {!isLoading &&
        !isError &&
        active.length === 0 &&
        readyToDispatch.length === 0 &&
        upcoming.length === 0 && <EmptyState icon="👍" title="مفيش أوردرات جاهزة للتحميل دلوقتي" />}

      {active.length > 0 && (
        <div className="mt-3">
          <h2 className="text-sm font-extrabold text-united-muted mb-2">🟢 جاهز / بيتحمّل دلوقتي</h2>
          <div className="flex flex-col gap-3">
            {active.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-extrabold text-united-muted mb-2">لسه بيتجهز — للمتابعة بس</h2>
          <div className="flex flex-col gap-3 opacity-80">
            {upcoming.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </div>
      )}

      {readyToDispatch.length > 0 && (
        <div className="mt-8 card p-5">
          <h2 className="text-xl font-extrabold mb-3 text-united-dark">🚚 العربية</h2>
          <ul className="flex flex-col gap-2 mb-4">
            {readyToDispatch.map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                <span className="text-united-green text-xl shrink-0">✓</span>
                <span className="font-bold flex-1 min-w-0 truncate">{o.customerName}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="برنيكة"
                  value={crateCounts[o.id] ?? ""}
                  onChange={(e) => setCrateCounts((c) => ({ ...c, [o.id]: e.target.value }))}
                  className="w-20 tap-target border-2 border-united-dark/10 rounded-lg px-2 text-center focus:border-united-green outline-none shrink-0"
                />
              </li>
            ))}
          </ul>
          <p className="mb-3 font-bold text-united-dark">إجمالي الأوردرات: {readyToDispatch.length}</p>
          <input
            placeholder="اسم السواق"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            className="field mb-3"
          />
          <input
            placeholder="رقم/اسم العربية"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            className="field mb-3"
          />
          {error && <p className="text-united-danger font-bold mb-2">{error}</p>}
          <button disabled={busy || !canDispatch} onClick={dispatchAll} className="btn-dark w-full text-xl">
            العربية جاهزة 🚚
          </button>
        </div>
      )}
    </div>
  );
}
