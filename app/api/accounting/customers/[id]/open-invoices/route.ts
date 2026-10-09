import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { openInvoices } from "@/lib/accounting/cash";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Record<string, string> }) {
  try {
    await requirePermission(req, "accounting.view");
    return NextResponse.json({ invoices: await openInvoices(prisma, params.id).then((r) => r.map((i) => ({ ...i, total: i.total.toFixed(2), open: i.open.toFixed(2) }))) });
  } catch (err) {
    return handleApiError(err);
  }
}
