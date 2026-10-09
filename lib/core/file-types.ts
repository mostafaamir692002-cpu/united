/**
 * Identifies an uploaded file from its BYTES, never from the client's declared MIME
 * type or extension alone. Only the formats a business document can legitimately be
 * are accepted; HTML and SVG in particular are refused — served back from our own
 * origin they would be a stored-XSS vector.
 */

export type DetectedType = { mime: string; ext: string; inlineSafe: boolean };

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

function extOf(fileName: string) {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(fileName.trim());
  return m ? m[1].toLowerCase() : "";
}

export function detectFileType(bytes: Uint8Array, fileName: string): DetectedType | null {
  const ext = extOf(fileName);
  if (bytes.length < 4) return null;

  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf", inlineSafe: true };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png", inlineSafe: true };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg", inlineSafe: true };
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp", inlineSafe: true };
  }
  // iPhone / iPad photos.
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && ["heic", "heix", "mif1", "msf1"].includes(ascii(bytes, 8, 12))) {
    return { mime: "image/heic", ext: "heic", inlineSafe: false };
  }
  // Office Open XML is a ZIP; the extension tells us which document it is.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (ext === "xlsx") return { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext, inlineSafe: false };
    if (ext === "docx") return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext, inlineSafe: false };
    return null; // arbitrary archives are not documents
  }
  // Legacy Office (OLE2).
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (ext === "xls") return { mime: "application/vnd.ms-excel", ext, inlineSafe: false };
    if (ext === "doc") return { mime: "application/msword", ext, inlineSafe: false };
    return null;
  }
  // Plain text exports (CSV). No NUL bytes, and nothing that looks like markup.
  if (ext === "csv" || ext === "txt") {
    const head = bytes.subarray(0, 4096);
    if (head.includes(0)) return null;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(head).trimStart().toLowerCase();
    if (text.startsWith("<")) return null;
    return { mime: ext === "csv" ? "text/csv" : "text/plain", ext, inlineSafe: false };
  }
  return null;
}

/** A display-only file name: no path parts, no control characters, bounded length. */
export function cleanFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim();
  return (cleaned || "file").slice(0, 180);
}
