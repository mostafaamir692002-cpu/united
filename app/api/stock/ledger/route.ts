import { NextRequest, NextResponse } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { currentStock, listMovements } from "@/lib/stock-service";

export async function GET(req: NextRequest) {
  try {
    const viewer = await requireStockActor(req, "stock.view");
    const q = new URL(req.url).searchParams;
    const [movements, stock] = await Promise.all([
      listMovements({
        productId: q.get("product_id") ?? undefined,
        from: q.get("from") ?? undefined,
        to: q.get("to") ?? undefined,
        limit: q.get("limit") ? Number(q.get("limit")) : 100,
      }),
      currentStock(),
    ]);
    return jsonFor(viewer, { movements, currentStock: stock });
  } catch (err) {
    return handleApiError(err);
  }
}
