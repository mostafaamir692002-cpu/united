import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { readJson } from "@/lib/http";
import { serviceActorFromContext } from "@/lib/core/actor";
import { createCustomerLegalEntity, listCustomerLegalEntities } from "@/lib/sales/customers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "sales.customers.view");
    return NextResponse.json({ legalEntities: await listCustomerLegalEntities() });
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission(req, "sales.customers.manage");
    return NextResponse.json({ legalEntity: await createCustomerLegalEntity(await readJson(req), serviceActorFromContext(ctx)) });
  } catch (err) {
    return handleApiError(err, req);
  }
}