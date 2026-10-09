import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAuth } from "@/lib/authz";
import { readJson } from "@/lib/http";
import { markRead } from "@/lib/core/notifications";

/** Body: { ids: string[] } or { all: true }. Only the caller's own rows are touched. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    return NextResponse.json({ marked: await markRead(ctx.id, await readJson(req)) });
  } catch (err) {
    return handleApiError(err);
  }
}
