import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { releaseFromQuarantine } from "@/lib/inventory/documents";
import { readJson } from "@/lib/http";

/**
 * POST /api/inventory/release
 *
 * Authorised release of quarantined stock to a non-quarantine, non-waste
 * location.  Body: { product_id, location_id, destination_id, quantity,
 * lot_id?, reason, inspection_note?, business_date?, idempotency_key? }
 *
 * Returns the release InventoryDocument with movements and payload.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireStockActor(req, "stock.adjust");
    const body = await readJson(req);
    const { document, replayed } = await releaseFromQuarantine(body, actor);
    return jsonFor(actor, { document }, { status: replayed ? 200 : 201 });
  } catch (err) {
    return handleApiError(err);
  }
}