import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { serviceActorFromContext } from "@/lib/core/actor";
import { removeCustomerAlias } from "@/lib/sales/customers";

export async function DELETE(req: NextRequest, { params }: { params: { aliasId: string } }) {
  try {
    const ctx = await requirePermission(req, "sales.customers.manage");
    return NextResponse.json(await removeCustomerAlias(params.aliasId, serviceActorFromContext(ctx)));
  } catch (err) {
    return handleApiError(err, req);
  }
}
