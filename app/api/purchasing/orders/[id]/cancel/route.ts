import { getPurchaseOrder, cancelPurchaseOrder } from "@/lib/purchasing/orders";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("purchasing.orders.manage", async (body, actor, params) => {
  await cancelPurchaseOrder(params.id, body, actor);
  return { order: await getPurchaseOrder(params.id, actor) };
}, () => 200);
