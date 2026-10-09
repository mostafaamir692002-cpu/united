import { reverseDocument } from "@/lib/inventory/documents";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("stock.adjust", (body, actor, params) => reverseDocument(params.id, body, actor).then((document) => ({ document })));
