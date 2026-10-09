import { z } from "zod";
import { ApiError } from "@/lib/rbac";

/** UNITED keeps one statutory ledger, in Egyptian pounds, until FX valuation is implemented. */
export const egpCurrencyCode = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => value === "EGP", "عملة المتحدة الحالية هي الجنيه المصري فقط (EGP)");

export function assertEgpCurrency(currencyCode: string, document = "المستند"): void {
  if (currencyCode !== "EGP") {
    throw new ApiError(400, `${document}: العملة المدعومة حاليًا هي الجنيه المصري فقط (EGP)`);
  }
}
