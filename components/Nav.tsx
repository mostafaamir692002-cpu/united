"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, usePermissions } from "@/lib/use-session";
import { apiPost } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { ROLE_LABEL } from "@/lib/types";
import { visibleNavLinks, homePathFor, NAV_GROUPS, type NavGroup } from "@/lib/nav";
import { NotificationBell } from "@/components/NotificationBell";

export function Nav() {
  const { data } = useSession();
  const { permissions } = usePermissions();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const user = data?.user;
  const [openGroup, setOpenGroup] = useState<NavGroup | null>(null);

  async function logout() {
    try {
      await apiPost("/api/auth/logout");
    } finally {
      qc.clear();
      router.push("/login");
    }
  }

  if (!user) return null;

  // Links come from the shared NAV_LINKS definition filtered by effective permissions,
  // so the header can never offer a module the server would refuse.
  const links = visibleNavLinks(permissions);

  return (
    <header className="sticky top-0 z-20 bg-white border-b-2 border-united-green/20 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 gap-3">
        <Link href={homePathFor(permissions, user.role)} className="flex items-center gap-2 shrink-0">
          <Image src="/logo-united.png" alt="UNITED" width={36} height={36} className="rounded" />
          <span className="font-extrabold text-lg text-united-dark hidden sm:inline">UNITED</span>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/account/password" className="text-sm text-right hidden md:block" title="تغيير كلمة السر">
            <div className="font-bold">{user.name}</div>
            <div className="text-united-green">{ROLE_LABEL[user.role]}</div>
          </Link>
          <NotificationBell />
          <button
            onClick={logout}
            className="px-3 py-2 rounded-lg bg-united-dark/5 hover:bg-united-dark/10 text-sm font-bold shrink-0"
          >
            خروج
          </button>
        </div>
      </div>
      {links.length > 0 && (() => {
        // Only the most specific link is "here": on /stock/inventory, the
        // /stock/inventory tab — not /stock as well.
        const matches = (href: string) => pathname === href || (href !== "/" && !!pathname?.startsWith(href + "/"));
        const activeHref = links.filter((l) => matches(l.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
        const pill = (active: boolean) => `px-4 py-2 rounded-full text-base font-bold whitespace-nowrap shrink-0 transition ${active ? "bg-united-green text-white" : "text-united-dark hover:bg-united-green/10"}`;
        // A role with a handful of screens sees them all; a role spanning departments
        // picks the department first, then its screens — never a wall of twenty links.
        const groups = NAV_GROUPS.filter((g) => links.some((l) => l.group === g.key));
        if (links.length <= 7 || groups.length <= 1) {
          return (
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar px-4 pb-2">
              {links.map((l) => <Link key={l.href} href={l.href} className={pill(l.href === activeHref)}>{l.label}</Link>)}
            </nav>
          );
        }
        const current = openGroup ?? links.find((l) => l.href === activeHref)?.group ?? groups[0].key;
        return (
          <nav className="flex flex-col gap-1 px-4 pb-2">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {groups.map((g) => (
                <button key={g.key} type="button" onClick={() => setOpenGroup(g.key)} className={`px-3 py-1.5 rounded-lg text-sm font-extrabold whitespace-nowrap shrink-0 ${g.key === current ? "bg-united-dark text-white" : "bg-united-dark/5 text-united-dark"}`}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {links.filter((l) => l.group === current).map((l) => <Link key={l.href} href={l.href} className={pill(l.href === activeHref)}>{l.label}</Link>)}
            </div>
          </nav>
        );
      })()}
    </header>
  );
}
