import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { valuationReport } from "@/lib/inventory/reports";

export async function GET(req: NextRequest) {
  try {
    const viewer = await requirePermission(req, "stock.valuation.view");
    return jsonFor(viewer, await valuationReport());
  } catch (err) {
    return handleApiError(err, req);
  }
}
