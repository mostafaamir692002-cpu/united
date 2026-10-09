import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { todayLocalISO } from "@/lib/localDate";
import { supplierPayable, supplierStatement } from "@/lib/purchasing/bills";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "purchasing.bills.view");
    const sp = new URL(req.url).searchParams;
    const to = sp.get("to") ?? todayLocalISO();
    const from = sp.get("from") ?? `${to.slice(0, 4)}-01-01`;
    const statement = await supplierStatement(params.id, from, to);
    return NextResponse.json({ statement, payable: (await supplierPayable(prisma, params.id)).toFixed(2) });
  } catch (err) {
    return handleApiError(err);
  }
}
