import { recordSupplierQuote } from "@/lib/purchasing/rfq";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("purchasing.rfq.manage", (body, actor, params) => recordSupplierQuote(params.id, body, actor), () => 200);
