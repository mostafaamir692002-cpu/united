/* Product identity: deterministic normalization. Exact matching on this output is the
   whole anti-guessing mechanism, so every rule is pinned here. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeProductName, isResolvableName } from "@/lib/productIdentity";

test("Arabic spelling variants collapse to one form", () => {
  const forms = ["مانجا", "مَانجا", "مانـــجا", " مانجا  "];
  for (const f of forms) assert.equal(normalizeProductName(f), "مانجا", f);
  assert.equal(normalizeProductName("أناناس"), normalizeProductName("اناناس"));
  assert.equal(normalizeProductName("إبراهيمي"), normalizeProductName("ابراهيمي"));
  assert.equal(normalizeProductName("كمثرى"), normalizeProductName("كمثري"));
  assert.equal(normalizeProductName("فراولة"), normalizeProductName("فراوله"));
});

test("digits, separators and case are normalized", () => {
  assert.equal(normalizeProductName("مانجا ٢"), "مانجا 2");
  assert.equal(normalizeProductName("مانجا ۲"), "مانجا 2");
  assert.equal(normalizeProductName("Mango-Naomi"), "mango naomi");
  assert.equal(normalizeProductName("MANGO__naomi"), "mango naomi");
  assert.equal(normalizeProductName("mango / naomi"), "mango naomi");
});

test("different words stay different — no stemming, no prefix stripping", () => {
  assert.notEqual(normalizeProductName("Mango Naomi"), normalizeProductName("Mango Eweis"));
  assert.notEqual(normalizeProductName("البطاطس"), normalizeProductName("بطاطس"), "'ال' is not stripped");
  assert.notEqual(normalizeProductName("naomi mango"), normalizeProductName("mango naomi"), "word order matters");
});

test("blank and non-string input is unresolvable", () => {
  assert.equal(normalizeProductName("   "), "");
  assert.equal(normalizeProductName(undefined as unknown as string), "");
  assert.equal(isResolvableName("ـــ"), false, "tatweel alone carries no meaning");
  assert.equal(isResolvableName("Banana"), true);
});
