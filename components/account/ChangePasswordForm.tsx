"use client";

import { useState } from "react";
import { apiPost, ApiClientError } from "@/lib/api-client";

export function ChangePasswordForm({ forced, name }: { forced: boolean; name: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card p-6 w-full max-w-md flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (next !== confirm) return setError("كلمتين السر الجداد مش زي بعض");
        setBusy(true);
        try {
          await apiPost("/api/auth/password", { current_password: current, new_password: next });
          // A full navigation: the session (and its permissions) changed.
          window.location.href = "/";
        } catch (err) {
          setError(err instanceof ApiClientError ? err.message : "حصل خطأ");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="text-2xl font-extrabold text-united-dark">تغيير كلمة السر</h1>
      <p className="text-sm font-bold text-united-muted">
        {forced ? `أهلاً ${name} — كلمة السر دي اتعملت لك من الإدارة. اختار كلمة سر بتاعتك قبل ما تكمل.` : `${name} — كل الأجهزة التانية هتخرج بعد التغيير.`}
      </p>
      {error && <p className="text-united-danger font-bold text-sm">{error}</p>}
      <input className="field" type="password" autoComplete="current-password" placeholder="كلمة السر الحالية" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <input className="field" type="password" autoComplete="new-password" placeholder="كلمة السر الجديدة (8 خانات على الأقل)" value={next} onChange={(e) => setNext(e.target.value)} />
      <input className="field" type="password" autoComplete="new-password" placeholder="أكّد كلمة السر الجديدة" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <button className="btn-primary text-lg" disabled={busy || !current || !next}>{busy ? "بيتغير..." : "غيّر كلمة السر"}</button>
      {!forced && <a href="/" className="text-sm font-bold text-united-muted text-center">رجوع</a>}
    </form>
  );
}
