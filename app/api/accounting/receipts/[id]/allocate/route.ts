import { allocateReceipt } from "@/lib/accounting/cash";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("accounting.receipts.manage", async (body, actor, params) => ({ receipt: await allocateReceipt(params.id, body, actor) }), () => 200);
