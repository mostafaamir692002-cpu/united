import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/rbac";
import { requireAuth } from "@/lib/authz";
import { serviceActorFromContext } from "@/lib/core/actor";
import { listAttachments, uploadAttachment } from "@/lib/core/attachments";

/** GET ?entity_type=order&entity_id=… — the record's attachments. */
export async function GET(req: NextRequest) {
  try {
    const actor = serviceActorFromContext(await requireAuth(req));
    const sp = new URL(req.url).searchParams;
    const attachments = await listAttachments(sp.get("entity_type"), sp.get("entity_id"), actor, {
      includeDeleted: sp.get("include_deleted") === "1",
    });
    return NextResponse.json({ attachments });
  } catch (err) {
    return handleApiError(err, req);
  }
}

/** multipart/form-data: entity_type, entity_id, category, description?, file. */
export async function POST(req: NextRequest) {
  try {
    const actor = serviceActorFromContext(await requireAuth(req));
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError(400, "الطلب لازم يكون multipart/form-data فيه ملف");
    }
    const file = form.get("file");
    const result = await uploadAttachment(
      {
        entityType: form.get("entity_type"),
        entityId: form.get("entity_id"),
        category: form.get("category") ?? undefined,
        description: form.get("description") ?? undefined,
        file: file instanceof File ? file : null,
      },
      actor
    );
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (err) {
    return handleApiError(err, req);
  }
}
