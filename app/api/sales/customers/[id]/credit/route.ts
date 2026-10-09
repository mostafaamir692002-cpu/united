import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { readJson } from "@/lib/http";
import { serviceActorFromContext } from "@/lib/core/actor";
import { updateCustomerCredit } from "@/lib/sales/customers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requirePermission(req, "sales.credit.manage");
    return NextResponse.json({ customer: await updateCustomerCredit(params.id, await readJson(req), serviceActorFromContext(ctx)) });
  } catch (err) {
    return handleApiError(err);
  }
}
