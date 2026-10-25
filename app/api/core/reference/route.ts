import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAnyPermission } from "@/lib/authz";
import { getReferenceData } from "@/lib/core/org-service";

/**
 * Active units, currencies, warehouses and their locations — the lists operational
 * screens pick from. Reading the reference data a module works with is part of that
 * module's own view permission, so a stock controller or a supervisor does not need a
 * separate master-data grant just to see which units exist.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAnyPermission(req, ["core.masterdata.view", "stock.view", "orders.view"]);
    return NextResponse.json(await getReferenceData());
  } catch (err) {
    return handleApiError(err, req);
  }
}
