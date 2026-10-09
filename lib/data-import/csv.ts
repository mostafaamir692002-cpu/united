import { ApiError } from "@/lib/rbac";

export type CsvRecord = { rowNumber: number; values: Record<string, string> };

const MAX_ROWS = 1000;
const MAX_COLUMNS = 80;

function delimiterOf(source: string): string {
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') i++;
      else quoted = !quoted;
      continue;
    }
    if (!quoted && (ch === "\n" || ch === "\r")) break;
    if (!quoted && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

function parseCells(source: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted) quoted = false;
      else if (cell.length === 0) quoted = true;
      else throw new ApiError(400, `علامة اقتباس غير متوقعة في موضع ${i + 1}`);
      continue;
    }
    if (!quoted && ch === delimiter) {
      row.push(cell); cell = ""; continue;
    }
    if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = ""; continue;
    }
    cell += ch;
  }
  if (quoted) throw new ApiError(400, "فيه خلية مفتوحة بعلامة اقتباس ومش مقفولة");
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function parseCsv(source: string, requiredHeaders: readonly string[]): CsvRecord[] {
  if (typeof source !== "string" || !source.trim()) throw new ApiError(400, "الملف فاضي");
  if (source.length > 2_000_000) throw new ApiError(413, "حجم ملف الاستيراد أكبر من 2 ميجابايت");
  if (source.includes("\u0000")) throw new ApiError(400, "الملف فيه حرف غير مسموح");
  const cells = parseCells(source.replace(/^\uFEFF/, ""), delimiterOf(source));
  const headerRow = cells.shift()?.map((x) => x.trim().toLowerCase()) ?? [];
  if (!headerRow.length || headerRow.length > MAX_COLUMNS || headerRow.some((x) => !x)) throw new ApiError(400, "صف العناوين فاضي أو فيه عنوان عمود غير صالح");
  if (new Set(headerRow).size !== headerRow.length) throw new ApiError(400, "فيه عنوان عمود مكرر في الملف");
  const missing = requiredHeaders.filter((h) => !headerRow.includes(h));
  if (missing.length) throw new ApiError(400, `أعمدة مطلوبة ناقصة: ${missing.join("، ")}`);
  const dataRows = cells.map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => row.some((v) => v.trim()));
  if (!dataRows.length) throw new ApiError(400, "الملف مفيهوش صفوف بيانات");
  if (dataRows.length > MAX_ROWS) throw new ApiError(400, `الحد الأقصى ${MAX_ROWS} صف في الملف الواحد`);
  return dataRows.map(({ row, rowNumber }) => {
    if (row.slice(headerRow.length).some((value) => value.trim())) {
      throw new ApiError(400, `صف ${rowNumber} فيه بيانات زيادة عن عناوين الأعمدة — أضف العنوان الناقص أو صحح الملف`);
    }
    return {
      rowNumber,
      values: Object.fromEntries(headerRow.map((h, i) => [h, (row[i] ?? "").trim()])),
    };
  });
}
