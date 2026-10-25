import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAuth } from "@/lib/authz";
import { myNotifications } from "@/lib/core/notifications";

/** The caller's own notifications, newest first, plus the unread count. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const sp = new URL(req.url).searchParams;
    return NextResponse.json(
      await myNotifications(ctx.id, { unreadOnly: sp.get("unread") === "1", limit: Number(sp.get("limit")) || undefined })
    );
  } catch (err) {
    return handleApiError(err, req);
  }
}
