import { postHandler } from "@/lib/route-handlers";
import { saveIssuerProfile } from "@/lib/eta/service";

/** The issuer's ETA details that Company does not hold (branch id, activity code, structured address). */
export const PUT = postHandler("accounting.eta.manage", async (body, actor) => ({ issuer: await saveIssuerProfile(body, actor) }), () => 200);
