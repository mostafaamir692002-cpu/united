import { allocatePayment } from "@/lib/accounting/cash";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("accounting.payments.manage", async (body, actor, params) => ({ payment: await allocatePayment(params.id, body, actor) }), () => 200);
