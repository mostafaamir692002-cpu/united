"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, ApiClientError, errorMessage } from "@/lib/api-client";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useToast } from "@/components/ui/Toast";

type Decision = { id: string; level: number; decision: "approve" | "reject"; decider: string; comment: string | null; createdAt: string };
type ApprovalDTO = {
  id: string;
  number: string;
  type: string;
  label: string;
  title: string;
  summary: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requiredLevels: number;
  approvedLevels: number;
  requestedBy: string;
  requestReason: string | null;
  closedReason: string | null;
  createdAt: string;
  decidedAt: string | null;
  version: number;
  link: string | null;
  canDecide: boolean;
  decisions: Decision[];
};

const STATUS: Record<ApprovalDTO["status"], { label: string; cls: string }> = {
  pending: { label: "مستني قرار", cls: "bg-united-warn/10 text-united-warn" },
  approved: { label: "اتوافق", cls: "bg-united-green/10 text-united-green" },
  rejected: { label: "اترفض", cls: "bg-united-danger/10 text-united-danger" },
  cancelled: { label: "اتلغى", cls: "bg-united-dark/5 text-united-muted" },
};

const when = (iso: string) => new Date(iso).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });

/** One inbox for every approval type: decide here, or open the thing being approved. */
export function ApprovalsInbox() {
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const q = useQuery({
    queryKey: ["approvals", tab],
    queryFn: () => apiFetch<{ approvals: ApprovalDTO[] }>(`/api/approvals${tab === "pending" ? "?status=pending" : ""}`),
    refetchInterval: 10_000,
  });

  return (
    <div className="p-4 max-w-3xl mx-auto pb-10 flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-united-dark">الموافقات</h1>
      <div className="flex gap-2">
        {(["pending", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`tap-target flex-1 rounded-xl font-extrabold text-sm ${tab === t ? "bg-united-green text-white" : "bg-united-dark/5 text-united-dark"}`}
          >
            {t === "pending" ? "مستنية قرار" : "كل الطلبات"}
          </button>
        ))}
      </div>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && q.data.approvals.length === 0 && <EmptyState icon="✅" title={tab === "pending" ? "مفيش حاجة مستنية موافقتك" : "مفيش طلبات"} />}
      <ul className="flex flex-col gap-3">
        {q.data?.approvals.map((a) => (
          <ApprovalCard key={a.id} a={a} />
        ))}
      </ul>
    </div>
  );
}

function ApprovalCard({ a }: { a: ApprovalDTO }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    if (busy) return;
    if (decision === "reject" && !comment.trim()) {
      setError("اكتب سبب الرفض");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/approvals/${a.id}/decide`, { decision, comment: comment || undefined, expected_version: a.version });
      await Promise.all([qc.invalidateQueries({ queryKey: ["approvals"] }), qc.invalidateQueries({ queryKey: ["orders"] }), qc.invalidateQueries({ queryKey: ["notifications"] })]);
      toast.show(decision === "approve" ? "اتوافق" : "اترفض", "success");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "حصل خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs font-bold text-united-muted">
            {a.label} · <bdi dir="ltr">{a.number}</bdi>
          </div>
          <div className="font-extrabold text-united-dark text-lg">{a.title}</div>
          {a.summary && <p className="text-sm font-bold text-united-dark/80 mt-0.5">{a.summary}</p>}
          <p className="text-xs font-bold text-united-muted mt-1">
            طلبه {a.requestedBy} · <bdi dir="ltr">{when(a.createdAt)}</bdi>
            {a.requiredLevels > 1 && ` · مستوى ${a.approvedLevels}/${a.requiredLevels}`}
          </p>
          {a.requestReason && <p className="text-xs font-bold text-united-dark/70">السبب: {a.requestReason}</p>}
          {a.closedReason && <p className="text-xs font-bold text-united-muted">{a.closedReason}</p>}
        </div>
        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span>
      </div>

      {a.decisions.length > 0 && (
        <ul className="mt-2 text-xs font-bold text-united-muted">
          {a.decisions.map((d) => (
            <li key={d.id}>
              {d.decision === "approve" ? "✓" : "✗"} {d.decider}
              {d.comment && ` — ${d.comment}`} · <bdi dir="ltr">{when(d.createdAt)}</bdi>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2 items-end">
        {a.link && (
          <Link href={a.link} className="btn-secondary text-sm">
            افتح
          </Link>
        )}
        {a.canDecide && (
          <>
            <input
              className="field flex-1 min-w-[12rem]"
              placeholder="تعليق (مطلوب للرفض)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button type="button" className="btn-primary" disabled={busy} onClick={() => decide("approve")}>
              موافقة
            </button>
            <button type="button" className="btn-danger" disabled={busy} onClick={() => decide("reject")}>
              رفض
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm font-bold text-united-danger">{error}</p>}
    </li>
  );
}
