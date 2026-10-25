import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { createPriceList, listPriceLists } from "@/lib/sales/pricing";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "sales.pricing.view");
    return NextResponse.json({ priceLists: await listPriceLists() });
  } catch (err) {
    return handleApiError(err, req);
  }
}

export const POST = postHandler("sales.pricing.manage", (body, actor) => createPriceList(body, actor).then((priceList) => ({ priceList })));
