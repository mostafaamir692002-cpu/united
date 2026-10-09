import { createEmployeeTransaction } from "@/lib/hr/service";
import { postHandler } from "@/lib/route-handlers";

/** An advance paid, a reimbursement paid, or an advance returned. */
export const POST = postHandler("hr.advances.manage", async (body, actor) => ({ transaction: await createEmployeeTransaction(body, actor) }));
