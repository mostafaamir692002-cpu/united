import { postStockValuation } from "@/lib/accounting/ledger";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("accounting.manage", async (body, actor, params) => ({ result: await postStockValuation(actor) }), () => 200);
