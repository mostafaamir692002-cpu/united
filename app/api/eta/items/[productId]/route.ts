import { postHandler } from "@/lib/route-handlers";
import { setItemCode } from "@/lib/eta/service";

export const PUT = postHandler("accounting.eta.manage", async (body, actor, params) => ({ item: await setItemCode(params.productId, body, actor) }), () => 200);
