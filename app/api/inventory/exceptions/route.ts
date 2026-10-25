import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { listIssueExceptions } from "@/lib/inventory/dispatch";

export async function GET(req: NextRequest) {
  try {
    const viewer = await requirePermission(req, "stock.view");
    const sp = new URL(req.url).searchParams;
    return jsonFor(viewer, {
      exceptions: await listIssueExceptions({ status: sp.get("status") ?? undefined, orderId: sp.get("order_id") ?? undefined }),
    });
  } catch (err) {
    return handleApiError(err, req);
  }
}
