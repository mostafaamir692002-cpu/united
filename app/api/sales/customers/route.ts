import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { createCustomer, listCustomers } from "@/lib/sales/customers";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "sales.customers.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ customers: await listCustomers({ q: sp.get("q") ?? undefined, includeInactive: sp.get("include_inactive") === "1" }) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = postHandler("sales.customers.manage", (body, actor) => createCustomer(body, actor).then((customer) => ({ customer })));
