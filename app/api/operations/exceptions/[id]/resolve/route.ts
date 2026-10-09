import { resolveException } from "@/lib/operations/exceptions";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("orders.approve", async (body, actor, params) => ({ exception: await resolveException(params.id, body, actor) }), () => 200);
