import { postHandler } from "@/lib/route-handlers";
import { setUnitType } from "@/lib/eta/service";

export const PUT = postHandler("accounting.eta.manage", async (body, actor, params) => ({ unit: await setUnitType(params.code, body, actor) }), () => 200);
