import { createAdjustment } from "@/lib/inventory/documents";
import { documentStatus, postHandler } from "@/lib/route-handlers";

/** Lines carry a signed `quantity` (delta) or a `counted_quantity` for one bucket (a count). */
export const POST = postHandler("stock.adjust", (body, actor) => createAdjustment(body, actor), documentStatus);
