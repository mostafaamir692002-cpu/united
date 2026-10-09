import { voidDraftInvoice } from "@/lib/sales/invoicing";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("sales.invoices.manage", (body, actor, params) => voidDraftInvoice(params.id, body, actor).then((invoice) => ({ invoice })), () => 200);
