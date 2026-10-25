import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { requireServiceActor } from "@/lib/core/actor";
import {
  updateBranch,
  updateCompany,
  updateCurrency,
  updateLocation,
  updateUom,
  updateWarehouse,
} from "@/lib/core/org-service";

const UPDATE = {
  companies: updateCompany,
  branches: updateBranch,
  warehouses: updateWarehouse,
  locations: updateLocation,
  uoms: updateUom,
  currencies: updateCurrency,
} as const;

/** PATCH /api/admin/master/{entity}/{id} — body carries changed fields + expected_version.
 * Currencies are addressed by their ISO code. */
export async function PATCH(req: NextRequest, { params }: { params: { entity: string; id: string } }) {
  try {
    const actor = await requireServiceActor(req, "core.masterdata.manage");
    const update = UPDATE[params.entity as keyof typeof UPDATE];
    if (!Object.prototype.hasOwnProperty.call(UPDATE, params.entity) || !update) {
      throw new ApiError(404, "نوع البيانات ده مش معروف");
    }
    const row = await update(params.id, await readJson(req), actor);
    return NextResponse.json({ row });
  } catch (err) {
    return handleApiError(err, req);
  }
}
