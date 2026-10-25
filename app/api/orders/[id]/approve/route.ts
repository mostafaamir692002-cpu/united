import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireOrderActor } from "@/lib/api-auth";
import { approveShortage } from "@/lib/orders-service";
import { readJson } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireOrderActor(req, "orders.approve");
    const body = await readJson(req);
    const order = await approveShortage(params.id, actor, body.reason, body.expected_version);
    return NextResponse.json({ order });
  } catch (err) {
    return handleApiError(err, req);
  }
}
