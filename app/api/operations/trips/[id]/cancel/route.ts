import { cancelTrip, getTrip } from "@/lib/operations/trips";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("operations.trips.manage", async (body, actor, params) => {
  await cancelTrip(params.id, body, actor);
  return { trip: await getTrip(params.id) };
}, () => 200);
