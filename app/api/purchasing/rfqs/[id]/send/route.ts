import { sendRfq } from "@/lib/purchasing/rfq";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("purchasing.rfq.manage", (_body, actor, params) => sendRfq(params.id, actor).then((rfq) => ({ rfq })), () => 200);
