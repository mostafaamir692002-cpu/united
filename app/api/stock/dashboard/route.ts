import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { ApiError, handleApiError } from "@/lib/rbac";
import { isValidISODate } from "@/lib/dates";
import { requireStockActor } from "@/lib/stock-auth";
import { stockDashboard } from "@/lib/stock-service";
import { todayLocalISO } from "@/lib/localDate";

/** One round trip for the whole dashboard: today, current stock, recent movements,
 * weekly/monthly totals and supplier performance. `date` is accepted so the screen
 * can report the tablet's local day rather than the server's. */
export async function GET(req: NextRequest) {
  try {
    const viewer = await requireStockActor(req, "stock.view");
    const date = new URL(req.url).searchParams.get("date") ?? todayLocalISO();
    if (!isValidISODate(date)) throw new ApiError(400, "التاريخ لازم يكون YYYY-MM-DD");
    return jsonFor(viewer, await stockDashboard(date));
  } catch (err) {
    return handleApiError(err);
  }
}
