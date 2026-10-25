import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { createOpeningBalance, listOpeningBalances } from "@/lib/accounting/integrity";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    return NextResponse.json({ openingBalances: await listOpeningBalances() });
  } catch (err) {
    return handleApiError(err, req);
  }
}

/** A customer's or supplier's balance brought over at go-live (statement, aging and GL together). */
export const POST = postHandler("accounting.manage", async (body, actor) => ({ openingBalance: await createOpeningBalance(body, actor) }));
