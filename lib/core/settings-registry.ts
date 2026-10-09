import { z } from "zod";

/**
 * The catalogue of system settings — every operational policy number the business
 * can tune without a code change.
 *
 * Code is the source of truth for WHICH settings exist, their type, their bounds and
 * their default. The database only stores values someone has deliberately changed
 * (see SystemSetting); a key with no row resolves to the default below. That makes
 * adding a setting a code change with no data migration, and makes "reset to default"
 * the same as "delete the override".
 *
 * Pure and dependency-light on purpose: it is imported by the client (to label and
 * validate the admin form) as well as the server.
 */

export const SETTING_GROUPS = ["orders", "approvals", "documents", "inventory", "sales", "purchasing", "hr"] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

export const SETTING_GROUP_LABEL: Record<SettingGroup, string> = {
  orders: "تشغيل الأوردرات",
  approvals: "الموافقات",
  documents: "المستندات والمرفقات",
  inventory: "المخزون",
  sales: "المبيعات والائتمان",
  purchasing: "المشتريات",
  hr: "المصروفات والموظفين",
};

type Def<T> = {
  group: SettingGroup;
  label: string;
  description: string;
  /** Shown next to the value — "%", "دقيقة". */
  unit: string;
  schema: z.ZodType<T>;
  default: T;
};

function def<T>(d: Def<T>): Def<T> {
  return d;
}

const minutes = (max: number) => z.number().int("لازم يكون رقم صحيح").min(1, "أقل قيمة 1").max(max, `أكبر قيمة ${max}`);

export const SETTING_DEFS = {
  "orders.shortage_review_threshold_pct": def({
    group: "orders",
    label: "حد الفرق اللي محتاج اعتماد",
    description:
      "لو الكمية المتجهزة أو المتحملة فرقت عن المطلوب بأكتر من النسبة دي (زيادة أو نقص)، الأوردر بيقف لحد ما المشرف يعتمده.",
    unit: "%",
    schema: z.number().min(0, "أقل قيمة 0").max(100, "أكبر قيمة 100"),
    default: 5,
  }),
  "orders.waiting_to_start_minutes": def({
    group: "orders",
    label: "مهلة بدء التجهيز",
    description: "أوردر جديد محدش بدأ فيه بعد المدة دي بيظهر للمشرف إنه مستني.",
    unit: "دقيقة",
    schema: minutes(24 * 60),
    default: 20,
  }),
  "orders.stalled_minutes": def({
    group: "orders",
    label: "مهلة التوقف",
    description: "أوردر شغال محدش لمسه المدة دي بيتعلّم إنه متوقف.",
    unit: "دقيقة",
    schema: minutes(24 * 60),
    default: 45,
  }),
  "orders.delivery_soon_minutes": def({
    group: "orders",
    label: "تنبيه قرب ميعاد التسليم",
    description: "الأوردر بيتعلّم «قريب من الميعاد» لما يفضل على التسليم أقل من المدة دي.",
    unit: "دقيقة",
    schema: minutes(24 * 60),
    default: 60,
  }),
  "approvals.require_different_approver": def({
    group: "approvals",
    label: "الموافقة لازم تكون من شخص غير الطالب",
    description:
      "لو مفعّل، اللي طلب الموافقة (أو اللي سجّل الكمية الناقصة) مينفعش يوافق بنفسه — لازم شخص تاني عنده الصلاحية. مقفول افتراضيًا علشان المشرف يقدر يكمل الشغل لوحده لو مفيش غيره.",
    unit: "",
    schema: z.boolean({ invalid_type_error: "القيمة لازم تكون true أو false" }),
    default: false,
  }),
  "documents.max_upload_mb": def({
    group: "documents",
    label: "أقصى حجم للملف المرفوع",
    description: "أي ملف أكبر من كده بيترفض قبل ما يترفع.",
    unit: "ميجا",
    schema: z.number().int("لازم يكون رقم صحيح").min(1, "أقل قيمة 1").max(50, "أكبر قيمة 50"),
    default: 10,
  }),
  "inventory.default_warehouse_code": def({
    group: "inventory",
    label: "المخزن الافتراضي",
    description: "كود المخزن اللي الاستلام والتسويات بتروحله لما الشاشة متحددش مخزن.",
    unit: "",
    schema: z.string().trim().min(1, "الكود مطلوب").max(40).regex(/^[A-Z0-9][A-Z0-9_-]*$/, "كود مخزن غير صالح"),
    default: "WH-MAIN",
  }),
  "inventory.adjustment_approval_threshold": def({
    group: "inventory",
    label: "حد التسوية اللي محتاجة موافقة",
    description:
      "أي تسوية مخزون (زيادة أو نقص) أكبر من الكمية دي بوحدة الصنف الأساسية بتستنى موافقة قبل ما تتسجل. صفر = من غير موافقة.",
    unit: "بوحدة الصنف",
    schema: z.number().min(0, "أقل قيمة 0").max(1_000_000),
    default: 0,
  }),
  "inventory.expiry_warning_days": def({
    group: "inventory",
    label: "تنبيه قرب انتهاء الصلاحية",
    description: "الدفعات اللي هتنتهي صلاحيتها خلال الأيام دي بتظهر في تقرير قرب الانتهاء.",
    unit: "يوم",
    schema: z.number().int().min(0).max(365),
    default: 2,
  }),
  "inventory.dispatch_issue_policy": def({
    group: "inventory",
    label: "صرف المخزون عند خروج الأوردر",
    description:
      "lenient: الأوردر بيخرج دايماً، واللي ملوش رصيد كفاية أو صنفه مش معروف بيتسجل كاستثناء لأمين المخزن يراجعه. strict: الأوردر مايخرجش لو رصيد صنف متتبع مش كفاية.",
    unit: "",
    schema: z.enum(["lenient", "strict"], { errorMap: () => ({ message: "القيمة لازم تكون lenient أو strict" }) }),
    default: "lenient" as "lenient" | "strict",
  }),
  "sales.credit_check_mode": def({
    group: "sales",
    label: "رقابة الائتمان",
    description:
      "off: من غير رقابة. warn: الأوردر بيكمل، والحسابات بيوصلها تنبيه لو العميل الآجل عدّى حده أو موقوف. block: الأوردر مايبدأش تجهيز غير بموافقة الحسابات.",
    unit: "",
    schema: z.enum(["off", "warn", "block"], { errorMap: () => ({ message: "القيمة لازم تكون off أو warn أو block" }) }),
    default: "warn" as "off" | "warn" | "block",
  }),
  "sales.auto_reserve": def({
    group: "sales",
    label: "حجز المخزون تلقائياً للأوردرات",
    description:
      "لما يتفعّل: كل أوردر لصنف متتبع بيحجز من المتاح (على قد الموجود) لحد ما يخرج. يُفضّل يتفعّل بعد ما تسجيل الاستلامات يبقى كامل، لأن المحجوز مايتعملوش هالك أو تسوية.",
    unit: "",
    schema: z.boolean(),
    default: false as boolean,
  }),
  "sales.eta_person_id_threshold": def({
    group: "sales",
    label: "حد الرقم القومي في الفاتورة الإلكترونية",
    description: "فاتورة لشخص طبيعي (مش شركة) بالمبلغ ده أو أكتر مايتبعتش لمصلحة الضرائب من غير الرقم القومي للعميل. القيمة حسب قواعد المنظومة المنشورة — يتأكد منها المحاسب.",
    unit: "ج.م",
    schema: z.number().min(0).max(100_000_000),
    default: 50_000,
  }),
  "sales.quotation_validity_days": def({
    group: "sales",
    label: "صلاحية عرض السعر",
    description: "عدد الأيام اللي عرض السعر بيفضل ساري فيها لو مااتحددش تاريخ.",
    unit: "يوم",
    schema: z.number().int().min(1).max(90),
    default: 3,
  }),
  "purchasing.po_approval_threshold": def({
    group: "purchasing",
    label: "حد اعتماد أمر الشراء",
    description: "أمر الشراء اللي إجماليه أكبر من المبلغ ده بيستنى اعتماد الحسابات قبل ما يتبعت للمورد. صفر = كل أوامر الشراء محتاجة اعتماد.",
    unit: "ج.م",
    schema: z.number().min(0).max(100_000_000),
    default: 10000,
  }),
  "purchasing.over_receipt_tolerance_pct": def({
    group: "purchasing",
    label: "سماحية الاستلام الزيادة",
    description: "أقصى زيادة مسموح بيها في الاستلام فوق الكمية المطلوبة في أمر الشراء (الأوزان في الخضار والفاكهة مش بالظبط).",
    unit: "%",
    schema: z.number().min(0).max(100),
    default: 10,
  }),
  "purchasing.bill_match_tolerance_pct": def({
    group: "purchasing",
    label: "سماحية مطابقة فاتورة المورد",
    description: "لو قيمة فاتورة المورد (قبل الضريبة) مختلفة عن قيمة الاستلام بالسعر المتفق عليه بأكتر من النسبة دي، الفاتورة بتستنى اعتماد قبل الترحيل.",
    unit: "%",
    schema: z.number().min(0).max(100),
    default: 1,
  }),
  "hr.expense_approval_threshold": def({
    group: "hr",
    label: "حد اعتماد المصروفات",
    description: "المصروف اللي مبلغه أكبر من ده بيستنى اعتماد قبل ما يترحّل للحسابات. صفر = كل المصروفات محتاجة اعتماد.",
    unit: "ج.م",
    schema: z.number().min(0).max(10_000_000),
    default: 500,
  }),
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;
export type SettingValue<K extends SettingKey> = (typeof SETTING_DEFS)[K]["default"];

export const SETTING_KEYS = Object.keys(SETTING_DEFS) as SettingKey[];

export function isSettingKey(value: unknown): value is SettingKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SETTING_DEFS, value);
}

/** Validates a candidate value. Returns the parsed value or the first error message. */
export function parseSettingValue<K extends SettingKey>(
  key: K,
  raw: unknown
): { ok: true; value: SettingValue<K> } | { ok: false; error: string } {
  const result = (SETTING_DEFS[key].schema as z.ZodType<SettingValue<K>>).safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "قيمة غير صالحة" };
}

/** The thresholds the order boards and the command center classify against. Served to
 * the client too, so a card and the server can never disagree on "stalled". */
export type OperationalSettings = {
  shortageReviewThresholdPct: number;
  waitingToStartMinutes: number;
  stalledMinutes: number;
  deliverySoonMinutes: number;
};

export const DEFAULT_OPERATIONAL_SETTINGS: OperationalSettings = {
  shortageReviewThresholdPct: SETTING_DEFS["orders.shortage_review_threshold_pct"].default,
  waitingToStartMinutes: SETTING_DEFS["orders.waiting_to_start_minutes"].default,
  stalledMinutes: SETTING_DEFS["orders.stalled_minutes"].default,
  deliverySoonMinutes: SETTING_DEFS["orders.delivery_soon_minutes"].default,
};
