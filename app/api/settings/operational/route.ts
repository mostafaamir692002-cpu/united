import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAuth } from "@/lib/authz";
import { getOperationalSettings } from "@/lib/core/settings-service";

/** The operational thresholds every board classifies against. Any signed-in user may
 * read them — a preparer's card has to agree with the supervisor's on "stalled". */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    return NextResponse.json({ settings: await getOperationalSettings() });
  } catch (err) {
    return handleApiError(err, req);
  }
}
