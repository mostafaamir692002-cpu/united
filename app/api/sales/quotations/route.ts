import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { createQuotation, listQuotations } from "@/lib/sales/quotations";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "sales.quotations.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ quotations: await listQuotations({ status: sp.get("status") ?? undefined, customerId: sp.get("customer_id") ?? undefined }) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = postHandler("sales.quotations.manage", (body, actor) => createQuotation(body, actor).then((quotation) => ({ quotation })));
