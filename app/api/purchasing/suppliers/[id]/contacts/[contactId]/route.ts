import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { readJson } from "@/lib/http";
import { serviceActorFromContext } from "@/lib/core/actor";
import { saveSupplierContact } from "@/lib/purchasing/suppliers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; contactId: string } }) {
  try {
    const ctx = await requirePermission(req, "purchasing.suppliers.manage");
    return NextResponse.json({ contact: await saveSupplierContact(params.id, params.contactId, await readJson(req), serviceActorFromContext(ctx)) });
  } catch (err) {
    return handleApiError(err, req);
  }
}
