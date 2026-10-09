import { departTrip, getTrip } from "@/lib/operations/trips";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("orders.dispatch", async (body, actor, params) => {
  await departTrip(params.id, actor);
  return { trip: await getTrip(params.id) };
}, () => 200);
