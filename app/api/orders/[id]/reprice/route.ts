import { repriceOrder } from "@/lib/sales/pricing";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("sales.price_override", (_body, actor, params) => repriceOrder(params.id, actor), () => 200);
