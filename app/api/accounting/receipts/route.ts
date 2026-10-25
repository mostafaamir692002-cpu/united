import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { listReceipts } from "@/lib/accounting/cash";
import { createReceipt } from "@/lib/accounting/cash";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json(await listReceipts({ customerId: sp.get("customer_id") ?? undefined, limit: Number(sp.get("limit")) || undefined, offset: Number(sp.get("offset")) || undefined }));
  } catch (err) {
    return handleApiError(err, req);
  }
}
export const POST = postHandler("accounting.receipts.manage", async (body, actor) => ({ receipt: await createReceipt(body, actor) }));
