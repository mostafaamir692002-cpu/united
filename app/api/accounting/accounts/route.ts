import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { chartOfAccounts } from "@/lib/accounting/ledger";
import { createAccount } from "@/lib/accounting/ledger";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    return NextResponse.json({ accounts: await chartOfAccounts() });
  } catch (err) {
    return handleApiError(err, req);
  }
}
export const POST = postHandler("accounting.manage", async (body, actor) => ({ account: await createAccount(body, actor) }));
