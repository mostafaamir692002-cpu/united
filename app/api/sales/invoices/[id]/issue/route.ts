import { issueInvoice } from "@/lib/sales/invoicing";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("sales.invoices.manage", (body, actor, params) => issueInvoice(params.id, body, actor).then((invoice) => ({ invoice })), () => 200);
