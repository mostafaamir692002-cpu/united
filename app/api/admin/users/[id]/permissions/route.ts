import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { getUserPermissionDetail, setUserPermissionOverride } from "@/lib/admin-service";
import { readJson } from "@/lib/http";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "users.view");
    return NextResponse.json(await getUserPermissionDetail(params.id));
  } catch (err) {
    return handleApiError(err, req);
  }
}

/** Set (grant/revoke) or clear (effect: null) one per-user permission override. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission(req, "settings.manage");
    const body = await readJson(req);
    await setUserPermissionOverride(
      params.id,
      body.permission,
      body.effect ?? null,
      actor,
      body.reason
    );
    return NextResponse.json(await getUserPermissionDetail(params.id));
  } catch (err) {
    return handleApiError(err, req);
  }
}
