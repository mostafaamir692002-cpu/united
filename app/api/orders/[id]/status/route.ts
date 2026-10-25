import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireOrderActor } from "@/lib/api-auth";
import { moveOrderStatus } from "@/lib/orders-service";
import type { OrderStatus } from "@/lib/types";
import { readJson } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireOrderActor(req, "orders.view");
    const body = await readJson(req);
    const order = await moveOrderStatus(params.id, body.to as OrderStatus, actor, {
      reason: body.reason,
      expectedVersion: body.expected_version,
      vehicle: body.vehicle,
      driverName: body.driver_name,
      crateCount: body.crate_count,
    });
    return NextResponse.json({ order });
  } catch (err) {
    return handleApiError(err, req);
  }
}
