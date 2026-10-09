import { assignException } from "@/lib/operations/exceptions";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("orders.approve", async (body, actor, params) => ({ exception: await assignException(params.id, body, actor) }), () => 200);
