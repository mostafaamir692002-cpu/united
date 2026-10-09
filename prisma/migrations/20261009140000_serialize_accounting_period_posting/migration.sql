-- A period close and journal posting for the same month must not pass each other.
-- Use the same transaction advisory key as lib/accounting/ledger.ts, including for
-- direct SQL writers that rely only on this database trigger.
CREATE OR REPLACE FUNCTION accounting_period_open() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('accounting-period:' || substring(NEW."date" from 1 for 7)));

  -- Wait for any period update (close) to commit before deciding whether this date
  -- is open. Lock all matching ranges in stable order in case legacy periods overlap.
  PERFORM 1
  FROM "AccountingPeriod"
  WHERE NEW."date" BETWEEN "startDate" AND "endDate"
  ORDER BY "code"
  FOR UPDATE;

  IF EXISTS (SELECT 1 FROM "AccountingPeriod" WHERE "status" = 'closed' AND NEW."date" BETWEEN "startDate" AND "endDate") THEN
    RAISE EXCEPTION 'the accounting period of % is closed', NEW."date" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
