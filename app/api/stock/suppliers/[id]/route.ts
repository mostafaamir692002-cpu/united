import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { updateSupplier } from "@/lib/stock-service";
import { readJson } from "@/lib/http";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireStockActor(req, "stock.manage_suppliers");
    const body = await readJson(req);
    const supplier = await updateSupplier(
      params.id,
      { name: body.name, phone: body.phone, notes: body.notes, active: body.active },
      actor,
      body.expected_version
    );
    return jsonFor(actor, { supplier });
  } catch (err) {
    return handleApiError(err);
  }
}
