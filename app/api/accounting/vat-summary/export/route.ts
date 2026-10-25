import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { vatSummary } from "@/lib/accounting/vat-summary";
import { todayLocalISO } from "@/lib/localDate";
import { toCsv, csvResponse } from "@/lib/core/csv-export";

/** Excel-safe CSV export of the VAT summary for a date range. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    const params = new URL(req.url).searchParams;
    const today = todayLocalISO();
    const from = params.get("from") ?? `${today.slice(0, 4)}-01-01`;
    const to = params.get("to") ?? today;
    const s = await vatSummary(from, to);
    const rows: Record<string, unknown>[] = [
      { section: `ملخص ضريبة القيمة المضافة من ${s.from} إلى ${s.to}`, output: "", input: "", diff: "" },
      { section: "الإجمالي", output: s.totals.outputTax, input: s.totals.inputTax, diff: s.totals.netPayable },
    ];
    for (const l of s.lines) rows.push({ section: `  ${l.taxName} (${l.taxCode} @${l.rate}%)`, output: l.outputTax, input: l.inputTax, diff: "" });
    rows.push({ section: "التسوية مع الأستاذ", output: s.ledger.reconciled ? "مطابق" : "فيه فرق", input: "", diff: "" });
    return csvResponse(toCsv(rows), `vat-summary-${from}-${to}`);
  } catch (err) {
    return handleApiError(err, req);
  }
}