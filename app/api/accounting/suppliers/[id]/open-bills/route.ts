import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { openBills } from "@/lib/accounting/cash";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Record<string, string> }) {
  try {
    await requirePermission(req, "accounting.view");
    return NextResponse.json({ bills: await openBills(prisma, params.id).then((r) => r.map((b) => ({ ...b, total: b.total.toFixed(2), open: b.open.toFixed(2) }))) });
  } catch (err) {
    return handleApiError(err, req);
  }
}
