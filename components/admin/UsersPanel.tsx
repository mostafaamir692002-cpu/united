"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost, apiPatch, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { usePermissions, useSession } from "@/lib/use-session";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/types";
import { LoadingState, EmptyState } from "@/components/States";
import { GROUP_LABEL, type AdminUser, type UserPermissionDetail } from "@/lib/admin-client-types";

export function UsersPanel({ users }: { users: AdminUser[] }) {
  const { can } = usePermissions();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const activeSuperAdmins = users.filter((u) => u.role === "SUPER_ADMIN" && u.active).length;

  return (
    <div className="flex flex-col gap-3">
      {can("users.create") && (
        creating ? (
          <CreateUserForm onDone={() => setCreating(false)} />
        ) : (
          <button onClick={() => setCreating(true)} className="btn-primary self-start text-sm">
            + مستخدم جديد
          </button>
        )
      )}

      {users.length === 0 && <EmptyState icon="👥" title="مفيش مستخدمين" />}

      {users.map((u) => (
        <UserCard
          key={u.id}
          user={u}
          expanded={openId === u.id}
          onToggle={() => setOpenId(openId === u.id ? null : u.id)}
          isLastActiveSuperAdmin={u.role === "SUPER_ADMIN" && u.active && activeSuperAdmins <= 1}
        />
      ))}
    </div>
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = usePermissions();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mustChange, setMustChange] = useState(true);
  const [role, setRole] = useState<Role>("PREPARER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Only a super admin may mint another one; the server enforces this too.
  const assignableRoles = ROLES.filter((r) => r !== "SUPER_ADMIN" || can("settings.manage"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await apiPost("/api/admin/users", { name, username, password, role, must_change_password: mustChange });
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.show(`اتضاف المستخدم ${username}`, "success");
      onDone();
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
      <h2 className="font-extrabold text-united-dark">مستخدم جديد</h2>
      {error && <p className="text-united-danger font-bold text-sm">{error}</p>}
      <input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} className="field" />
      <input
        placeholder="اسم المستخدم (إنجليزي)"
        dir="ltr"
        autoComplete="off"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="field"
      />
      <input
        placeholder="كلمة السر"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="field"
      />
      <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="field font-bold">
        {assignableRoles.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" className="w-5 h-5" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
        يغيّر كلمة السر بنفسه أول ما يدخل (مستحسن)
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary flex-1 text-sm">
          إضافة
        </button>
        <button type="button" onClick={onDone} className="btn-secondary flex-1 text-sm">
          رجوع
        </button>
      </div>
    </form>
  );
}

function UserCard({
  user,
  expanded,
  onToggle,
  isLastActiveSuperAdmin,
}: {
  user: AdminUser;
  expanded: boolean;
  onToggle: () => void;
  isLastActiveSuperAdmin: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = usePermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState("");
  const [forceChange, setForceChange] = useState(true);
  const { data: me } = useSession();
  const isSelf = me?.user?.id === user.id;
  // A super admin account is managed only by a super admin (the server enforces it).
  const mayManage = user.role !== "SUPER_ADMIN" || me?.user?.role === "SUPER_ADMIN";

  async function patch(body: Record<string, unknown>, successMsg: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/api/admin/users/${user.id}`, { ...body, expected_version: user.version });
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.show(successMsg, "success");
      setEditing(false);
      setPassword("");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "حصل خطأ";
      setError(msg);
      toast.show(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`card p-4 ${user.active ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-united-dark">{user.name}</span>
            <span className="text-[11px] font-extrabold bg-united-green/10 text-united-green px-2 py-0.5 rounded-full">
              {ROLE_LABEL[user.role]}
            </span>
            {!user.active && (
              <span className="text-[11px] font-extrabold bg-united-danger/10 text-united-danger px-2 py-0.5 rounded-full">
                موقوف
              </span>
            )}
            {isLastActiveSuperAdmin && (
              <span className="text-[11px] font-extrabold bg-united-warn/10 text-united-warn px-2 py-0.5 rounded-full">
                🔒 آخر مدير نظام
              </span>
            )}
            {user.overrideCount > 0 && (
              <span className="text-[11px] font-extrabold bg-united-info/10 text-united-info px-2 py-0.5 rounded-full">
                {user.overrideCount} استثناء
              </span>
            )}
          </div>
          <div dir="ltr" className="text-xs font-bold text-united-muted text-right">
            {user.username}
          </div>
        </div>
        <button onClick={onToggle} className="btn-secondary text-xs px-3">
          {expanded ? "إخفاء الصلاحيات" : "الصلاحيات الفعلية"}
        </button>
      </div>

      {error && <p className="text-united-danger font-bold text-sm mt-2">{error}</p>}

      <div className="flex flex-wrap gap-2 mt-3">
        {can("users.change_role") && mayManage && !isSelf && (
          <select
            value={user.role}
            disabled={busy || isLastActiveSuperAdmin}
            onChange={(e) => {
              const next = e.target.value as Role;
              if (next === user.role) return;
              if (!window.confirm(`متأكد تغيّر دور "${user.name}" من ${ROLE_LABEL[user.role]} لـ ${ROLE_LABEL[next]}؟`)) {
                e.target.value = user.role;
                return;
              }
              patch({ role: next }, "اتغيّر الدور");
            }}
            className="tap-target rounded-xl border-2 border-united-dark/10 px-3 font-bold text-sm bg-white disabled:opacity-40"
            aria-label="الدور"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        )}
        {can("users.disable") && mayManage && (
          <button
            onClick={async () => {
              if (!window.confirm(`تسجيل خروج "${user.name}" من كل الأجهزة؟`)) return;
              try {
                await apiPost(`/api/admin/users/${user.id}/sessions/revoke`);
                await qc.invalidateQueries({ queryKey: ["admin"] });
                toast.show("اتقفلت كل جلساته", "success");
              } catch (err) {
                toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
              }
            }}
            disabled={busy || !user.active}
            className="btn-secondary text-sm px-4 disabled:opacity-40"
          >
            خروج من كل الأجهزة
          </button>
        )}
        {can("users.disable") && mayManage && (
          <button
            onClick={() => {
              const question = user.active
                ? `متأكد توقف حساب "${user.name}"؟ هيتقفل عليه الدخول فورًا.`
                : `متأكد تفعّل حساب "${user.name}"؟`;
              if (!window.confirm(question)) return;
              patch({ active: !user.active }, user.active ? "اتوقف الحساب" : "اتفعّل الحساب");
            }}
            disabled={busy || (user.active && isLastActiveSuperAdmin)}
            className={`${user.active ? "btn-danger" : "btn-primary"} text-sm px-4 disabled:opacity-40`}
          >
            {user.active ? "إيقاف" : "تفعيل"}
          </button>
        )}
        {can("users.edit") && mayManage && !editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary text-sm px-4">
            تعديل
          </button>
        )}
      </div>

      {isLastActiveSuperAdmin && (
        <p className="text-[11px] font-bold text-united-warn mt-2">
          ده آخر مدير نظام نشط — مينفعش يتوقف أو يتغيّر دوره علشان النظام ما يتقفلش.
        </p>
      )}

      {editing && (
        <div className="flex flex-col gap-2 mt-3">
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="الاسم" />
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            placeholder="كلمة سر جديدة (سيبها فاضية لو مش هتتغير)"
          />
          {password && (
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="w-5 h-5" checked={forceChange} onChange={(e) => setForceChange(e.target.checked)} />
              يغيّرها بنفسه أول ما يدخل (مستحسن)
            </label>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => patch(password ? { name, password, must_change_password: forceChange } : { name }, "اتحفظ التعديل")}
              disabled={busy}
              className="btn-primary flex-1 text-sm"
            >
              حفظ
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary flex-1 text-sm">
              رجوع
            </button>
          </div>
        </div>
      )}

      {expanded && <EffectivePermissions userId={user.id} isSelf={isSelf} />}
    </div>
  );
}

/** The whole catalogue for one user: what the role gives, what an override changes,
 * and the resulting effective answer — the same resolution the server performs. */
function EffectivePermissions({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = usePermissions();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user-permissions", userId],
    queryFn: () => apiFetch<UserPermissionDetail>(`/api/admin/users/${userId}/permissions`),
  });

  async function setOverride(permission: string, effect: "grant" | "revoke" | null) {
    setBusyKey(permission);
    try {
      await apiPost(`/api/admin/users/${userId}/permissions`, { permission, effect });
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.show("اتحدّثت الصلاحيات", "success");
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : "حصل خطأ", "error");
    } finally {
      setBusyKey(null);
    }
  }

  if (isLoading) return <LoadingState label="بيحمّل الصلاحيات..." />;
  if (!data) return null;

  const groups = [...new Set(data.permissions.map((p) => p.group))];
  // Your own permissions are someone else's decision (the server refuses it too).
  const canManage = can("settings.manage") && !data.absoluteRole && !isSelf;
  const effectiveCount = data.permissions.filter((p) => p.effective).length;
  const overrides = data.permissions.filter((p) => p.override);

  return (
    <div className="mt-4 pt-4 border-t border-united-border">
      <div className="rounded-xl bg-united-dark/[0.03] p-3 mb-3 text-sm font-bold flex flex-wrap gap-x-4 gap-y-1">
        <span>الدور الأساسي: <span className="text-united-green">{ROLE_LABEL[data.user.role]}</span></span>
        <span>الصلاحيات الفعلية: {effectiveCount} من {data.permissions.length}</span>
        <span>{overrides.length ? `استثناءات: ${overrides.map((o) => `${o.override === "grant" ? "+" : "−"}${o.key}`).join("، ")}` : "من غير استثناءات"}</span>
      </div>
      {data.absoluteRole && (
        <p className="text-xs font-bold text-united-muted mb-3">
          مدير النظام عنده كل الصلاحيات دايمًا — مفيش استثناءات بتتطبّق عليه.
        </p>
      )}
      {groups.map((group) => (
        <div key={group} className="mb-3">
          <h4 className="text-xs font-extrabold text-united-green mb-1">{GROUP_LABEL[group]}</h4>
          <ul className="flex flex-col gap-1">
            {data.permissions
              .filter((p) => p.group === group)
              .map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-2 py-1">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-united-dark">
                      {p.label}
                      {p.override && (
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded mr-2 ${
                            p.override === "grant"
                              ? "bg-united-green/10 text-united-green"
                              : "bg-united-danger/10 text-united-danger"
                          }`}
                        >
                          {p.override === "grant" ? "استثناء: ممنوحة" : "استثناء: مسحوبة"}
                        </span>
                      )}
                    </div>
                    <code dir="ltr" className="text-[10px] text-united-muted">
                      {p.key}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-extrabold ${p.effective ? "text-united-green" : "text-united-danger/60"}`}
                      title={p.override ? "بسبب استثناء" : "من الدور"}
                    >
                      {p.effective ? "✓" : "✗"} {p.override ? "(استثناء)" : p.fromRole ? "(الدور)" : ""}
                    </span>
                    {canManage && (
                      <select
                        value={p.override ?? "role"}
                        disabled={busyKey === p.key}
                        onChange={(e) => {
                          const next = e.target.value === "role" ? null : (e.target.value as "grant" | "revoke");
                          const question =
                            next === null
                              ? `متأكد ترجّع "${p.label}" لصلاحيات الدور العادية؟`
                              : next === "grant"
                              ? `متأكد تمنح صلاحية "${p.label}" استثناءً لهذا المستخدم؟`
                              : `متأكد تسحب صلاحية "${p.label}" من هذا المستخدم؟`;
                          if (!window.confirm(question)) {
                            e.target.value = p.override ?? "role";
                            return;
                          }
                          setOverride(p.key, next);
                        }}
                        className="rounded-lg border-2 border-united-dark/10 px-2 py-1 text-xs font-bold bg-white disabled:opacity-40"
                        aria-label={`استثناء ${p.key}`}
                      >
                        <option value="role">حسب الدور ({p.fromRole ? "مسموح" : "غير مسموح"})</option>
                        <option value="grant">امنح</option>
                        <option value="revoke">اسحب</option>
                      </select>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
