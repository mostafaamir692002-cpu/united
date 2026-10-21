import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { expiringStock } from "@/lib/inventory/reports";

export async function GET(req: NextRequest) {
  try {
    const viewer = await requirePermission(req, "stock.view");
    const sp = new URL(req.url).searchParams;
    const days = sp.get("days");
    return jsonFor(viewer, await expiringStock({ days: days ? Math.max(0, Math.min(365, Number(days) || 0)) : undefined, warehouseId: sp.get("warehouse_id") ?? undefined }));
  } catch (err) {
    return handleApiError(err);
  }
}
