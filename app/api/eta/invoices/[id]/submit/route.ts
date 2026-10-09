import { postHandler } from "@/lib/route-handlers";
import { submitInvoiceToEta } from "@/lib/eta/service";

/** Sends the invoice to ETA once. A repeat returns the existing state (200), never a second submission. */
export const POST = postHandler("accounting.eta.manage", async (_body, actor, params) => submitInvoiceToEta(params.id, actor), (r) => ((r as { submitted?: boolean }).submitted ? 201 : 200));
