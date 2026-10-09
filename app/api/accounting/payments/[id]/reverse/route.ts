import { reversePayment } from "@/lib/accounting/cash";
import { postHandler } from "@/lib/route-handlers";

/** Takes a supplier payment back (stopped cheque, returned transfer) by a reversal document. */
export const POST = postHandler("accounting.manage", async (body, actor, params) => ({ reversal: await reversePayment(params.id, body, actor) }));
