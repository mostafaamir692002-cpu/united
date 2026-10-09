import { cancelRfq } from "@/lib/purchasing/rfq";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("purchasing.rfq.manage", (body, actor, params) => cancelRfq(params.id, body, actor).then((rfq) => ({ rfq })), () => 200);
