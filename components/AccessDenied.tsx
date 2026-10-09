import Link from "next/link";
import { ROLE_LABEL, type Role } from "@/lib/types";

/**
 * The visible half of a refusal. The server has already decided; this only explains
 * it, naming the missing permission so an operator can tell an administrator exactly
 * what to grant instead of reporting "the page is broken".
 */
export function AccessDenied({
  missing = [],
  role,
  homeHref = "/",
}: {
  missing?: string[];
  role?: Role;
  homeHref?: string;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="card p-8 max-w-md w-full flex flex-col items-center text-center gap-3">
        <span className="text-5xl">🔒</span>
        <h1 className="text-2xl font-extrabold text-united-dark">مالكش صلاحية للصفحة دي</h1>
        <p className="text-sm font-bold text-united-muted">
          {role ? `حسابك (${ROLE_LABEL[role]}) مش مسموح له يفتح الصفحة دي.` : "الصفحة دي محتاجة صلاحية مش موجودة في حسابك."}
        </p>
        {missing.length > 0 && (
          <div className="w-full rounded-xl bg-united-dark/[0.04] px-4 py-3">
            <div className="text-[11px] font-extrabold text-united-muted mb-1">الصلاحية المطلوبة</div>
            <div dir="ltr" className="flex flex-wrap gap-1 justify-center">
              {missing.map((m) => (
                <code key={m} className="text-xs font-bold bg-white border border-united-border rounded px-2 py-1">
                  {m}
                </code>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs font-bold text-united-muted">كلّم مدير النظام لو محتاج الصلاحية دي.</p>
        <Link href={homeHref} className="btn-primary text-sm mt-1">
          ارجع للصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
