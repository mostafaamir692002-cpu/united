"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { OrderDTO, OperationalIntelligenceDTO } from "@/lib/client-types";
import { OrderCard } from "@/components/OrderCard";
import { CreateOrderForm } from "./CreateOrderForm";
import { PipelineFunnel } from "./PipelineFunnel";
import { OperationalHealthBanner } from "./OperationalHealthBanner";
import { NeedsAttentionQueue } from "./NeedsAttentionQueue";
import { LoadingState, EmptyState, ErrorState } from "@/components/States";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import {
  needsSupervisorAction,
  isWaitingTooLong,
  isStalledInProgress,
} from "@/lib/orderPresentation";
import type { OrderStatus } from "@/lib/types";
import { useNewOrderAlert, useAttentionAlert, useStalledAlert } from "@/lib/liveAlerts";
import { useOperationalSettings } from "@/lib/use-operational-settings";

type QuickFilter = "all" | "attention" | "waiting" | "stalled" | "cancelled";

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "attention", label: "🔴 فيه مشاكل" },
  { key: "waiting", label: "⏳ مستنية حد يبدأ فيها" },
  { key: "stalled", label: "⏸️ متوقفة من فترة" },
  { key: "cancelled", label: "ملغي" },
];

const SORTS = [
  { key: "priority", label: "الأهم الأول" },
  { key: "delivery", label: "معاد التسليم" },
  { key: "newest", label: "الأحدث" },
] as const;

function matchesSearch(o: OrderDTO, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    o.customerName.toLowerCase().includes(needle) ||
    o.orderNumber.toLowerCase().includes(needle) ||
    (o.externalId ?? "").toLowerCase().includes(needle)
  );
}

export function SupervisorBoard() {
  const ops = useOperationalSettings();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("priority");
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["orders", "supervisor"],
    queryFn: () =>
      apiFetch<{ orders: OrderDTO[]; intelligence: OperationalIntelligenceDTO }>(
        "/api/supervisor/intelligence"
      ),
    refetchInterval: 4000,
  });

  useNewOrderAlert(data?.orders);
  useAttentionAlert(data?.orders);
  useStalledAlert(data?.orders, ops.stalledMinutes);

  const all = data?.orders ?? [];
  const needsAttention = all.filter(needsSupervisorAction);
  const waiting = all.filter((o) => isWaitingTooLong(o.status, o.createdAt, ops.waitingToStartMinutes));
  const stalled = all.filter((o) => isStalledInProgress(o.status, o.updatedAt, ops.stalledMinutes));
  const activeCount = all.filter((o) =>
    ["new", "preparing", "ready_for_loading", "loading"].includes(o.status)
  ).length;

  const orders = useMemo(() => {
    let list = all;
    if (statusFilter) list = list.filter((o) => o.status === statusFilter);
    if (quickFilter === "attention") list = needsAttention;
    else if (quickFilter === "waiting") list = waiting;
    else if (quickFilter === "stalled") list = stalled;
    else if (quickFilter === "cancelled") list = list.filter((o) => o.status === "cancelled");
    else if (quickFilter === "all" && !statusFilter) list = list.filter((o) => o.status !== "cancelled");
    list = list.filter((o) => matchesSearch(o, search));

    const rank = (o: OrderDTO) =>
      needsSupervisorAction(o)
        ? 0
        : isWaitingTooLong(o.status, o.createdAt, ops.waitingToStartMinutes)
        ? 1
        : isStalledInProgress(o.status, o.updatedAt, ops.stalledMinutes)
        ? 2
        : 3;
    return [...list].sort((a, b) => {
      if (sort === "priority") {
        const r = rank(a) - rank(b);
        if (r !== 0) return r;
        return a.deliveryTime && b.deliveryTime ? a.deliveryTime.localeCompare(b.deliveryTime) : 0;
      }
      if (sort === "delivery") {
        return `${a.deliveryDate}${a.deliveryTime ?? ""}`.localeCompare(
          `${b.deliveryDate}${b.deliveryTime ?? ""}`
        );
      }
      return b.createdAt.localeCompare(a.createdAt); // newest
    });
  }, [all, statusFilter, quickFilter, search, sort, needsAttention, waiting, stalled, ops]);

  return (
    <div className="p-4 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-united-dark">مركز التحكم</h1>
          <LiveIndicator dataUpdatedAt={dataUpdatedAt} isLoading={isLoading} />
        </div>
        <div className="flex gap-2">
          <Link href="/supervisor/audit" className="btn-secondary text-sm">
            سجل المراجعة
          </Link>
          <button onClick={() => setShowCreate((s) => !s)} className="btn-primary text-sm">
            {showCreate ? "إلغاء" : "+ أوردر يدوي"}
          </button>
        </div>
      </div>

      {!isLoading && !isError && (
        <div className="mt-4">
          <PipelineFunnel
            orders={all}
            activeStatus={statusFilter}
            onSelect={(s) => {
              setStatusFilter(s);
              setQuickFilter("all");
            }}
          />
        </div>
      )}

      {showCreate && (
        <div className="mt-4">
          <CreateOrderForm onDone={() => setShowCreate(false)} />
        </div>
      )}

      {!isLoading && !isError && data?.intelligence && (
        <div className="mt-5 flex flex-col gap-3">
          <OperationalHealthBanner health={data.intelligence.health} />
          <NeedsAttentionQueue items={data.intelligence.needsAttention} />
        </div>
      )}

      <div className="mt-5 flex flex-col sm:flex-row gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="دوّر باسم العميل أو رقم الأوردر..."
          className="field flex-1"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="field sm:w-48"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              ترتيب: {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 pb-1">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setQuickFilter(f.key);
              setStatusFilter(null);
            }}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${
              quickFilter === f.key && !statusFilter
                ? "bg-united-dark text-white"
                : "bg-white text-united-dark border border-united-border"
            }`}
          >
            {f.key === "attention"
              ? `🔴 فيه مشاكل (${needsAttention.length})`
              : f.key === "stalled"
              ? `⏸️ متوقفة من فترة (${stalled.length})`
              : f.label}
          </button>
        ))}
        <span className="px-4 py-2 text-sm font-bold text-united-muted whitespace-nowrap">
          {activeCount} أوردر شغال دلوقتي
        </span>
      </div>

      <div className="mt-4">
        {isLoading && <LoadingState />}
        {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !isError && orders.length === 0 && (
          <EmptyState
            icon="📭"
            title={
              search
                ? "مفيش أوردرات مطابقة للبحث ده"
                : quickFilter === "attention"
                ? "مفيش أوردرات محتاجة تدخل دلوقتي 👍"
                : quickFilter === "waiting"
                ? "مفيش أوردرات مستنية بدري 👍"
                : quickFilter === "stalled"
                ? "مفيش أوردرات متوقفة 👍"
                : "مفيش أوردرات في الفلتر ده"
            }
          />
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      </div>
    </div>
  );
}
