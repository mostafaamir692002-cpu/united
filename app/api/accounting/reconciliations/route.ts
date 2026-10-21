import { startReconciliation } from "@/lib/accounting/cash";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("accounting.manage", async (body, actor) => ({ reconciliation: await startReconciliation(body, actor) }));
