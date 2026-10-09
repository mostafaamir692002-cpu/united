-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginAttempt_username_createdAt_idx" ON "LoginAttempt"("username", "createdAt");


CREATE TRIGGER "LoginAttempt_append_only" BEFORE UPDATE OR DELETE ON "LoginAttempt" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
ALTER TABLE "LoginAttempt" ENABLE ROW LEVEL SECURITY;
