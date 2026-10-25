import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { todayLocalISO } from "@/lib/localDate";
import { supplierStatement } from "@/lib/purchasing/bills";
import { toCsv, csvResponse } from "@/lib/core/csv-export";

/** Excel-safe CSV export of a supplier statement — same data as the JSON view. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "purchasing.bills.view");
    const sp = new URL(req.url).searchParams;
    const to = sp.get("to") ?? todayLocalISO();
    const from = sp.get("from") ?? `${to.slice(0, 4)}-01-01`;
    const st = await supplierStatement(params.id, from, to);
    const rows: Record<string, unknown>[] = [
      { date: "كشف حساب", kind: st.supplier.name, number: `من ${st.from} إلى ${st.to}`, reference: "", debit: "", credit: "", balance: "" },
      { date: st.opening, kind: "الرصيد الافتتاحي", number: "", reference: "", debit: "", credit: "", balance: st.opening },
      ...st.rows.map((r) => ({ date: r.date, kind: r.kind, number: r.number, reference: r.ref, debit: r.debit, credit: r.credit, balance: r.balance })),
      { date: st.closing, kind: "الرصيد الختامي", number: "", reference: "", debit: "", credit: "", balance: st.closing },
    ];
    return csvResponse(toCsv(rows), `supplier-statement-${st.supplier.code || st.supplier.id}-${from}-${to}`);
  } catch (err) {
    return handleApiError(err, req);
  }
}