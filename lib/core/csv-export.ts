/** Excel-safe CSV export helpers (UTF-8 BOM + RFC 4180 quoting). */
const BOM = "\uFEFF";

/** Quote a cell per RFC 4180: wrap in quotes, double any inner quotes. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a CSV document with a UTF-8 BOM so Microsoft Excel renders Arabic and
 * other non-Latin text correctly instead of mojibake. `rows` are objects; keys
 * of the first row define the column order.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return BOM;
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(","));
  return BOM + lines.join("\r\n");
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}.csv"`,
      "cache-control": "no-store",
    },
  });
}