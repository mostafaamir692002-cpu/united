import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { listSettings } from "@/lib/core/settings-service";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "settings.manage");
    return NextResponse.json({ settings: await listSettings() });
  } catch (err) {
    return handleApiError(err, req);
  }
}
