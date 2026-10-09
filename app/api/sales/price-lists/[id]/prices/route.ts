import { setPrices } from "@/lib/sales/pricing";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("sales.pricing.manage", (body, actor, params) => setPrices(params.id, body, actor), () => 200);
