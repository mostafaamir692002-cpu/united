import { transitionQuotation } from "@/lib/sales/quotations";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("sales.quotations.manage", (body, actor, params) => transitionQuotation(params.id, body, actor).then((quotation) => ({ quotation })), () => 200);
