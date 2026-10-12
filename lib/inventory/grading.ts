import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { advisoryXactLock } from "@/lib/dbLock";
import { inTx } from "@/lib/tx";
import type { StockActor } from "@/lib/stock-auth";
import { todayLocalISO } from "@/lib/localDate";
import { nextDocumentNumber } from "@/lib/core/sequences";
import { D } from "@/lib/inventory/decimal";
import { postMovements, type MoveInput } from "@/lib/inventory/ledger";

/**
 * Grading: a deferred operation on a raw receipt.
 *
 * When produce is received, it may not be graded immediately. The receipt enters
 * stock at the raw (receiving) location. Later, a grading operation assigns
 * quantities to:
 *   - Grade A / Good — saleable quality stock → destination good location
 *   - Grade B / فرزة — second-grade saleable → destination grade B location
 *   - Waste / هالك — unsaleable → destination waste location
 *
 * Grading uses "adjustment" movements (positive entries at the new locations)
 * within the same warehouse, linked to the intake's lot.
 */

const KG_DP = 3;
function roundKg(n: number) {
  return Math.round(n * 10 ** KG_DP) / 10 ** KG_DP;
}

/** Default grading locations. These MUST exist in the database. */
const DEFAULT_GOOD_LOCATION = "loc_cold_1";
const DEFAULT_GRADE_B_LOCATION = "loc_grade_b";
const DEFAULT_WASTE_LOCATION = "loc_waste";

export type GradeInput = {
  intake_id: string;
  good_kg: number;
  grade_b_kg?: number;
  waste_kg?: number;
  good_location_id?: string;
  grade_b_location_id?: string;
  waste_location_id?: string;
  notes?: string;
};

export type GradeResult = {
  document: {
    id: string;
    number: string;
    type: string;
    status: string;
  };
  goodKg: number;
  gradeBKg: number;
  wasteKg: number;
  remainingKg: number;
};

/**
 * Grade a previously received intake: assign quantities from the raw received
 * stock to good, grade B, and waste categories.
 *
 * The intake must be in "posted" status. The total graded quantity must
 * not exceed the intake's goodQty (what survived sorting at the gate).
 * This operation can be called once per intake. For partial grading of
 * the remainder, call again.
 */
export async function gradeIntake(input: GradeInput, actor: StockActor): Promise<GradeResult> {
  const goodKg = roundKg(Math.max(0, input.good_kg));
  const gradeBKg = roundKg(Math.max(0, input.grade_b_kg ?? 0));
  const wasteKg = roundKg(Math.max(0, input.waste_kg ?? 0));
  const totalGraded = goodKg + gradeBKg + wasteKg;

  if (totalGraded <= 0) {
    throw new ApiError(400, "لازم تحدد كمية واحدة على الأقل (جيد، فرزة، أو هالك)");
  }

  return inTx(async (tx) => {
    // Lock the intake row to serialise concurrent grading operations
    await advisoryXactLock(tx, `stock:grade:${input.intake_id}`);

    const intake = await tx.stockIntake.findUnique({
      where: { id: input.intake_id },
      include: { product: true, warehouse: true, lot: true },
    });

    if (!intake) throw new ApiError(404, "الاستلام مش موجود");
    if (intake.status !== "posted") throw new ApiError(409, "الاستلام ملغي أو مش منشور");
    if (!intake.lotId) throw new ApiError(409, "الاستلام مالوش لوت — مينفعش يتفرز");

    const maxGradable = Number(intake.goodQty);
    if (totalGraded > maxGradable) {
      throw new ApiError(
        400,
        `الكمية الإجمالية للفرز (${totalGraded}) أكبر من المتاح (${maxGradable} ${intake.product.unit})`
      );
    }

    const today = todayLocalISO();
    const goodLocationId = input.good_location_id ?? DEFAULT_GOOD_LOCATION;
    const gradeBLocationId = input.grade_b_location_id ?? DEFAULT_GRADE_B_LOCATION;
    const wasteLocationId = input.waste_location_id ?? DEFAULT_WASTE_LOCATION;

    // Build movements: "adjustment" type for each grade destination.
    // These are positive (add to stock at the graded location).
    // The raw location still holds the original intake — grading
    // creates the classification but doesn't remove from the raw bucket
    // (the raw bucket balance includes everything received).
    const movements: MoveInput[] = [];

    if (goodKg > 0) {
      movements.push({
        productId: intake.productId,
        warehouseId: intake.warehouseId,
        locationId: goodLocationId,
        lotId: intake.lotId!,
        quantity: D(goodKg),
        kind: "adjustment",
        // intakeId is intentionally null: DB constraint StockMovement_source_matches_kind
        // requires intakeId IS NULL for kind='adjustment'. Traceability to the source
        // intake is preserved via the grading document's sourceId/sourceType fields.
        intakeId: null,
        reason: `فرز: ${goodKg} كجم جيد من استلام ${intake.receiptNumber}`,
        unitCost: intake.unitCost ?? undefined,
        costSource: "purchase",
      });
    }

    if (gradeBKg > 0) {
      movements.push({
        productId: intake.productId,
        warehouseId: intake.warehouseId,
        locationId: gradeBLocationId,
        lotId: intake.lotId!,
        quantity: D(gradeBKg),
        kind: "adjustment",
        intakeId: null,
        reason: `فرز: ${gradeBKg} كجم فرزة من استلام ${intake.receiptNumber}`,
        unitCost: intake.unitCost ?? undefined,
        costSource: "purchase",
      });
    }

    if (wasteKg > 0) {
      movements.push({
        productId: intake.productId,
        warehouseId: intake.warehouseId,
        locationId: wasteLocationId,
        lotId: intake.lotId!,
        quantity: D(wasteKg),
        kind: "adjustment",
        intakeId: null,
        reason: `فرز: ${wasteKg} كجم هالك من استلام ${intake.receiptNumber}`,
        unitCost: intake.unitCost ?? undefined,
        costSource: "purchase",
      });
    }

    // Create the grading document
    const doc = await tx.inventoryDocument.create({
      data: {
        number: await nextDocumentNumber(tx, "inventory.grading", today),
        type: "grading",
        status: "posted",
        warehouseId: intake.warehouseId,
        businessDate: today,
        reason: input.notes ?? `فرز استلام ${intake.receiptNumber}`,
        sourceType: "intake_grading",
        sourceId: intake.id,
        createdById: actor.id,
        createdBy: actor.name,
        postedAt: new Date(),
      },
    });

    // Post the movements
    if (movements.length > 0) {
      await postMovements(tx, movements, {
        actorId: actor.id,
        actorName: actor.name,
        effectiveDate: today,
      });
    }

    // Update the intake record with the graded quantities
    await tx.stockIntake.update({
      where: { id: intake.id },
      data: {
        goodQty: D(goodKg),
        gradeBQty: D(gradeBKg),
        wasteQty: D(wasteKg),
        version: { increment: 1 },
      },
    });

    await writeAudit(
      {
        userId: actor.id,
        userName: actor.name,
        role: actor.role,
        action: "stock_grading_created",
        entityType: "inventory_document",
        entityId: doc.id,
        newValue: `فرز استلام ${intake.receiptNumber}: جيد ${goodKg}, فرزة ${gradeBKg}, هالك ${wasteKg}, متبقي ${maxGradable - totalGraded}`,
        source: "user",
        deviceId: actor.deviceId,
      },
      tx
    );

    return {
      document: { id: doc.id, number: doc.number, type: doc.type, status: doc.status },
      goodKg,
      gradeBKg,
      wasteKg,
      remainingKg: maxGradable - totalGraded,
    };
  });
}