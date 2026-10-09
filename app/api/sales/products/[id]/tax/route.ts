import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { readJson } from "@/lib/http";
import { serviceActorFromContext } from "@/lib/core/actor";
import { setProductTax } from "@/lib/sales/pricing";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requirePermission(req, "sales.tax.manage");
    return NextResponse.json({ product: await setProductTax(params.id, await readJson(req), serviceActorFromContext(ctx)) });
  } catch (err) {
    return handleApiError(err);
  }
}
