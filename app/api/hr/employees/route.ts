import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { listEmployees, saveEmployee } from "@/lib/hr/service";
import { postHandler } from "@/lib/route-handlers";

/** Employees and departments — for anyone recording expenses (to pick who) and HR. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "hr.expenses.submit");
    return NextResponse.json(await listEmployees());
  } catch (err) {
    return handleApiError(err, req);
  }
}

export const POST = postHandler("hr.employees.manage", async (body, actor) => ({ employee: await saveEmployee(null, body, actor) }));
