import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAuth } from "@/lib/authz";
import { readJson } from "@/lib/http";
import { serviceActorFromContext } from "@/lib/core/actor";
import { deleteAttachment } from "@/lib/core/attachments";

/** Soft delete. Body: { reason }. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = serviceActorFromContext(await requireAuth(req));
    const body = await readJson(req);
    return NextResponse.json(await deleteAttachment(params.id, body.reason, actor));
  } catch (err) {
    return handleApiError(err);
  }
}
