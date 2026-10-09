-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "link" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_recipientId_dedupeKey_key" ON "Notification"("recipientId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "Notification" ADD CONSTRAINT "Notification_severity_known" CHECK ("severity" IN ('info', 'warning', 'critical'));
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_title_not_blank" CHECK (length(btrim("title")) > 0);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_type_format" CHECK ("type" ~ '^[a-z]+(\.[a-z_]+)+$');
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
