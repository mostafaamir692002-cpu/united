import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireServiceActor } from "@/lib/core/actor";
import { etaInvoiceState } from "@/lib/eta/service";

/** One invoice: readiness issues, the ETA document it maps to, and its ETA state and history. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireServiceActor(req, "accounting.eta.view");
    return NextResponse.json(await etaInvoiceState(params.id, actor));
  } catch (err) {
    return handleApiError(err, req);
  }
}
