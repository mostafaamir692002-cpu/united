import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { unmappedOrderCustomers } from "@/lib/sales/customers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "sales.customers.view");
    return NextResponse.json({ names: await unmappedOrderCustomers() });
  } catch (err) {
    return handleApiError(err, req);
  }
}
