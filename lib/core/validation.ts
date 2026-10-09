import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/rbac";

/**
 * Input-parsing building blocks shared by the ERP services: Arabic messages, blank
 * optional text becomes null (clears the field), decimals arrive as numbers or
 * numeric strings and leave as Prisma.Decimal (never a float), and a failed parse is
 * a 400 carrying the first message.
 */

export const text = (label: string, max = 200) =>
  z
    .string({ required_error: `${label} مطلوب`, invalid_type_error: `${label} لازم يكون نص` })
    .trim()
    .min(1, `${label} مطلوب`)
    .max(max, `${label} طويل أوي`);

/** Optional text: blank becomes null (clears the field). */
export const optText = (label: string, max = 200) =>
  z
    .string({ invalid_type_error: `${label} لازم يكون نص` })
    .trim()
    .max(max, `${label} طويل أوي`)
    .nullable()
    .transform((v) => (v ? v : null));

/** A non-negative decimal sent as a number or a numeric string; null clears it. */
export const optDecimal = (label: string, { min = 0 as number | null, max = 1e12 } = {}) =>
  z
    .union([z.number(), z.string(), z.null()])
    .transform((v, ctx) => {
      if (v === null || (typeof v === "string" && v.trim() === "")) return null;
      const n = typeof v === "number" ? v : Number(v.trim());
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} لازم يكون رقم` });
        return z.NEVER;
      }
      if (min !== null && n < min) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} مينفعش يكون أقل من ${min}` });
        return z.NEVER;
      }
      if (n > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} كبير أوي` });
        return z.NEVER;
      }
      return new Prisma.Decimal(typeof v === "number" ? String(v) : v.trim());
    });

export const active = z.boolean({ invalid_type_error: "قيمة التفعيل لازم تكون true أو false" });
export const version = z.number().int().nonnegative().optional();

export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input ?? {});
  if (!r.success) throw new ApiError(400, issueMessage(r.error.issues[0]));
  return r.data;
}


/** zod's built-in messages are English ("Required", "Expected number, received string");
 * the user always gets an Arabic one that names the field. */
function issueMessage(i: z.ZodIssue | undefined): string {
  if (!i) return "بيانات غير صالحة";
  if (/[\u0600-\u06FF]/.test(i.message)) return i.message;
  const field = i.path.join(".") || "البيانات";
  if (i.code === "invalid_type") return i.received === "undefined" || i.received === "null" ? `${field} مطلوب` : `${field}: نوع غير صالح`;
  return `${field}: قيمة غير صالحة`;
}
