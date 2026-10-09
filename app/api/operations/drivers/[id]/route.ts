import { saveDriver } from "@/lib/operations/trips";
import { postHandler } from "@/lib/route-handlers";

export const PATCH = postHandler("operations.trips.manage", async (body, actor, params) => ({ driver: await saveDriver(params.id, body, actor) }), () => 200);
