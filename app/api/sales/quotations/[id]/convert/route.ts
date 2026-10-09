import { convertQuotation } from "@/lib/sales/quotations";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("sales.quotations.manage", (body, actor, params) => convertQuotation(params.id, body, actor).then((order) => ({ order })));
