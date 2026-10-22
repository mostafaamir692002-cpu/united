-- Customer legal name on the card + repeatable tax registration numbers.
--
-- Business rule: several hotel/outlet cards may share one tax registration number
-- (one tax identity, many outlets). Uniqueness at the customer level is removed —
-- cards are never merged because of a repeated number. The legal name is stored on
-- the card itself (legalName/legalNameAr), so a hotel's billing identity stays
-- separate from its display name.

-- AlterTable Customer: legal billing name on the card.
ALTER TABLE "Customer" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "legalNameAr" TEXT;

-- Drop the unique index on the customer's tax registration number. Repeated numbers
-- across different hotel cards are now allowed. (CustomerLegalEntity keeps its own
-- unique tax number — one legal entity = one registration number.)
DROP INDEX "Customer_taxRegistrationNo_key";