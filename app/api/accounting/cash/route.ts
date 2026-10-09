import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { cashPosition } from "@/lib/accounting/cash";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    return NextResponse.json({ cash: await cashPosition() });
  } catch (err) {
    return handleApiError(err);
  }
}
