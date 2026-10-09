import { confirmLoaded, getTrip } from "@/lib/operations/trips";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("orders.load", async (body, actor, params) => {
  await confirmLoaded(params.id, actor);
  return { trip: await getTrip(params.id) };
}, () => 200);
