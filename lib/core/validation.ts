import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/rbac";

/**
 * Input-parsing building blocks shared by the ERP services: Arabic messages, blank
 * optional text becomes null (clears the field), decimals arrive as numbers or
 * numeric strings and leave as Prisma.Decimal (never a float), and a failed parse is
 * a 400 carrying the first message.
 *
 * When locale is provided, returns English messages for "en".
 */

const MSG = {
  required: (label: string, locale?: string) =>
    locale === "en" ? `${label} is required` : `${label} مطلوب`,
  mustBeText: (label: string, locale?: string) =>
    locale === "en" ? `${label} must be text` : `${label} لازم يكون نص`,
  tooLong: (label: string, max: number, locale?: string) =>
    locale === "en" ? `${label} is too long (max ${max})` : `${label} طويل أوي`,
  mustBeNumber: (label: string, locale?: string) =>
    locale === "en" ? `${label} must be a number` : `${label} لازم يكون رقم`,
  minValue: (label: string, min: number, locale?: string) =>
    locale === "en" ? `${label} cannot be less than ${min}` : `${label} مينفعش يكون أقل من ${min}`,
  tooLarge: (label: string, locale?: string) =>
    locale === "en" ? `${label} is too large` : `${label} كبير أوي`,
  invalidActive: (locale?: string) =>
    locale === "en" ? "Active value must be true or false" : "قيمة التفعيل لازم تكون true أو false",
  invalidData: (locale?: string) =>
    locale === "en" ? "Invalid data" : "بيانات غير صالحة",
  fieldRequired: (field: string, locale?: string) =>
    locale === "en" ? `${field} is required` : `${field} مطلوب`,
  invalidType: (field: string, locale?: string) =>
    locale === "en" ? `${field}: Invalid type` : `${field}: نوع غير صالح`,
  invalidValue: (field: string, locale?: string) =>
    locale === "en" ? `${field}: Invalid value` : `${field}: قيمة غير صالحة`,
};

export const text = (label: string, max = 200, locale?: string) =>
  z
    .string({ required_error: MSG.required(label, locale), invalid_type_error: MSG.mustBeText(label, locale) })
    .trim()
    .min(1, MSG.required(label, locale))
    .max(max, MSG.tooLong(label, max, locale));

/** Optional text: blank becomes null (clears the field). */
export const optText = (label: string, max = 200, locale?: string) =>
  z
    .string({ invalid_type_error: MSG.mustBeText(label, locale) })
    .trim()
    .max(max, MSG.tooLong(label, max, locale))
    .nullable()
    .transform((v) => (v ? v : null));

/** A non-negative decimal sent as a number or a numeric string; null clears it. */
export const optDecimal = (label: string, { min = 0 as number | null, max = 1e12, locale }: { min?: number | null; max?: number; locale?: string } = {}) =>
  z
    .union([z.number(), z.string(), z.null()])
    .transform((v, ctx) => {
      if (v === null || (typeof v === "string" && v.trim() === "")) return null;
      const n = typeof v === "number" ? v : Number(v.trim());
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: MSG.mustBeNumber(label, locale) });
        return z.NEVER;
      }
      if (min !== null && n < min) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: MSG.minValue(label, min, locale) });
        return z.NEVER;
      }
      if (n > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: MSG.tooLarge(label, locale) });
        return z.NEVER;
      }
      return new Prisma.Decimal(typeof v === "number" ? String(v) : v.trim());
    });

export function active(locale?: string) {
  return z.boolean({ invalid_type_error: MSG.invalidActive(locale) });
}
export const activeRequired = z.boolean({ invalid_type_error: "قيمة التفعيل لازم تكون true أو false" });

export const version = z.number().int().nonnegative().optional();

export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown, locale?: string): z.infer<T> {
  const r = schema.safeParse(input ?? {});
  if (!r.success) throw new ApiError(400, issueMessage(r.error.issues[0], locale));
  return r.data;
}

/** zod's built-in messages are English ("Required", "Expected number, received string");
 * the user always gets an Arabic one that names the field. */
function issueMessage(i: z.ZodIssue | undefined, locale?: string): string {
  if (!i) return MSG.invalidData(locale);
  if (/[\u0600-\u06FF]/.test(i.message)) return i.message;
  const field = i.path.join(".") || MSG.invalidData(locale).split(" ")[0];
  if (i.code === "invalid_type") return i.received === "undefined" || i.received === "null"
    ? MSG.fieldRequired(field, locale)
    : MSG.invalidType(field, locale);
  return MSG.invalidValue(field, locale);
}