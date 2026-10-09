"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { AuditLogDTO } from "@/lib/client-types";
import { EmptyState, ErrorState } from "@/components/States";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { buildTimeline, timeLabel, SOURCE_LABEL } from "@/lib/auditLabels";
import { CardSkeleton } from "@/components/Skeleton";

type DecisionFilter = "all" | "approvals" | "overrides" | "cancel_reopen" | "edits";

const DECISION_FILTERS: { key: DecisionFilter; label: string; actions?: string[] }[] = [
  { key: "all", label: "الكل" },
  { key: "approvals", label: "👨‍💼 اعتماد الفرق", actions: ["shortage_approved"] },
  { key: "overrides", label: "⚡ تجاوزات يدوية", actions: ["status_override"] },
  { key: "cancel_reopen", label: "🚫 إلغاء / إعادة فتح", actions: ["order_cancelled", "order_reopened"] },
  { key: "edits", label: "✏️ تعديلات", actions: ["order_edited", "required_quantity_edited"] },
];

export function AuditLogView() {
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["audit", "all"],
    queryFn: () => apiFetch<{ logs: AuditLogDTO[] }>("/api/audit"),
    refetchInterval: 5000,
  });

  const activeFilter = DECISION_FILTERS.find((f) => f.key === decisionFilter)!;
  const needle = search.trim().toLowerCase();
  const logs = (data?.logs ?? [])
    .filter((l) => !activeFilter.actions || activeFilter.actions.includes(l.action))
    .filter(
      (l) =>
        !needle ||
        l.userName.toLowerCase().includes(needle) ||
        l.order?.customerName.toLowerCase().includes(needle) ||
        l.order?.orderNumber.toLowerCase().includes(needle) ||
        describeOne(l).headline.toLowerCase().includes(needle)
    );

  return (
    <div className="p-4 max-w-2xl mx-auto pb-10">
      <Link href="/supervisor" className="inline-flex items-center gap-1 text-united-muted font-bold mb-3">
        <span>→</span> رجوع للوحة المشرف
      </Link>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-extrabold text-united-dark">سجل المراجعة الكامل</h1>
        <LiveIndicator dataUpdatedAt={dataUpdatedAt} isLoading={isLoading} />
      </div>
      <p className="text-united-muted text-sm mb-4">كل حدث تشغيلي: مين عمل إيه، إمتى، ومنين.</p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="دوّر باسم المستخدم أو العميل أو رقم الأوردر..."
        className="field mb-3"
      />

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
        {DECISION_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setDecisionFilter(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${
              decisionFilter === f.key
                ? "bg-united-dark text-white"
                : "bg-white text-united-dark border border-united-border"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      )}
      {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      {!isLoading && !isError && logs.length === 0 && (
        <EmptyState
          icon="🗒️"
          title={search || decisionFilter !== "all" ? "مفيش نتايج مطابقة" : "لسه مفيش حركة مسجلة"}
        />
      )}

      <div className="flex flex-col gap-2">
        {logs.map((l) => {
          const { icon, headline, detail } = describeOne(l);
          return (
            <div key={l.id} className="card p-4">
              {l.order && (
                <Link
                  href={`/orders/${l.orderId}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-united-green bg-united-green/10 px-2 py-1 rounded-full mb-2"
                >
                  {l.order.orderNumber} · {l.order.customerName}
                </Link>
              )}
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="font-bold text-united-dark">
                  {l.userName} <span className="text-united-muted font-normal">· {l.role}</span>
                </span>
                <span className="text-united-muted">{timeLabel(l.timestamp)}</span>
              </div>
              <p className="font-bold text-united-dark flex items-center gap-1.5">
                <span>{icon}</span> {headline}
              </p>
              {detail && <p className="text-sm font-bold text-united-dark/70">{detail}</p>}
              {l.reason && <p className="text-sm text-united-muted">السبب: {l.reason}</p>}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-bold text-united-muted bg-united-dark/5 px-2 py-0.5 rounded-full">
                  {SOURCE_LABEL[l.source] ?? l.source}
                </span>
                {l.orderId && (
                  <Link href={`/orders/${l.orderId}`} className="text-xs font-bold text-united-green">
                    عرض الأوردر ←
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Same operational wording as the order timeline, for one standalone row. */
function describeOne(l: AuditLogDTO) {
  const [event] = buildTimeline([l]);
  return event ?? { icon: "•", headline: l.action, detail: undefined };
}
