import type { MovementKind } from "@/lib/stock-service";

/** Weights read as plain Latin digits with at most 3 decimals and no trailing zeros —
 * "12.5 كجم", not "12.500". Grouping stays off so a tablet's narrow columns don't wrap. */
export function fmtKg(n: number) {
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function fmtSignedKg(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtKg(Math.abs(n))}`;
}

export function fmtYield(pct: number | null) {
  return pct === null ? "—" : `${pct}%`;
}

/** Yield tone thresholds are presentational only — they colour a number the operator
 * already sees, and never gate or change any stored value. */
export function yieldTone(pct: number | null): "good" | "warn" | "bad" | "none" {
  if (pct === null) return "none";
  if (pct >= 90) return "good";
  if (pct >= 75) return "warn";
  return "bad";
}

export const YIELD_TONE_CLASS: Record<"good" | "warn" | "bad" | "none", string> = {
  good: "text-united-green",
  warn: "text-united-warn",
  bad: "text-united-danger",
  none: "text-united-muted",
};

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  intake: "استلام",
  intake_correction: "تصحيح استلام",
  intake_void: "إلغاء استلام",
  adjustment: "تسوية يدوية",
  transfer_out: "تحويل (خروج)",
  transfer_in: "تحويل (دخول)",
  issue: "صرف",
  customer_return: "مرتجع من عميل",
  supplier_return: "مرتجع لمورد",
  scrap: "تالف / إعدام",
  sorting_out: "فرز (خروج)",
  sorting_in: "فرز (دخول)",
  release_out: "إفراج محجوز (خروج)",
  release_in: "إفراج محجوز (دخول)",
};

export const MOVEMENT_ICON: Record<MovementKind, string> = {
  intake: "📥",
  intake_correction: "✏️",
  intake_void: "↩️",
  adjustment: "⚖️",
  transfer_out: "➡️",
  transfer_in: "⬅️",
  issue: "🚚",
  customer_return: "🔙",
  supplier_return: "📤",
  scrap: "🗑️",
  sorting_out: "🔀",
  sorting_in: "🔀",
  release_out: "🔓",
  release_in: "🔓",
};

export const STOCK_AUDIT_LABEL: Record<string, string> = {
  supplier_created: "إضافة مورد",
  supplier_updated: "تعديل مورد",
  stock_product_created: "إضافة صنف",
  stock_product_updated: "تعديل صنف",
  product_created: "إضافة صنف للدليل",
  product_updated: "تعديل بيانات صنف",
  product_activated: "تفعيل صنف",
  product_deactivated: "إيقاف صنف",
  product_alias_added: "إضافة اسم بديل",
  product_alias_removed: "حذف اسم بديل",
  order_product_mapped: "ربط اسم أوردر بصنف",
  order_product_unmapped: "فك ربط اسم أوردر",
  stock_intake_created: "تسجيل استلام",
  stock_intake_updated: "تعديل استلام",
  stock_intake_voided: "إلغاء استلام",
  stock_adjustment_created: "تسوية مخزون",
  inventory_adjustment_requested: "تسوية مستنية موافقة",
  inventory_adjustment_rejected: "تسوية اترفضت",
  inventory_transfer_posted: "تحويل بين أماكن",
  inventory_scrap_posted: "تالف / إعدام",
  inventory_customer_return_posted: "مرتجع من عميل",
  inventory_supplier_return_posted: "مرتجع لمورد",
  inventory_issue_posted: "صرف مخزون",
  inventory_document_reversed: "إلغاء مستند مخزون",
  stock_reserved: "حجز مخزون",
  stock_reservation_released: "فك حجز",
  product_packaging_saved: "تعبئة صنف",
  stock_lot_updated: "تعديل دفعة",
};

export function shortDate(iso: string) {
  return iso.slice(5).replace("-", "/"); // YYYY-MM-DD -> MM/DD
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}
