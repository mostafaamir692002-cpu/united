import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { isValidISODate } from "@/lib/dates";
import { agingReport } from "@/lib/sales/invoicing";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "sales.invoices.view");
    const asOf = new URL(req.url).searchParams.get("as_of");
    return NextResponse.json(await agingReport(asOf && isValidISODate(asOf) ? asOf : undefined));
  } catch (err) {
    return handleApiError(err, req);
  }
}
