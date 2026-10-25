import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { orderPricing } from "@/lib/sales/pricing";

/** The commercial side of an order — kept off the order payload itself, which every
 * floor role reads. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "sales.pricing.view");
    return NextResponse.json(await orderPricing(params.id));
  } catch (err) {
    return handleApiError(err, req);
  }
}
