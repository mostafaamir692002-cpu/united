import { saveVehicle } from "@/lib/operations/trips";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("operations.trips.manage", async (body, actor) => ({ vehicle: await saveVehicle(null, body, actor) }));
