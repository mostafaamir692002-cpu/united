import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAnyPermission } from "@/lib/authz";
import { createRfq, listRfqs } from "@/lib/purchasing/rfq";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requireAnyPermission(req, ["purchasing.rfq.manage", "purchasing.prices.view"]);
    return NextResponse.json({ rfqs: await listRfqs({ status: new URL(req.url).searchParams.get("status") ?? undefined }) });
  } catch (err) {
    return handleApiError(err, req);
  }
}

export const POST = postHandler("purchasing.rfq.manage", (body, actor) => createRfq(body, actor).then((rfq) => ({ rfq })));
