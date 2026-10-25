import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { listTaxRates } from "@/lib/sales/pricing";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "sales.pricing.view");
    return NextResponse.json({ taxRates: await listTaxRates() });
  } catch (err) {
    return handleApiError(err, req);
  }
}
