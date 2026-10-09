import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { employeeStatement } from "@/lib/hr/service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "hr.employees.manage");
    return NextResponse.json({ statement: await employeeStatement(params.id) });
  } catch (err) {
    return handleApiError(err);
  }
}
