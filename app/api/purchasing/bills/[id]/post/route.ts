import { postBill, getBill } from "@/lib/purchasing/bills";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("purchasing.bills.manage", async (body, actor, params) => {
  await postBill(params.id, actor);
  return { bill: await getBill(params.id) };
}, () => 200);
