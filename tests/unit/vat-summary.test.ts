import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeVatRows } from "@/lib/accounting/vat-summary";

test("VAT summary nets credits/debits and compares exact document totals to the GL", () => {
  const report = summarizeVatRows([
    { taxCode: "VAT14", rate: "14", outputBase: "100.00", outputTax: "14.00", inputBase: "50.00", inputTax: "7.00" },
    { taxCode: "VAT14", rate: "14", outputBase: "-20.00", outputTax: "-2.80", inputBase: "-10.00", inputTax: "-1.40" },
    { taxCode: "EXEMPT", rate: "0", outputBase: "30.00", outputTax: "0.00", inputBase: "0.00", inputTax: "0.00" },
  ], { outputDebit: "0", outputCredit: "11.20", inputDebit: "5.60", inputCredit: "0" });
  assert.equal(report.totals.netPayable, "5.60");
  assert.equal(report.totals.outputBase, "110.00");
  assert.equal(report.ledger.reconciled, true);
  assert.equal(report.lines.length, 2);
});

test("VAT summary exposes an out-of-balance tax account rather than hiding it", () => {
  const report = summarizeVatRows([
    { taxCode: "VAT14", rate: "14", outputBase: "100", outputTax: "14", inputBase: "0", inputTax: "0" },
  ], { outputDebit: "0", outputCredit: "13.99", inputDebit: "0", inputCredit: "0" });
  assert.equal(report.ledger.reconciled, false);
  assert.equal(report.ledger.outputDifference, "0.01");
});
