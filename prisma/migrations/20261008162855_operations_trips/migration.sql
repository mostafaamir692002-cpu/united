-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "assignedToName" TEXT;

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'truck',
    "capacityKg" DECIMAL(12,2),
    "refrigerated" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "tripDate" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "notes" TEXT,
    "cancelReason" TEXT,
    "loadingStartedAt" TIMESTAMP(3),
    "loadedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "departedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripStop" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "crateCount" INTEGER,
    "receiverName" TEXT,
    "customerNotes" TEXT,
    "failureReason" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "recordedById" TEXT,
    "recordedBy" TEXT,
    "returnDocumentId" TEXT,

    CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryLine" (
    "id" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "shippedQty" DECIMAL(18,3) NOT NULL,
    "deliveredQty" DECIMAL(18,3) NOT NULL,
    "shortageQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "damagedQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "rejectedQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "reason" TEXT,

    CONSTRAINT "DeliveryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalException" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "orderId" TEXT,
    "tripId" TEXT,
    "orderItemId" TEXT,
    "productName" TEXT,
    "quantity" DECIMAL(18,3),
    "description" TEXT NOT NULL,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_code_key" ON "Vehicle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_number_key" ON "Trip"("number");

-- CreateIndex
CREATE INDEX "Trip_status_tripDate_idx" ON "Trip"("status", "tripDate");

-- CreateIndex
CREATE INDEX "TripStop_tripId_idx" ON "TripStop"("tripId");

-- CreateIndex
CREATE INDEX "TripStop_orderId_idx" ON "TripStop"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryLine_stopId_orderItemId_key" ON "DeliveryLine"("stopId", "orderItemId");

-- CreateIndex
CREATE INDEX "OperationalException_status_type_idx" ON "OperationalException"("status", "type");

-- CreateIndex
CREATE INDEX "OperationalException_orderId_idx" ON "OperationalException"("orderId");

-- CreateIndex
CREATE INDEX "OperationalException_tripId_idx" ON "OperationalException"("tripId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLine" ADD CONSTRAINT "DeliveryLine_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "TripStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLine" ADD CONSTRAINT "DeliveryLine_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity (hand-written)
-- ---------------------------------------------------------------------------
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_values" CHECK (length(btrim("code")) > 0 AND length(btrim("plate")) > 0 AND "type" IN ('van', 'truck', 'pickup', 'other') AND ("capacityKg" IS NULL OR "capacityKg" > 0));
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_name_not_blank" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_status_known" CHECK ("status" IN ('planned', 'loading', 'loaded', 'dispatched', 'in_transit', 'completed', 'cancelled'));
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_number_shape" CHECK ("number" ~ '^TRP-[0-9]{4}-[0-9]{5,}$');
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_date_shape" CHECK ("tripDate" ~ '^\d{4}-\d{2}-\d{2}$');
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_cancel_has_reason" CHECK ("status" <> 'cancelled' OR length(btrim(coalesce("cancelReason", ''))) > 0);
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_status_known" CHECK ("status" IN ('pending', 'delivered', 'partial', 'failed'));
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_result_complete" CHECK ("status" = 'pending' OR ("deliveredAt" IS NOT NULL AND "recordedBy" IS NOT NULL));
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_failure_has_reason" CHECK ("status" <> 'failed' OR length(btrim(coalesce("failureReason", ''))) > 0);
-- An order is on at most one live trip: it cannot be loaded twice.
CREATE UNIQUE INDEX "TripStop_one_live_trip_per_order" ON "TripStop"("orderId") WHERE "active";
CREATE UNIQUE INDEX "TripStop_sequence_per_trip" ON "TripStop"("tripId", "sequence") WHERE "active";
ALTER TABLE "DeliveryLine" ADD CONSTRAINT "DeliveryLine_balances" CHECK (
  "shippedQty" >= 0 AND "deliveredQty" >= 0 AND "shortageQty" >= 0 AND "damagedQty" >= 0 AND "rejectedQty" >= 0
  AND "shippedQty" = "deliveredQty" + "shortageQty" + "damagedQty" + "rejectedQty"
);
ALTER TABLE "OperationalException" ADD CONSTRAINT "OperationalException_known" CHECK (
  "type" IN ('shortage', 'damage', 'rejection', 'delivery_failure', 'loading_discrepancy')
  AND "status" IN ('open', 'resolved') AND "sourceType" IN ('order', 'trip_stop', 'trip')
  AND length(btrim("description")) > 0
);
ALTER TABLE "OperationalException" ADD CONSTRAINT "OperationalException_resolved_complete" CHECK (
  "status" = 'open' OR ("resolvedAt" IS NOT NULL AND length(btrim(coalesce("resolution", ''))) > 0)
);

-- A recorded delivery result is final: its lines are append-only.
CREATE TRIGGER "DeliveryLine_append_only" BEFORE UPDATE OR DELETE ON "DeliveryLine"
FOR EACH ROW EXECUTE FUNCTION sales_append_only();

ALTER TABLE "Vehicle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Driver" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripStop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperationalException" ENABLE ROW LEVEL SECURITY;

-- Permission groups for operations and the phases after it (accounting, HR, integrations).
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_group_known";
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_group_known"
  CHECK ("group" IN ('orders', 'stock', 'reports', 'audit', 'users', 'settings', 'core', 'sales', 'purchasing', 'operations', 'accounting', 'hr', 'integrations'));
