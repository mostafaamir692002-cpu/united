"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPatch, ApiClientError, errorMessage } from "@/lib/api-client";
import { LoadingState, ErrorState } from "@/components/States";
import { useToast } from "@/components/ui/Toast";
import { SETTING_GROUP_LABEL, type SettingGroup } from "@/lib/core/settings-registry";
import type { SettingDTO } from "@/lib/admin-client-types";

/**
 * System settings: every operational policy number, its current value, where that
 * value came from, and who last changed it. Editing requires a reason, and the save
 * carries the version the editor saw, so two admins cannot silently overwrite each
 * other.
 */
export function SettingsPanel() {
  const q = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => apiFetch<{ settings: SettingDTO[] }>("/api/admin/settings"),
  });

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const settings = q.data?.settings ?? [];
  const groups = [...new Set(settings.map((s) => s.group))];

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group} className="card p-4">
          <h2 className="text-lg font-extrabold text-united-dark mb-1">
            {SETTING_GROUP_LABEL[group as SettingGroup] ?? group}
          </h2>
          <p className="text-xs font-bold text-united-muted mb-3">
            التغيير بيسري على كل الشاشات خلال ثواني، وبيتسجل في سجل التغييرات الأمنية بالسبب.
          </p>
          <ul className="flex flex-col divide-y divide-united-border">
            {settings
              .filter((s) => s.group === group)
              .map((s) => (
                <SettingRow key={s.key} setting={s} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SettingRow({ setting }: { setting: SettingDTO }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(setting.value));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBool = typeof setting.defaultValue === "boolean";
  const isText = typeof setting.defaultValue === "string";
  const show = (v: unknown) => (isBool ? (v ? "مفعّل" : "مقفول") : String(v));

  async function save(next: number | boolean | string | null) {
    if (busy) return;
    if (!reason.trim()) {
      setError("اكتب سبب التغيير");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/api/admin/settings/${encodeURIComponent(setting.key)}`, {
        value: next,
        reason,
        expected_version: setting.version,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin"] }),
        qc.invalidateQueries({ queryKey: ["settings"] }),
      ]);
      toast.show(next === null ? "رجع للقيمة الافتراضية" : "اتحفظ الإعداد", "success");
      setEditing(false);
      setReason("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "حصل خطأ");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isBool) {
      save(value === "true");
      return;
    }
    if (isText) {
      save(value.trim() as never);
      return;
    }
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n)) {
      setError("القيمة لازم تكون رقم");
      return;
    }
    save(n);
  }

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-united-dark">{setting.label}</div>
          <p className="text-xs font-bold text-united-muted mt-0.5">{setting.description}</p>
          <code dir="ltr" className="text-[10px] text-united-muted">
            {setting.key}
          </code>
        </div>
        <div className="text-left shrink-0">
          <div className="text-2xl font-extrabold text-united-dark tabular-nums">
            <bdi>{show(setting.value)}</bdi> <span className="text-sm text-united-muted">{setting.unit}</span>
          </div>
          <div className="text-[11px] font-bold text-united-muted">
            {setting.isDefault ? (
              "القيمة الافتراضية"
            ) : (
              <>
                الافتراضي <bdi>{show(setting.defaultValue)}</bdi> · غيّره {setting.updatedBy}
              </>
            )}
          </div>
        </div>
      </div>

      {!editing ? (
        <button type="button" className="btn-secondary mt-2 text-sm" onClick={() => setEditing(true)}>
          تعديل
        </button>
      ) : (
        <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr]">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-united-muted">القيمة الجديدة{setting.unit ? ` (${setting.unit})` : ""}</span>
            {isBool ? (
              <select className="field" value={value} onChange={(e) => setValue(e.target.value)} autoFocus>
                <option value="true">مفعّل</option>
                <option value="false">مقفول</option>
              </select>
            ) : (
              <input
                className="field tabular-nums"
                inputMode={isText ? undefined : "decimal"}
                dir="ltr"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-united-muted">السبب (مطلوب)</span>
            <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {error && <p className="sm:col-span-2 text-sm font-bold text-united-danger">{error}</p>}
          <div className="sm:col-span-2 flex gap-2 flex-wrap">
            <button type="submit" className="btn-primary" disabled={busy}>
              حفظ
            </button>
            {!setting.isDefault && (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => save(null)}>
                رجوع للافتراضي
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setError(null);
                setValue(String(setting.value));
              }}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
