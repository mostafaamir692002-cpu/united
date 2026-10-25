import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { listPayments } from "@/lib/accounting/cash";
import { createPayment } from "@/lib/accounting/cash";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json(await listPayments({ supplierId: sp.get("supplier_id") ?? undefined, limit: Number(sp.get("limit")) || undefined, offset: Number(sp.get("offset")) || undefined }));
  } catch (err) {
    return handleApiError(err, req);
  }
}
export const POST = postHandler("accounting.payments.manage", async (body, actor) => ({ payment: await createPayment(body, actor) }));
