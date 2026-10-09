import type { AuditLogDTO } from "@/lib/client-types";
import { STATUS_LABEL } from "@/lib/orderPresentation";
import type { OrderStatus } from "@/lib/types";
import { qty } from "@/lib/format";

/**
 * Turning the audit trail into an operational story.
 *
 * The audit table records field-level changes, which is right for an audit trail and
 * wrong for a human reading "what happened to this order". "prepared_quantity_set:
 * oldValue 0 → newValue 10" is a database row; "أحمد جهّز ١٠ كجم مانجا" is what
 * actually happened. This module is the translation layer, and it is the only place
 * that decides how an event reads.
 *
 * The raw rows stay available for supervisors and admins — see the audit screen's
 * technical view — so nothing is lost, it just isn't the primary UI any more.
 */

function statusLabel(v: string | null) {
  return v && v in STATUS_LABEL ? STATUS_LABEL[v as OrderStatus] : v ?? "؟";
}

const FIELD_LABEL: Record<string, string> = {
  customerName: "اسم العميل",
  deliveryDate: "تاريخ التسليم",
  deliveryTime: "ميعاد التسليم",
  notes: "الملاحظات",
  vehicle: "العربية",
  driverName: "اسم السواق",
  crateCount: "عدد البرنيكة",
};

function fieldLabel(field: string | null) {
  return field ? FIELD_LABEL[field] ?? field : "—";
}

function withUnit(value: string | number | null, unit?: string | null) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  const shown = Number.isFinite(n) ? qty(n) : String(value);
  return unit ? `${shown} ${unit}` : shown;
}

export type TimelineEvent = {
  id: string;
  icon: string;
  /** WHO did it. */
  actor: string;
  /** DID WHAT — the headline, in operational language. */
  headline: string;
  /** RESULT / detail — quantities, names, the consequence. Optional. */
  detail?: string;
  reason?: string | null;
  at: string;
  source: string;
  /** Visually separates the milestones (stage changes) from routine item work. */
  milestone: boolean;
};

type Describe = (l: AuditLogDTO) => Omit<TimelineEvent, "id" | "actor" | "at" | "source">;

const STAGE_HEADLINE: Record<string, { icon: string; headline: string }> = {
  preparing: { icon: "🧰", headline: "بدأ التجهيز" },
  ready_for_loading: { icon: "📦", headline: "خلّص التجهيز — الأوردر جاهز للتحميل" },
  loading: { icon: "🚚", headline: "بدأ التحميل" },
  loaded: { icon: "✅", headline: "خلّص التحميل" },
  dispatched: { icon: "🏁", headline: "أكّد خروج العربية" },
  cancelled: { icon: "🚫", headline: "لغى الأوردر" },
  new: { icon: "↩️", headline: "رجّع الأوردر لأول الخط" },
};

const DESCRIBE: Record<string, Describe> = {
  order_created: () => ({ icon: "📥", headline: "الأوردر وصل", milestone: true }),

  status_changed: (l) => {
    const to = l.newValue ?? "";
    const meta = STAGE_HEADLINE[to];
    return {
      icon: meta?.icon ?? "🔄",
      headline: meta?.headline ?? `نقل الأوردر لـ${statusLabel(l.newValue)}`,
      detail: meta ? undefined : `من ${statusLabel(l.oldValue)}`,
      milestone: true,
    };
  },

  status_override: (l) => ({
    icon: "⚠️",
    headline: `غيّر مرحلة الأوردر يدويًا لـ${statusLabel(l.newValue)}`,
    detail: `كانت ${statusLabel(l.oldValue)} — تغيير خارج المسار العادي`,
    milestone: true,
  }),

  prepared_quantity_set: (l) => ({
    icon: "⚖️",
    headline: `سجّل ${withUnit(l.newValue, l.itemUnit)} متجهّز`,
    detail: l.itemName ?? undefined,
    milestone: false,
  }),

  item_marked_prepared: (l) => ({
    icon: "✓",
    headline: `خلّص تجهيز ${l.itemName ?? "صنف"}`,
    milestone: false,
  }),

  loaded_quantity_set: (l) => ({
    icon: "⚖️",
    headline: `سجّل ${withUnit(l.newValue, l.itemUnit)} متحمّل`,
    detail: l.itemName ?? undefined,
    milestone: false,
  }),

  item_marked_loaded: (l) => ({
    icon: "✓",
    headline: `خلّص تحميل ${l.itemName ?? "صنف"}`,
    milestone: false,
  }),

  required_quantity_edited: (l) => ({
    icon: "✏️",
    headline: `عدّل المطلوب من ${l.itemName ?? "صنف"}`,
    detail: `${withUnit(l.oldValue, l.itemUnit)} ← ${withUnit(l.newValue, l.itemUnit)}`,
    milestone: false,
  }),

  shortage_approved: () => ({
    icon: "👍",
    headline: "اعتمد الفرق وفكّ وقف الأوردر",
    detail: "الأوردر يقدر يكمل بالكميات المسجلة",
    milestone: true,
  }),

  order_edited: (l) => ({
    icon: "✏️",
    headline: `عدّل ${fieldLabel(l.fieldChanged)}`,
    detail: `${l.oldValue || "—"} ← ${l.newValue || "—"}`,
    milestone: false,
  }),

  order_cloned: (l) => ({
    icon: "📋",
    headline: "عمل نسخة من الأوردر",
    detail: l.newValue ? `الأوردر الجديد ${l.newValue}` : undefined,
    milestone: true,
  }),

  order_cancelled: () => ({ icon: "🚫", headline: "لغى الأوردر", milestone: true }),

  order_reopened: (l) => ({
    icon: "🔓",
    headline: `فتح الأوردر تاني لمرحلة ${statusLabel(l.newValue)}`,
    detail: "الأصناف اللي في المرحلة دي محتاجة تأكيد تاني",
    milestone: true,
  }),

  order_assigned: (l) => ({ icon: "👤", headline: l.newValue ? `سلّم الأوردر لـ${l.newValue}` : "شال التكليف من الأوردر", milestone: false }),

  approval_requested: () => ({ icon: "⏳", headline: "طلب اعتماد", milestone: false }),
  approval_level_approved: () => ({ icon: "☑️", headline: "وافق على مستوى من الاعتماد", milestone: false }),
  approval_approved: () => ({ icon: "☑️", headline: "وافق على طلب الاعتماد", milestone: false }),
  approval_rejected: () => ({ icon: "✋", headline: "رفض طلب الاعتماد", milestone: true }),
  approval_cancelled: () => ({ icon: "↩️", headline: "طلب الاعتماد اتلغى", milestone: false }),

  stock_issue_exception_raised: (l) => ({ icon: "⚠️", headline: "الكمية اللي خرجت أكتر من المسجل في المخزن", detail: l.newValue ?? undefined, milestone: false }),
  stock_issue_exception_resolved: (l) => ({ icon: "✅", headline: "اتحلّ فرق المخزن", detail: l.newValue ?? undefined, milestone: false }),
  stock_issue_exception_voided: () => ({ icon: "↩️", headline: "فرق المخزن اتلغى (الأوردر اتفتح تاني)", milestone: false }),
  inventory_issue_posted: (l) => ({ icon: "📤", headline: "البضاعة اتخصمت من المخزن", detail: l.newValue ?? undefined, milestone: false }),

  order_customer_mapped: (l) => ({ icon: "🔗", headline: "ربط الأوردر بحساب العميل", detail: l.newValue ?? undefined, milestone: false }),
  order_product_mapped: (l) => ({ icon: "🔗", headline: `ربط ${l.itemName ?? "صنف"} بصنف المخزن`, detail: l.newValue ?? undefined, milestone: false }),
  order_product_unmapped: (l) => ({ icon: "✂️", headline: `فك ربط ${l.itemName ?? "صنف"}`, milestone: false }),
  order_priced: () => ({ icon: "🏷️", headline: "سعّر الأوردر من قائمة الأسعار", milestone: false }),
  order_line_price_overridden: (l) => ({ icon: "🏷️", headline: `غيّر سعر ${l.itemName ?? "صنف"}`, detail: l.oldValue || l.newValue ? `${l.oldValue || "—"} ← ${l.newValue || "—"}` : undefined, milestone: false }),
  order_credit_evaluated: (l) => ({ icon: "💳", headline: "راجع حد ائتمان العميل", detail: l.newValue ?? undefined, milestone: false }),
  attachment_added: (l) => ({ icon: "📎", headline: "أضاف مرفق", detail: l.newValue ?? undefined, milestone: false }),
  attachment_removed: (l) => ({ icon: "📎", headline: "شال مرفق", detail: l.oldValue ?? undefined, milestone: false }),
};

/**
 * Dispatch writes one status row plus a row per manifest field. Shown raw that is four
 * consecutive lines for one physical event. They are folded into the dispatch entry.
 */
const MANIFEST_FIELDS = new Set(["vehicle", "driverName", "crateCount"]);

export function buildTimeline(logs: AuditLogDTO[]): TimelineEvent[] {
  // Server returns newest-first; the story reads oldest-first.
  const ordered = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const events: TimelineEvent[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const l = ordered[i];

    // Fold the manifest edits that accompany a dispatch into the dispatch event.
    if (l.action === "order_edited" && MANIFEST_FIELDS.has(l.fieldChanged ?? "")) {
      const previous = events[events.length - 1];
      if (previous && previous.headline === STAGE_HEADLINE.dispatched.headline) {
        const part =
          l.fieldChanged === "vehicle"
            ? `العربية ${l.newValue}`
            : l.fieldChanged === "driverName"
            ? `السواق ${l.newValue}`
            : `${l.newValue} برنيكة`;
        previous.detail = previous.detail ? `${previous.detail} · ${part}` : part;
        continue;
      }
    }

    const describe = DESCRIBE[l.action];
    const base = describe
      ? describe(l)
      : { icon: "•", headline: "تحديث على الأوردر", detail: l.newValue ?? undefined, milestone: false as boolean };

    events.push({
      id: l.id,
      actor: l.userName,
      at: l.timestamp,
      source: l.source,
      reason: l.reason,
      ...base,
    });
  }
  return events;
}

/** Latest meaningful activity, for "who touched this last and when" on a card. */
export function latestActivity(logs: AuditLogDTO[]): TimelineEvent | null {
  const events = buildTimeline(logs);
  return events.length ? events[events.length - 1] : null;
}

export const SOURCE_LABEL: Record<string, string> = {
  user: "مستخدم",
  manual: "يدوي",
  system: "نظام",
  n8n: "أوتوماتيك",
  hermes: "Hermes",
};

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}
