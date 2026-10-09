import { postHandler } from "@/lib/route-handlers";
import { refreshInvoiceEta } from "@/lib/eta/service";

export const POST = postHandler("accounting.eta.manage", async (_body, actor, params) => ({ eta: await refreshInvoiceEta(params.id, actor) }), () => 200);
