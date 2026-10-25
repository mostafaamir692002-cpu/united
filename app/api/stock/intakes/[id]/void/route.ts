import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { voidIntake } from "@/lib/stock-service";
import { readJson } from "@/lib/http";

/** Voids a receipt entered in error. Nothing is deleted — a compensating ledger entry
 * reverses it, so the mistake and its correction both stay auditable. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireStockActor(req, "stock.sort");
    const body = await readJson(req);
    const intake = await voidIntake(params.id, actor, body.reason, body.expected_version);
    return jsonFor(actor, { intake });
  } catch (err) {
    return handleApiError(err, req);
  }
}
