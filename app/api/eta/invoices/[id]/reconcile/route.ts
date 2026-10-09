import { postHandler } from "@/lib/route-handlers";
import { reconcileInvoiceEta } from "@/lib/eta/service";

/** Resolves an "unknown" submission from what the accountant found on the ETA portal. */
export const POST = postHandler("accounting.eta.manage", async (body, actor, params) => ({ eta: await reconcileInvoiceEta(params.id, body, actor) }), () => 200);
