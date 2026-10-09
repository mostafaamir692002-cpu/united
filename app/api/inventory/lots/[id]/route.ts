import { updateLotExpiry } from "@/lib/inventory/products";
import { postHandler } from "@/lib/route-handlers";

export const PATCH = postHandler("stock.sort", (body, actor, params) => updateLotExpiry(params.id, body, actor).then((lot) => ({ lot })), () => 200);
