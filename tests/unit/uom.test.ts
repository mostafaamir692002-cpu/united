/* Unit conversion: exact decimals, same-category only, package units refused. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { convertQuantity, UomConversionError } from "@/lib/core/uom";
import { UNITS_OF_MEASURE } from "@/lib/core/reference-data";

const U = Object.fromEntries(UNITS_OF_MEASURE.map((u) => [u.code, u]));

test("weight converts through the reference unit, exactly", () => {
  assert.equal(convertQuantity("2.5", U.TON, U.KG).toString(), "2500");
  assert.equal(convertQuantity(1250, U.KG, U.TON).toString(), "1.25");
  assert.equal(convertQuantity("0.1", U.KG, U.G).toString(), "100");
  // The classic float trap: 0.1 + 0.2 kg in grams.
  assert.equal(convertQuantity("0.3", U.KG, U.G).toString(), "300");
});

test("results round half-up to the target unit's precision", () => {
  assert.equal(convertQuantity("1234.5678", U.G, U.KG).toString(), "1.235", "KG keeps 3 dp");
  assert.equal(convertQuantity("1.0005", U.KG, U.G).toString(), "1001", "G keeps 0 dp");
  assert.equal(convertQuantity("25", U.PIECE, U.DOZEN).toString(), "2", "2.083 dozen at 0 dp");
});

test("same unit is a no-op apart from precision", () => {
  assert.equal(convertQuantity("12.3456", U.KG, U.KG).toString(), "12.346");
});

test("different categories never convert", () => {
  assert.throws(() => convertQuantity(1, U.KG, U.L), UomConversionError);
  assert.throws(() => convertQuantity(1, U.PIECE, U.KG), UomConversionError);
});

test("package units have no global ratio — the conversion is per product", () => {
  assert.throws(() => convertQuantity(1, U.CRATE, U.KG), UomConversionError);
  assert.throws(() => convertQuantity(1, U.CRATE, U.CARTON), UomConversionError);
});

test("baseline data: exactly one reference unit per convertible category, ratio 1", () => {
  for (const cat of ["weight", "volume", "count"]) {
    const refs = UNITS_OF_MEASURE.filter((u) => u.category === cat && u.isReference);
    assert.equal(refs.length, 1, cat);
    assert.equal(refs[0].ratioToReference, "1");
  }
  for (const u of UNITS_OF_MEASURE.filter((x) => x.category === "package")) {
    assert.equal(u.ratioToReference, null, u.code);
    assert.equal(u.isReference, false, u.code);
  }
});
