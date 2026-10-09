import { saveVehicle } from "@/lib/operations/trips";
import { postHandler } from "@/lib/route-handlers";

export const PATCH = postHandler("operations.trips.manage", async (body, actor, params) => ({ vehicle: await saveVehicle(params.id, body, actor) }), () => 200);
