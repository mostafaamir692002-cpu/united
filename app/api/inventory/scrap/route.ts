import { createScrap } from "@/lib/inventory/documents";
import { documentStatus, postHandler } from "@/lib/route-handlers";

export const POST = postHandler("stock.adjust", (body, actor) => createScrap(body, actor), documentStatus);
