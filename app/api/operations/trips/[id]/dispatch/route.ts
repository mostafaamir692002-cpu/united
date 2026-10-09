import { dispatchTrip, getTrip } from "@/lib/operations/trips";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("orders.dispatch", async (body, actor, params) => {
  await dispatchTrip(params.id, body, actor);
  return { trip: await getTrip(params.id) };
}, () => 200);
