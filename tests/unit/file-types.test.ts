/* Upload type detection is by content, with an allow-list. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFileType, cleanFileName } from "@/lib/core/file-types";

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

test("recognises business document formats from their bytes", () => {
  assert.equal(detectFileType(bytes("%PDF-1.7\n"), "x.bin")?.mime, "application/pdf", "extension ignored for PDF");
  assert.equal(detectFileType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0), "a.png")?.mime, "image/png");
  assert.equal(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0), "a.jpg")?.mime, "image/jpeg");
  assert.equal(detectFileType(bytes("RIFF", 0, 0, 0, 0, "WEBP"), "a.webp")?.mime, "image/webp");
  assert.equal(detectFileType(bytes(0, 0, 0, 0x18, "ftypheic"), "IMG_1.HEIC")?.mime, "image/heic");
  assert.match(detectFileType(bytes("PK", 3, 4, 0), "order.xlsx")!.mime, /spreadsheetml/);
  assert.equal(detectFileType(bytes("date,qty\n2026-10-08,5\n"), "export.csv")?.mime, "text/csv");
});

test("refuses what could execute or is not a document", () => {
  assert.equal(detectFileType(bytes("<html><script>alert(1)</script>"), "invoice.pdf"), null, "HTML disguised as PDF");
  assert.equal(detectFileType(bytes("<svg onload=alert(1)>"), "logo.svg"), null);
  assert.equal(detectFileType(bytes("<html>"), "x.csv"), null, "markup in a .csv");
  assert.equal(detectFileType(bytes("PK", 3, 4, 0), "tool.zip"), null, "plain archive");
  assert.equal(detectFileType(bytes("MZ", 0x90, 0), "setup.exe"), null);
  assert.equal(detectFileType(bytes("a", 0, "b", "c"), "x.csv"), null, "binary in a .csv");
  assert.equal(detectFileType(bytes("ab"), "x.pdf"), null, "too short");
});

test("only images and PDFs may be shown inline", () => {
  assert.equal(detectFileType(bytes("%PDF-1.4"), "a.pdf")?.inlineSafe, true);
  assert.equal(detectFileType(bytes("x,y\n"), "a.csv")?.inlineSafe, false);
});

test("display names are stripped of paths and control characters", () => {
  assert.equal(cleanFileName("../../etc/passwd"), "passwd");
  assert.equal(cleanFileName("C:\\Users\\a\\فاتورة.pdf"), "فاتورة.pdf");
  assert.equal(cleanFileName('a"b\u0000c.pdf'), "abc.pdf");
  assert.equal(cleanFileName("   "), "file");
});
