import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireServiceActor } from "@/lib/core/actor";
import { etaOverview } from "@/lib/eta/service";

/** E-invoicing overview: server configuration (variable names only), setup gaps, invoice states. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireServiceActor(req, "accounting.eta.view");
    return NextResponse.json({ eta: await etaOverview(actor) });
  } catch (err) {
    return handleApiError(err, req);
  }
}
