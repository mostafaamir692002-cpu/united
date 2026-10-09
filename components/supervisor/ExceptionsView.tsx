"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { OrderDTO } from "@/lib/client-types";
import { OrderCard } from "@/components/OrderCard";
import { EmptyState, ErrorState } from "@/components/States";
import { BoardSkeleton } from "@/components/Skeleton";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { exceptionCategory } from "@/lib/orderPresentation";
import { useAttentionAlert } from "@/lib/liveAlerts";

/** "What needs me right now" — split cleanly into three buckets so an
 * already-approved shortage never masquerades as something still blocking the
 * pipeline. Reuses OrderCard, which already renders the same distinction on
 * each card (red "needs review" badge vs. neutral "has a shortage" badge). */
export function ExceptionsView() {
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["orders", "all"],
    queryFn: () => apiFetch<{ orders: OrderDTO[] }>("/api/orders"),
    refetchInterval: 5000,
    staleTime: 2000,
  });

  useAttentionAlert(data?.orders);

  const all = data?.orders ?? [];
  const active = all.filter((o) => exceptionCategory(o) === "active");
  const informational = all.filter((o) => exceptionCategory(o) === "informational");
  const resolved = all.filter((o) => exceptionCategory(o) === "resolved");
  const totalExceptions = active.length + informational.length + resolved.length;

  return (
    <div className="p-4 max-w-3xl mx-auto pb-10">
      <Link href="/supervisor" className="inline-flex items-center gap-1 text-united-muted font-bold mb-3">
        <span>→</span> رجوع لمركز التحكم
      </Link>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-extrabold text-united-dark">مركز الاستثناءات</h1>
        <LiveIndicator dataUpdatedAt={dataUpdatedAt} isLoading={isLoading} />
      </div>
      <p className="text-united-muted text-sm mb-4">اللي محتاج تدخلك دلوقتي — وبس اللي فعلاً محتاج.</p>

      {isLoading && !data && <BoardSkeleton />}
      {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}

      {/* Stale-but-valid data stays visible under the error banner above, same as
       * every other board — only claim "nothing to show" when we actually know
       * that, and only replace this with the skeleton when there's no data yet. */}
      {!isLoading && !isError && totalExceptions === 0 && (
        <EmptyState icon="👍" title="مفيش استثناءات خالص — كل حاجة ماشية عادي" />
      )}

      {totalExceptions > 0 && (
        <div className="flex flex-col gap-6">
          {active.length > 0 && (
            <section>
              <h2 className="font-extrabold text-united-danger mb-2 flex items-center gap-2">
                🔴 محتاج تدخلك دلوقتي
                <span className="text-sm font-bold bg-united-danger/10 px-2 py-0.5 rounded-full">
                  {active.length}
                </span>
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {active.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            </section>
          )}

          {informational.length > 0 && (
            <section>
              <h2 className="font-extrabold text-united-warn mb-2 flex items-center gap-2">
                ⚠️ معلومة بس — اتعمد فرقها بالفعل
                <span className="text-sm font-bold bg-united-warn/10 px-2 py-0.5 rounded-full">
                  {informational.length}
                </span>
              </h2>
              <p className="text-xs text-united-muted mb-2">
                مفيش حاجة تعملها — الأوردرات دي معتمدة وماشية عادي، ظاهرة هنا للمتابعة بس.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {informational.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section>
              <h2 className="font-extrabold text-united-muted mb-2 flex items-center gap-2">
                ⚪ سجل تاريخي — أوردرات اتقفلت
                <span className="text-sm font-bold bg-united-dark/5 px-2 py-0.5 rounded-full">
                  {resolved.length}
                </span>
              </h2>
              <div className="grid sm:grid-cols-2 gap-3 opacity-70">
                {resolved.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
