import { createCreditNote } from "@/lib/sales/invoicing";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("sales.invoices.manage", (body, actor, params) => createCreditNote(params.id, body, actor).then((creditNote) => ({ creditNote })));
