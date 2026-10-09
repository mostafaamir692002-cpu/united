-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "StockMovement_lotId_idx" ON "StockMovement"("lotId");

-- CreateIndex
CREATE INDEX "StockValuationLayer_createdAt_idx" ON "StockValuationLayer"("createdAt");

