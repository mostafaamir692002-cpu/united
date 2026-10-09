import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { revokeUserSessions } from "@/lib/admin-service";

/** Sign the user out everywhere. Same permission as disabling the account: both cut a
 * person off; this one lets them sign straight back in. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission(req, "users.disable");
    const user = await revokeUserSessions(params.id, actor);
    return NextResponse.json({ user: { id: user.id, version: user.version } });
  } catch (err) {
    return handleApiError(err);
  }
}
