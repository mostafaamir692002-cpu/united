import { awardRfq } from "@/lib/purchasing/rfq";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("purchasing.rfq.manage", (body, actor, params) => awardRfq(params.id, body, actor));
