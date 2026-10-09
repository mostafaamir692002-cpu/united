import { NextRequest, NextResponse } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { listReservations, reserve } from "@/lib/inventory/reservations";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    const viewer = await requirePermission(req, "stock.view");
    const sp = new URL(req.url).searchParams;
    return jsonFor(viewer, {
      reservations: await listReservations({ productId: sp.get("product_id") ?? undefined, sourceId: sp.get("source_id") ?? undefined, status: sp.get("status") ?? undefined }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = postHandler("stock.reserve", (body, actor) => reserve(body, actor), (r) => ((r as { created?: boolean }).created ? 201 : 200));
