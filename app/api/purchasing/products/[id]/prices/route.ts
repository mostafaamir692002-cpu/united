import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { isValidISODate } from "@/lib/dates";
import { productSupplierPrices } from "@/lib/purchasing/suppliers";

/** Every supplier's current price for one product, cheapest first. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "purchasing.prices.view");
    const date = new URL(req.url).searchParams.get("date");
    return NextResponse.json(await productSupplierPrices(params.id, date && isValidISODate(date) ? date : undefined));
  } catch (err) {
    return handleApiError(err);
  }
}
