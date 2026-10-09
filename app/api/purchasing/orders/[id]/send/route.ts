import { getPurchaseOrder, sendPurchaseOrder } from "@/lib/purchasing/orders";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("purchasing.orders.manage", async (body, actor, params) => {
  await sendPurchaseOrder(params.id, actor);
  return { order: await getPurchaseOrder(params.id, actor) };
}, () => 200);
