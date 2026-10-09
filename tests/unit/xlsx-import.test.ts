import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseCsv } from "@/lib/data-import/csv";
import { xlsxToCsv } from "@/lib/data-import/xlsx";

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Record<string, string>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let localOffset = 0;
  for (const [filename, raw] of Object.entries(files)) {
    const name = Buffer.from(filename);
    const source = Buffer.from(raw);
    const checksum = crc32(source);
    const compressed = deflateRawSync(source);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(source.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    locals.push(local, compressed);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(source.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centrals.push(central);
    localOffset += local.length + compressed.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}

function workbook(sheet: string) {
  return zip({
    "xl/workbook.xml": `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="0"/><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/sharedStrings.xml": `<sst><si><t>name</t></si><si><t>valid_from</t></si><si><t>enabled</t></si></sst>`,
    "xl/worksheets/sheet1.xml": sheet,
  });
}

test("XLSX first sheet becomes CSV with shared/inline text, booleans and Excel dates", () => {
  const bytes = workbook(`<worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>Hotel, Cairo &amp; Co</t></is></c><c r="B2"><v>45292</v></c><c r="C2" t="b"><v>1</v></c></row>
  </sheetData></worksheet>`);
  const rows = parseCsv(xlsxToCsv(bytes), ["name", "valid_from"]);
  assert.deepEqual(rows.map((row) => row.values), [{ name: "Hotel, Cairo & Co", valid_from: "2024-01-01", enabled: "TRUE" }]);
});

test("XLSX formulas and XML entity declarations are rejected", () => {
  assert.throws(() => xlsxToCsv(workbook(`<worksheet><sheetData><row r="1"><c r="A1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>`)), /احذف المعادلات/);
  assert.throws(() => xlsxToCsv(workbook(`<worksheet><sheetData><row r="1"><c r="A1"><f t="shared" si="0"/><v>2</v></c></row></sheetData></worksheet>`)), /احذف المعادلات/);
  assert.throws(() => xlsxToCsv(workbook(`<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&#xD800;</t></is></c></row></sheetData></worksheet>`)), /مرجع حرف غير صالح/);
  const bad = zip({ "xl/workbook.xml": `<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><workbook/>` });
  assert.throws(() => xlsxToCsv(bad), /XML غير مسموح/);
});

test("XLSX parser rejects non-ZIP and workbooks without a worksheet", () => {
  assert.throws(() => xlsxToCsv(Buffer.from("not an xlsx")), /مش Excel XLSX/);
  const empty = zip({ "xl/workbook.xml": "<workbook/>", "xl/_rels/workbook.xml.rels": "<Relationships/>" });
  assert.throws(() => xlsxToCsv(empty), /ورقة عمل/);
  const unsafe = zip({ "../xl/workbook.xml": "<workbook/>" });
  assert.throws(() => xlsxToCsv(unsafe), /غير آمن/);
  const corrupt = Buffer.from(workbook(`<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`));
  const central = corrupt.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  corrupt.writeUInt32LE((corrupt.readUInt32LE(central + 16) ^ 1) >>> 0, central + 16);
  assert.throws(() => xlsxToCsv(corrupt), /تالف/);
});
