import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { listJournals } from "@/lib/accounting/ledger";
import { createManualJournal, getJournal } from "@/lib/accounting/ledger";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json(await listJournals({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, sourceType: sp.get("source_type") ?? undefined, limit: Number(sp.get("limit")) || undefined, offset: Number(sp.get("offset")) || undefined }));
  } catch (err) {
    return handleApiError(err, req);
  }
}
export const POST = postHandler("accounting.manage", async (body, actor) => ({ journal: await getJournal((await createManualJournal(body, actor)).id) }));
