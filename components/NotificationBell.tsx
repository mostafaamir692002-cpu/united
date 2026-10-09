"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost } from "@/lib/api-client";

type NotificationDTO = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const DOT: Record<NotificationDTO["severity"], string> = {
  info: "bg-united-info",
  warning: "bg-united-warn",
  critical: "bg-united-danger",
};

/**
 * The header bell: unread count, and a panel with the latest notifications. Opening
 * one marks it read and goes to the thing it is about.
 */
export function NotificationBell() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<{ items: NotificationDTO[]; unread: number }>("/api/notifications?limit=20"),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const unread = q.data?.unread ?? 0;

  async function openItem(n: NotificationDTO) {
    setOpen(false);
    if (!n.readAt) {
      await apiPost("/api/notifications/read", { ids: [n.id] }).catch(() => undefined);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    await apiPost("/api/notifications/read", { all: true }).catch(() => undefined);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        aria-label={unread > 0 ? `${unread} إشعار جديد` : "الإشعارات"}
        className="relative w-11 h-11 rounded-lg bg-united-dark/5 hover:bg-united-dark/10 grid place-items-center"
      >
        <span aria-hidden className="text-xl leading-none">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-united-danger text-white text-[11px] font-extrabold grid place-items-center tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-[min(22rem,calc(100vw-2rem))] card p-2 z-30">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="font-extrabold text-united-dark">الإشعارات</span>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="text-xs font-bold text-united-green">
                تعليم الكل كمقروء
              </button>
            )}
          </div>
          {(q.data?.items.length ?? 0) === 0 ? (
            <p className="p-4 text-center text-sm font-bold text-united-muted">مفيش إشعارات</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {q.data!.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`w-full text-right flex gap-2 items-start rounded-xl px-2 py-2.5 hover:bg-united-dark/5 ${
                      n.readAt ? "opacity-60" : ""
                    }`}
                  >
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? "bg-united-dark/20" : DOT[n.severity]}`} />
                    <span className="min-w-0">
                      <span className="block font-bold text-sm text-united-dark">{n.title}</span>
                      {n.body && <span className="block text-xs font-bold text-united-muted">{n.body}</span>}
                      <span dir="ltr" className="block text-[10px] font-bold text-united-muted mt-0.5 text-right">
                        {new Date(n.createdAt).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
