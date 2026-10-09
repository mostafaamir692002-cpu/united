import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAnyPermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** The sellable catalogue — names, units, packagings and tax class; no stock figures
 * (selling does not grant a view of the warehouse). */
export async function GET(req: NextRequest) {
  try {
    await requireAnyPermission(req, ["sales.quotations.view", "sales.pricing.view", "purchasing.orders.view", "purchasing.rfq.manage", "purchasing.prices.view"]);
    const products = await prisma.stockProduct.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameAr: true, unit: true, salesTaxCode: true, packagings: { where: { active: true }, select: { uomCode: true, qtyInBaseUnit: true } } },
    });
    return NextResponse.json({ products });
  } catch (err) {
    return handleApiError(err);
  }
}
