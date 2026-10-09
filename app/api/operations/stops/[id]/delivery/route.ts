import { recordDelivery } from "@/lib/operations/trips";
import { postHandler } from "@/lib/route-handlers";

/** The delivery result of one stop. Idempotent: the same result again is answered, not repeated. */
export const POST = postHandler("orders.dispatch", async (body, actor, params) => recordDelivery(params.id, body, actor), (r) => ((r as { replayed: boolean }).replayed ? 200 : 201));
