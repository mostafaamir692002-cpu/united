import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { readJson } from "@/lib/http";
import { serviceActorFromContext } from "@/lib/core/actor";
import { getSupplier, updateSupplierTerms } from "@/lib/purchasing/suppliers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "purchasing.suppliers.view");
    return NextResponse.json({ supplier: await getSupplier(params.id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requirePermission(req, "purchasing.suppliers.manage");
    return NextResponse.json({ supplier: await updateSupplierTerms(params.id, await readJson(req), serviceActorFromContext(ctx)) });
  } catch (err) {
    return handleApiError(err);
  }
}
