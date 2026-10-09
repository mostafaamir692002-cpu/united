"use client";

import type { OrderDTO } from "@/lib/client-types";
import type { OrderStatus } from "@/lib/types";
import { STATUS_DOT } from "@/lib/orderPresentation";

const STAGES: { status: OrderStatus; label: string }[] = [
  { status: "new", label: "جديد" },
  { status: "preparing", label: "جاري التجهيز" },
  { status: "ready_for_loading", label: "جاهز للتحميل" },
  { status: "loading", label: "جاري التحميل" },
  { status: "loaded", label: "تم التحميل" },
  { status: "dispatched", label: "اتحركت" },
];

/** The operational pipeline at a glance — every stage's count, click to filter.
 * Same statuses/workflow as everywhere else, just visualized as a funnel. */
export function PipelineFunnel({
  orders,
  activeStatus,
  onSelect,
}: {
  orders: OrderDTO[];
  activeStatus: OrderStatus | null;
  onSelect: (status: OrderStatus | null) => void;
}) {
  const counts = new Map<OrderStatus, number>();
  for (const o of orders) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {STAGES.map((s) => {
        const count = counts.get(s.status) ?? 0;
        const active = activeStatus === s.status;
        return (
          <button
            key={s.status}
            onClick={() => onSelect(active ? null : s.status)}
            className={`card p-3 text-center transition ${
              active ? "!border-united-dark ring-2 ring-united-dark/10" : "hover:border-united-green/40"
            }`}
          >
            <div className="text-2xl font-extrabold text-united-dark leading-none mb-1">{count}</div>
            <div className="text-xs font-bold text-united-muted flex items-center justify-center gap-1 truncate">
              <span>{STATUS_DOT[s.status]}</span>
              {s.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
