import { resolveIssueException } from "@/lib/inventory/dispatch";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler(
  "stock.adjust",
  (body, actor, params) => resolveIssueException(params.id, body, actor).then((exception) => ({ exception })),
  () => 200
);
