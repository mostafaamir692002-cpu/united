-- Allow voided draft invoices to be recovered back to draft status.
-- The existing trigger blocked ALL updates to void invoices, which made it
-- impossible to undo an accidentally voided draft. A void → draft recovery
-- is now allowed as the sole exception to the frozen trigger, provided the
-- application also checks version, permission, reason, and the absence of
-- posted journal entries before attempting the recovery.
--
-- The line-level trigger is unchanged: a recovered draft does not touch
-- invoice lines, so the line trigger remains frozen for issued/void invoices.
CREATE OR REPLACE FUNCTION sales_invoice_frozen() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'SalesInvoice rows are never deleted (void a draft instead)' USING ERRCODE = 'restrict_violation';
  END IF;
  -- Allow void → draft transitions (invoice draft recovery).
  -- The application enforces all other guards before attempting this.
  IF OLD."status" = 'void' AND NEW."status" = 'draft' THEN
    RETURN NEW;
  END IF;
  IF OLD."status" IN ('issued', 'void') THEN
    RAISE EXCEPTION 'SalesInvoice % is % and cannot change — issue a credit note', coalesce(OLD."number", OLD."id"), OLD."status" USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;