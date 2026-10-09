import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAuth } from "@/lib/authz";
import { listApprovals } from "@/lib/core/approvals";

/** Requests the caller may decide, plus the ones they raised. ?status=pending|approved|rejected|cancelled */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const sp = new URL(req.url).searchParams;
    const approvals = await listApprovals(
      { id: ctx.id, permissions: [...ctx.permissions] },
      { status: sp.get("status") ?? undefined, limit: Number(sp.get("limit")) || undefined }
    );
    return NextResponse.json({ approvals });
  } catch (err) {
    return handleApiError(err);
  }
}
