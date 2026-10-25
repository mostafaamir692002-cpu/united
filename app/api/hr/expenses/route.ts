import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireServiceActor } from "@/lib/core/actor";
import { createExpense, listExpenses } from "@/lib/hr/service";
import { postHandler } from "@/lib/route-handlers";

/** Approvers and the books see every expense; a submitter sees their own. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireServiceActor(req, "hr.expenses.submit");
    return NextResponse.json({ expenses: await listExpenses(actor, { status: new URL(req.url).searchParams.get("status") ?? undefined }) });
  } catch (err) {
    return handleApiError(err, req);
  }
}

export const POST = postHandler("hr.expenses.submit", async (body, actor) => ({ expense: await createExpense(body, actor) }));
