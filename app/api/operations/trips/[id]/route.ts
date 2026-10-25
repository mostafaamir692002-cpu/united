import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { getTrip, updateTrip } from "@/lib/operations/trips";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "orders.view");
    return NextResponse.json({ trip: await getTrip(params.id) });
  } catch (err) {
    return handleApiError(err, req);
  }
}

export const PUT = postHandler("operations.trips.manage", async (body, actor, params) => {
  await updateTrip(params.id, body, actor);
  return { trip: await getTrip(params.id) };
}, () => 200);
