import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { readJson } from "@/lib/http";
import { serviceActorFromContext } from "@/lib/core/actor";
import { isValidISODate } from "@/lib/dates";
import { priceListDetail, updatePriceList } from "@/lib/sales/pricing";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "sales.pricing.view");
    const date = new URL(req.url).searchParams.get("date");
    return NextResponse.json(await priceListDetail(params.id, date && isValidISODate(date) ? date : undefined));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requirePermission(req, "sales.pricing.manage");
    return NextResponse.json({ priceList: await updatePriceList(params.id, await readJson(req), serviceActorFromContext(ctx)) });
  } catch (err) {
    return handleApiError(err);
  }
}
