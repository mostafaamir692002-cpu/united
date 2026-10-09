import { completeReconciliation } from "@/lib/accounting/cash";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("accounting.manage", async (body, actor, params) => ({ reconciliation: await completeReconciliation(params.id, actor) }), () => 200);
