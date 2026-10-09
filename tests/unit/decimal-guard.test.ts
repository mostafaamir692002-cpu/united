/* decimal.js treats ZERO as "positive" (isPositive() tests the sign bit). Using it to
   mean "> 0" divided 0 by 0 in the ledger's average-cost path. This pins the trap and
   keeps it out of the code base. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { Prisma } from "@prisma/client";

test("the trap is real: Decimal(0).isPositive() is true", () => {
  assert.equal(new Prisma.Decimal(0).isPositive(), true);
  assert.equal(new Prisma.Decimal(0).gt(0), false);
});

test("no isPositive()/isNegative() on Decimals in lib/ — use gt(0)/lt(0)", () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && /\.is(Positive|Negative)\(\)/.test(readFileSync(p, "utf8"))) offenders.push(p);
    }
  };
  walk("lib");
  assert.deepEqual(offenders, []);
});
