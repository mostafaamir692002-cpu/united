import { saveDriver } from "@/lib/operations/trips";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("operations.trips.manage", async (body, actor) => ({ driver: await saveDriver(null, body, actor) }));
