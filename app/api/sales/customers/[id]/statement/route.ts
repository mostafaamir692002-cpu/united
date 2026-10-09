import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { todayLocalISO } from "@/lib/localDate";
import { customerStatement } from "@/lib/sales/invoicing";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "sales.invoices.view");
    const sp = new URL(req.url).searchParams;
    const to = sp.get("to") ?? todayLocalISO();
    const from = sp.get("from") ?? `${to.slice(0, 4)}-01-01`;
    return NextResponse.json(await customerStatement(params.id, from, to));
  } catch (err) {
    return handleApiError(err);
  }
}
