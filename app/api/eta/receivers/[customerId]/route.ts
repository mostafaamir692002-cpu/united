import { postHandler } from "@/lib/route-handlers";
import { saveReceiverProfile } from "@/lib/eta/service";

export const PUT = postHandler("accounting.eta.manage", async (body, actor, params) => ({ receiver: await saveReceiverProfile(params.customerId, body, actor) }), () => 200);
