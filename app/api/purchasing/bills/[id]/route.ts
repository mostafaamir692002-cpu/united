import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { getBill, updateBill } from "@/lib/purchasing/bills";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "purchasing.bills.view");
    return NextResponse.json({ bill: await getBill(params.id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PUT = postHandler("purchasing.bills.manage", async (body, actor, params) => {
  await updateBill(params.id, body, actor);
  return { bill: await getBill(params.id) };
}, () => 200);
