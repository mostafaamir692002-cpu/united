import { NextRequest } from "next/server";
import { loggedIntegrationCall, orderStatusByExternalId, requireScope } from "@/lib/integrations/service";

/** For a channel (x-api-key, scope orders.status): where is the order it submitted? */
export async function GET(req: NextRequest, { params }: { params: { externalId: string } }) {
  return loggedIntegrationCall(req, async (caller) => {
    requireScope(caller, "orders.status");
    const status = await orderStatusByExternalId(params.externalId);
    return { body: { order: status }, externalId: params.externalId, result: status.status };
  });
}
