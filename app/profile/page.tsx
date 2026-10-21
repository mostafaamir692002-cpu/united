import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/authz";
import { PERMISSION_DEFS, PERMISSION_GROUPS } from "@/lib/permissions";
import { ROLE_LABEL, ROLE_DESC, type Role } from "@/lib/types";
import { GROUP_LABEL } from "@/lib/admin-client-types";

/**
 * Read-only profile page — visible to every authenticated user.
 *
 * Policy: the profile is for viewing only. Users cannot edit their name, username,
 * role, permissions, status, or password here or anywhere else; all user
 * administration (including password resets) happens through the administrator's
 * user-management screens (users.create / users.edit) and is enforced server-side.
 *
 * Nothing sensitive is rendered: no hashes, tokens, epochs, or security metadata.
 * The data comes from the request's own auth context — there is no way to view
 * another user's profile through this page.
 */
export default async function ProfilePage() {
  const user = await getAuthContext();
  if (!user) redirect("/login");

  const permissions = [...user.permissions]
    .map((key) => PERMISSION_DEFS.find((d) => d.key === key))
    .filter((d): d is (typeof PERMISSION_DEFS)[number] => !!d)
    .sort((a, b) => (a.group === b.group ? a.label.localeCompare(b.label, "ar") : a.group.localeCompare(b.group)));

  const byGroup = PERMISSION_GROUPS.map((g) => ({ group: g, items: permissions.filter((p) => p.group === g) })).filter((g) => g.items.length > 0);

  return (
    <main className="min-h-screen p-4 flex flex-col items-center" style={{ direction: "rtl" }}>
      <div className="w-full max-w-2xl flex flex-col gap-3">
        <header className="card p-4 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-united-dark">الملف الشخصي</h1>
          <Link href="/" className="btn-secondary text-sm font-bold">الرجوع للتطبيق</Link>
        </header>

        <section className="card p-4 bg-united-warning/10 border-united-warning/30 flex flex-col gap-2" role="note">
          <p className="font-extrabold text-united-dark">
            🔒 الملف الشخصي للاطلاع فقط — مش بتتعدل منك ولا من أي مكان تاني.
          </p>
          <p className="text-sm font-bold text-united-muted">
            تعديل بياناتك (الاسم، الدور، الصلاحيات، الحالة) أو تغيير كلمة السر بيتم عن طريق إدارة النظام
            بس — كلم مدير النظام لو محتاج أي تغيير.
          </p>
        </section>

        <section className="card p-4 flex flex-col gap-3">
          <h2 className="font-extrabold text-united-dark">بيانات الحساب</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-bold">
            <div className="flex flex-col gap-1"><dt className="text-xs text-united-muted">الاسم</dt><dd className="text-united-dark">{user.name}</dd></div>
            <div className="flex flex-col gap-1"><dt className="text-xs text-united-muted">اسم المستخدم</dt><dd className="text-united-dark"><span dir="ltr">{user.username}</span></dd></div>
            <div className="flex flex-col gap-1"><dt className="text-xs text-united-muted">الدور</dt><dd className="text-united-dark">{ROLE_LABEL[user.role]}</dd></div>
            <div className="flex flex-col gap-1"><dt className="text-xs text-united-muted">حالة الحساب</dt><dd className={user.active ? "text-united-green" : "text-united-danger"}>{user.active ? "نشط ✓" : "موقوف"}</dd></div>
            <div className="flex flex-col gap-1 sm:col-span-2"><dt className="text-xs text-united-muted">وصف الدور</dt><dd className="text-united-dark">{ROLE_DESC[user.role as Role]}</dd></div>
          </dl>
          {user.mustChangePassword && (
            <p className="text-sm font-extrabold text-united-warning bg-united-warning/10 rounded-lg p-2">
              كلمة سرك محددة من الإدارة — لو محتاج تغييرها كلم مدير النظام.
            </p>
          )}
        </section>

        <section className="card p-4 flex flex-col gap-3">
          <h2 className="font-extrabold text-united-dark">الصلاحيات ({permissions.length})</h2>
          {byGroup.length === 0 && <p className="text-sm font-bold text-united-muted">مفيش صلاحيات معينة.</p>}
          {byGroup.map(({ group, items }) => (
            <div key={group} className="flex flex-col gap-1">
              <h3 className="text-xs font-extrabold text-united-muted">{GROUP_LABEL[group]}</h3>
              <ul className="flex flex-col gap-1">
                {items.map((p) => (
                  <li key={p.key} className="text-sm font-bold text-united-dark flex items-center gap-2">
                    <span className="text-united-green">✓</span>
                    <span title={p.key}>{p.label}</span>
                    <span className="text-xs font-normal text-united-muted">— {p.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}