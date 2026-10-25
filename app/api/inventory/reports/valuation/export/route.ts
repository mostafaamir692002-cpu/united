import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { valuationReport } from "@/lib/inventory/reports";
import { toCsv, csvResponse } from "@/lib/core/csv-export";

/** Excel-safe CSV export of the inventory valuation report. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "stock.valuation.view");
    const r = await valuationReport();
    const rows: Record<string, unknown>[] = [
      { product: "قيمة المخزون", unit: r.currency, quantity: "", value: r.totalValue.toString(), averageCost: "" },
      ...r.rows.map((x) => ({
        product: x.productNameAr ?? x.productName,
        unit: x.unit,
        quantity: x.quantity.toString(),
        value: x.value.toString(),
        averageCost: x.averageCost?.toString() ?? "",
      })),
    ];
    return csvResponse(toCsv(rows), `inventory-valuation-${new Date().toISOString().slice(0, 10)}`);
  } catch (err) {
    return handleApiError(err, req);
  }
}