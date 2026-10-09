import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { requireServiceActor } from "@/lib/core/actor";
import {
  createBranch,
  createCompany,
  createCurrency,
  createLocation,
  createUom,
  createWarehouse,
} from "@/lib/core/org-service";

const CREATE = {
  companies: createCompany,
  branches: createBranch,
  warehouses: createWarehouse,
  locations: createLocation,
  uoms: createUom,
  currencies: createCurrency,
} as const;

/** POST /api/admin/master/{companies|branches|warehouses|locations|uoms|currencies} */
export async function POST(req: NextRequest, { params }: { params: { entity: string } }) {
  try {
    const actor = await requireServiceActor(req, "core.masterdata.manage");
    const create = CREATE[params.entity as keyof typeof CREATE];
    if (!Object.prototype.hasOwnProperty.call(CREATE, params.entity) || !create) {
      throw new ApiError(404, "نوع البيانات ده مش معروف");
    }
    const row = await create(await readJson(req), actor);
    return NextResponse.json({ row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
