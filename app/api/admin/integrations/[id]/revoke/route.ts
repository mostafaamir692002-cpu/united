import { revokeIntegration } from "@/lib/integrations/service";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("integrations.manage", async (_body, actor, params) => ({ integration: await revokeIntegration(params.id, actor) }), () => 200);
