import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAnyPermission } from "@/lib/authz";
import { getRfq } from "@/lib/purchasing/rfq";

/** Quotes carry prices: readable by the buyer and by price viewers. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAnyPermission(req, ["purchasing.rfq.manage", "purchasing.prices.view"]);
    return NextResponse.json({ rfq: await getRfq(params.id) });
  } catch (err) {
    return handleApiError(err);
  }
}
