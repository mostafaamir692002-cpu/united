import { markReconciled } from "@/lib/accounting/cash";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("accounting.manage", async (body, actor, params) => ({ result: await markReconciled(params.id, body, actor) }), () => 200);
