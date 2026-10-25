import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { integrityReport } from "@/lib/accounting/integrity";

/** Every subledger against its GL account, and anything that should have posted but did not. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    return NextResponse.json({ integrity: await integrityReport() });
  } catch (err) {
    return handleApiError(err, req);
  }
}
