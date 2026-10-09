import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { readJson } from "@/lib/http";
import { serviceActorFromContext } from "@/lib/core/actor";
import { getPurchaseOrder, updatePurchaseOrder } from "@/lib/purchasing/orders";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requirePermission(req, "purchasing.orders.view");
    return NextResponse.json({ order: await getPurchaseOrder(params.id, ctx) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requirePermission(req, "purchasing.orders.manage");
    const actor = serviceActorFromContext(ctx);
    await updatePurchaseOrder(params.id, await readJson(req), actor);
    return NextResponse.json({ order: await getPurchaseOrder(params.id, ctx) });
  } catch (err) {
    return handleApiError(err);
  }
}
