import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { getMasterData } from "@/lib/core/org-service";

/** The whole organisation structure plus units and currencies, inactive included. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "core.masterdata.view");
    return NextResponse.json(await getMasterData());
  } catch (err) {
    return handleApiError(err);
  }
}
