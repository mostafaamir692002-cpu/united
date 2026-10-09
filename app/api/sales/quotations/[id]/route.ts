import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { readJson } from "@/lib/http";
import { serviceActorFromContext } from "@/lib/core/actor";
import { getQuotation, updateQuotation } from "@/lib/sales/quotations";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "sales.quotations.view");
    return NextResponse.json({ quotation: await getQuotation(params.id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requirePermission(req, "sales.quotations.manage");
    return NextResponse.json({ quotation: await updateQuotation(params.id, await readJson(req), serviceActorFromContext(ctx)) });
  } catch (err) {
    return handleApiError(err);
  }
}
