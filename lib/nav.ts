import { HOME_BY_ROLE, type Role } from "@/lib/types";
import type { Permission } from "@/lib/permissions";

/**
 * The single navigation definition. The header renders from it, and the post-login
 * landing page is chosen from it, so a module can never appear in one place and be
 * missing from the other. Each entry names the permission that both hides the link
 * and — enforced separately, server-side — protects the page behind it.
 */
export type NavLink = {
  href: string;
  label: string;
  /** One permission, or several meaning "any of these". */
  permission: Permission | Permission[];
  /** Shown in the header. Sub-pages of a module are reachable from the module itself. */
  primary: boolean;
  /** The department the link belongs to — the header groups by it when a role sees many links. */
  group: NavGroup;
  /** When the PAGE is open to every signed-in user (it then filters its own content)
   * and `permission` only decides whether the link is worth showing in the header. */
  pageOpenToAll?: true;
};

export type NavGroup = "ops" | "control" | "sales" | "purchasing" | "stock" | "finance" | "admin";
export const NAV_GROUPS: { key: NavGroup; label: string }[] = [
  { key: "ops", label: "التشغيل" },
  { key: "control", label: "المتابعة" },
  { key: "sales", label: "المبيعات" },
  { key: "purchasing", label: "المشتريات" },
  { key: "stock", label: "المخزون" },
  { key: "finance", label: "الحسابات" },
  { key: "admin", label: "الإدارة" },
];

export const NAV_LINKS: NavLink[] = [
  { href: "/prep", label: "التجهيز", permission: "orders.prepare", group: "ops", primary: true },
  { href: "/load", label: "التحميل", permission: "orders.load", group: "ops", primary: true },
  { href: "/production", label: "إنتاج النهارده", permission: "orders.view", group: "ops", primary: true },
  { href: "/operations", label: "التوزيع", permission: "orders.view", group: "ops", primary: true },
  { href: "/supervisor", label: "مركز التحكم", permission: "reports.view", group: "control", primary: true },
  { href: "/supervisor/exceptions", label: "نواقص التجهيز", permission: "reports.view", group: "control", primary: true },
  { href: "/supervisor/report", label: "تقرير اليوم", permission: "reports.view", group: "control", primary: true },
  { href: "/supervisor/audit", label: "سجل المراجعة", permission: "audit.view", group: "control", primary: false },
  // Every permission that can decide some approval type — see lib/core/approvals.ts.
  // The page lists what you may decide AND what you raised, so anyone may open it.
  { href: "/approvals", label: "الموافقات", permission: ["orders.approve", "stock.approve_adjustments", "sales.credit.manage", "purchasing.orders.approve", "purchasing.bills.approve", "hr.expenses.approve"], group: "control", primary: true, pageOpenToAll: true },
  { href: "/sales", label: "العملاء", permission: "sales.customers.view", group: "sales", primary: true },
  { href: "/purchasing", label: "المشتريات", permission: "purchasing.orders.view", group: "purchasing", primary: true },
  { href: "/accounting", label: "الحسابات", permission: "accounting.view", group: "finance", primary: true },
  { href: "/eta", label: "الفاتورة الإلكترونية", permission: "accounting.eta.view", group: "finance", primary: true },
  { href: "/hr", label: "الموظفين والمصروفات", permission: "hr.expenses.submit", group: "admin", primary: true },
  { href: "/management", label: "تقارير الإدارة", permission: "reports.finance", group: "finance", primary: true },
  { href: "/management/operations", label: "أداء التشغيل", permission: "reports.view", group: "control", primary: true },
  { href: "/stock", label: "المخزون", permission: "stock.view", group: "stock", primary: true },
  { href: "/stock/inventory", label: "إدارة المخزون", permission: "stock.view", group: "stock", primary: true },
  { href: "/stock/entries", label: "الاستلامات", permission: "stock.receive", group: "stock", primary: true },
  { href: "/stock/ledger", label: "سجل الحركات", permission: "stock.view", group: "stock", primary: true },
  { href: "/stock/setup", label: "دليل الأصناف", permission: "stock.view", group: "stock", primary: true },
  { href: "/admin", label: "الإدارة", permission: "users.view", group: "admin", primary: true },
];

/**
 * Where to send someone who lands on "/".
 *
 * Derived from what they can actually reach, not from their role: a supervisor whose
 * reports permission has been revoked by an override would otherwise be bounced into
 * a page they are about to be refused from, which reads as a broken login.
 */
const LANDING_ORDER = ["/admin", "/supervisor", "/sales", "/purchasing", "/stock", "/prep", "/load", "/production"];

function holds(held: Set<string>, permission: NavLink["permission"]) {
  return Array.isArray(permission) ? permission.some((p) => held.has(p)) : held.has(permission);
}

export function homePathFor(permissions: Iterable<string>, role?: Role): string {
  const held = new Set(permissions);
  // The role's own home first (an accountant lands on sales/finance, not on the
  // operations board it can also read), when it can actually reach it.
  const own = role ? NAV_LINKS.find((l) => l.href === HOME_BY_ROLE[role]) : undefined;
  if (own && holds(held, own.permission)) return own.href;
  for (const href of LANDING_ORDER) {
    const link = NAV_LINKS.find((l) => l.href === href);
    if (link && holds(held, link.permission)) return href;
  }
  return "/no-access";
}

export function visibleNavLinks(permissions: Iterable<string>): NavLink[] {
  const held = new Set(permissions);
  return NAV_LINKS.filter((l) => l.primary && holds(held, l.permission));
}
