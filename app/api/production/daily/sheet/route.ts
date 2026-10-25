import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireOrderActor } from "@/lib/api-auth";
import { dailyConsolidatedSheet } from "@/lib/picking-sheet";
import { todayLocalISO } from "@/lib/localDate";

/**
 * GET /api/production/daily/sheet?date=YYYY-MM-DD
 *
 * Returns a consolidated daily picking sheet grouped by product with
 * per-customer allocations. Date defaults to today.
 */
export async function GET(req: NextRequest) {
  try {
    await requireOrderActor(req, "orders.view");
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? todayLocalISO();
    const sheet = await dailyConsolidatedSheet(date);
    return NextResponse.json(sheet);
  } catch (err) {
    return handleApiError(err, req);
  }
}