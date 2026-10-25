import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { setSupplierPrices, supplierPriceHistory } from "@/lib/purchasing/suppliers";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "purchasing.prices.view");
    return NextResponse.json({ prices: await supplierPriceHistory(params.id) });
  } catch (err) {
    return handleApiError(err, req);
  }
}

export const POST = postHandler("purchasing.prices.manage", (body, actor, params) => setSupplierPrices(params.id, body, actor), () => 200);
