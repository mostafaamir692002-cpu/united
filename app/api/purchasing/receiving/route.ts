import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { openLinesForReceiving } from "@/lib/purchasing/receiving";

/** Open purchase-order lines the gate can receive against — quantities only, no prices. */
export async function GET(req: NextRequest) {
  try {
    await requireStockActor(req, "stock.receive");
    const supplierId = new URL(req.url).searchParams.get("supplier_id") ?? undefined;
    return NextResponse.json({ lines: await openLinesForReceiving({ supplierId }) });
  } catch (err) {
    return handleApiError(err);
  }
}
