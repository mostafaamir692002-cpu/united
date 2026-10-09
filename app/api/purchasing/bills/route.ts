import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { createBill, getBill, listBills } from "@/lib/purchasing/bills";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "purchasing.bills.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ bills: await listBills({ status: sp.get("status") ?? undefined, supplierId: sp.get("supplier_id") ?? undefined }) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = postHandler("purchasing.bills.manage", async (body, actor) => ({ bill: await getBill((await createBill(body, actor)).id) }));
