import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireOrderActor } from "@/lib/api-auth";
import { dailyProduction } from "@/lib/orders-service";
import { todayLocalISO } from "@/lib/localDate";

export async function GET(req: NextRequest) {
  try {
    await requireOrderActor(req, "orders.view");
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? todayLocalISO();
    const products = await dailyProduction();
    return NextResponse.json({ date, products });
  } catch (err) {
    return handleApiError(err, req);
  }
}
