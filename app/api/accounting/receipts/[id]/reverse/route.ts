import { reverseReceipt } from "@/lib/accounting/cash";
import { postHandler } from "@/lib/route-handlers";

/** Takes a receipt back (bounced cheque, wrong customer) by a reversal document. */
export const POST = postHandler("accounting.manage", async (body, actor, params) => ({ reversal: await reverseReceipt(params.id, body, actor) }));
