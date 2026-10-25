import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAuth } from "@/lib/authz";
import { readJson } from "@/lib/http";
import { decideApproval } from "@/lib/core/approval-handlers";

/** Body: { decision: "approve" | "reject", comment?, expected_version }. The engine
 * checks the type's own permission, so any signed-in user may call this and be
 * refused 403 if they cannot decide this particular request. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth(req);
    const body = await readJson(req);
    const request = await decideApproval(
      params.id,
      body.decision,
      { id: ctx.id, name: ctx.name, role: ctx.role, deviceId: ctx.deviceId, permissions: [...ctx.permissions] },
      { comment: typeof body.comment === "string" ? body.comment : undefined, expectedVersion: body.expected_version }
    );
    return NextResponse.json({ request });
  } catch (err) {
    return handleApiError(err, req);
  }
}
