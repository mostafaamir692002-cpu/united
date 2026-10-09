-- Session invalidation (ERP Phase 1, security).
--
-- Every session token now carries the user's sessionEpoch and is refused once it no
-- longer matches. A password change increments it, ending all older sessions —
-- including a stolen one — instead of leaving them valid for up to 12 hours.
--
-- Existing users start at 1, and tokens issued before this release read as epoch 1,
-- so deploying this signs nobody out.
ALTER TABLE "User" ADD COLUMN "sessionEpoch" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD CONSTRAINT "User_sessionEpoch_positive" CHECK ("sessionEpoch" >= 1);
