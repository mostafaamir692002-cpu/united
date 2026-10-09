-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "amount" DECIMAL(18,3),
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requiredLevels" INTEGER NOT NULL DEFAULT 1,
    "approvedLevels" INTEGER NOT NULL DEFAULT 0,
    "requestedById" TEXT,
    "requestedBy" TEXT NOT NULL,
    "requestReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "deciderId" TEXT,
    "decider" TEXT NOT NULL,
    "deciderRole" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_number_key" ON "ApprovalRequest"("number");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_type_idx" ON "ApprovalRequest"("status", "type");

-- CreateIndex
CREATE INDEX "ApprovalRequest_entityType_entityId_idx" ON "ApprovalRequest"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalDecision_requestId_level_key" ON "ApprovalDecision"("requestId", "level");

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- At most one PENDING request per (type, entity): the engine coalesces concurrent
-- requesters under an advisory lock; this makes the invariant hold for any writer.
CREATE UNIQUE INDEX "ApprovalRequest_one_pending_per_entity"
  ON "ApprovalRequest" ("type", "entityType", "entityId") WHERE "status" = 'pending';

ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_status_known"
  CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled'));
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_levels_valid"
  CHECK ("requiredLevels" >= 1 AND "approvedLevels" >= 0 AND "approvedLevels" <= "requiredLevels");
-- An approved request has every level approved; a closed one has a decision time.
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_approved_complete"
  CHECK ("status" <> 'approved' OR "approvedLevels" = "requiredLevels");
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_closed_has_time"
  CHECK ("status" = 'pending' OR "decidedAt" IS NOT NULL);
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_type_format" CHECK ("type" ~ '^[a-z]+(\.[a-z_]+)+$');
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_version_positive" CHECK ("version" >= 1);

ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_decision_known" CHECK ("decision" IN ('approve', 'reject'));
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_level_positive" CHECK ("level" >= 1);
-- One person decides a request at most once, whatever the level.
CREATE UNIQUE INDEX "ApprovalDecision_one_per_decider"
  ON "ApprovalDecision" ("requestId", "deciderId") WHERE "deciderId" IS NOT NULL;

ALTER TABLE "ApprovalRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalDecision" ENABLE ROW LEVEL SECURITY;
