"use client";

import Link from "next/link";
import { ROLE_LABEL, ROLE_LABEL_EN, type Role } from "@/lib/types";
import { useLocale } from "@/lib/locale";

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
  const { t, locale } = useLocale();

  // Select role label based on current locale (safe: role is non-undefined in the ternary usage below)
  const roleLabel = role && locale === "en" ? ROLE_LABEL_EN[role] : (role && ROLE_LABEL[role]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="card p-8 max-w-md w-full flex flex-col items-center text-center gap-3">
        <span className="text-5xl">🔒</span>
        <h1 className="text-2xl font-extrabold text-united-dark">{t("ui.access-denied")}</h1>
        <p className="text-sm font-bold text-united-muted">
          {role
            ? t("ui.access-denied.role", { role: roleLabel as string })
            : t("ui.access-denied.generic")}
        </p>
        {missing.length > 0 && (
          <div className="w-full rounded-xl bg-united-dark/[0.04] px-4 py-3">
            <div className="text-[11px] font-extrabold text-united-muted mb-1">
              {t("ui.access-denied.permission")}
            </div>
            <div dir="ltr" className="flex flex-wrap gap-1 justify-center">
              {missing.map((m) => (
                <code key={m} className="text-xs font-bold bg-white border border-united-border rounded px-2 py-1">
                  {m}
                </code>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs font-bold text-united-muted">{t("ui.access-denied.contact")}</p>
        <Link href={homeHref} className="btn-primary text-sm mt-1">
          {t("ui.back-home")}
        </Link>
      </div>
    </div>
  );
}
