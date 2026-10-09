import { createDebitNote, getBill } from "@/lib/purchasing/bills";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("purchasing.bills.manage", async (body, actor, params) => {
  const debitNote = await createDebitNote(params.id, body, actor);
  return { debitNote, bill: await getBill(params.id) };
});
