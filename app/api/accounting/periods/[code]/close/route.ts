import { closePeriod } from "@/lib/accounting/ledger";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("accounting.periods.close", async (body, actor, params) => ({ period: await closePeriod(params.code, actor) }), () => 200);
