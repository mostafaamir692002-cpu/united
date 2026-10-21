export const ROLES = ["SUPER_ADMIN", "SUPERVISOR", "STOCK_CONTROLLER", "PREPARER", "LOADER", "SALES", "ACCOUNTANT", "PURCHASER"] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_STATUSES = [
  "new",
  "preparing",
  "ready_for_loading",
  "loading",
  "loaded",
  "dispatched",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ITEM_STATUSES = ["pending", "done"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const HOME_BY_ROLE: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  SUPERVISOR: "/supervisor",
  STOCK_CONTROLLER: "/stock",
  PREPARER: "/prep",
  LOADER: "/load",
  SALES: "/sales",
  ACCOUNTANT: "/sales",
  PURCHASER: "/purchasing",
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "مدير النظام",
  SUPERVISOR: "مشرف",
  STOCK_CONTROLLER: "مراقب المخزون",
  PREPARER: "تجهيز",
  LOADER: "تحميل",
  SALES: "مبيعات",
  ACCOUNTANT: "حسابات",
  PURCHASER: "مشتريات",
};

/** Human-readable one-line description of each role, shown on the read-only profile. */
export const ROLE_DESC: Record<Role, string> = {
  SUPER_ADMIN: "إدارة كاملة للنظام والمستخدمين والإعدادات",
  SUPERVISOR: "إشراف على تجهيز وتحميل الأوردرات واعتماد النقص",
  STOCK_CONTROLLER: "إدارة المخزون والاستلام والجرد والتحويلات",
  PREPARER: "تجهيز الأوردرات من المخزون",
  LOADER: "التحميل على العربيات والتوزيع",
  SALES: "المبيعات: الأوردرات والتسعير والعملاء والفوترة",
  ACCOUNTANT: "الحسابات: القيود والميزان والتحصيل والسداد",
  PURCHASER: "المشتريات: أوامر الشراء والاستلام وفواتير الموردين",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
