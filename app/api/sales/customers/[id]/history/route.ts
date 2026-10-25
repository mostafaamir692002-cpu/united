import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { customerHistory } from "@/lib/sales/customers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "sales.customers.view");
    return NextResponse.json({ logs: await customerHistory(params.id) });
  } catch (err) {
    return handleApiError(err, req);
  }
}
