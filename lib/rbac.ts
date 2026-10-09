import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  // A short reference ties what the user reports to the server log line.
  const ref = randomUUID().slice(0, 8);
  const mapped = clientFault(err);
  if (mapped) {
    // The request was wrong, not the server: say so (4xx), but keep the log line —
    // at error level for a database rule, which may also point at a missing check.
    (mapped.loud ? console.error : console.warn)(`[api-${mapped.status} ${ref}]`, (err as Error)?.message?.split("\n").filter(Boolean).slice(-1)[0]);
    return NextResponse.json({ error: mapped.message, ref }, { status: mapped.status });
  }
  console.error(`[api-error ${ref}]`, err);
  return NextResponse.json({ error: "خطأ في السيرفر", ref }, { status: 500 });
}

/**
 * Database errors that can only come from the request itself — never a server fault:
 * - a Prisma validation error: a field of the wrong shape (an object where an id goes)
 *   reached a query unvalidated;
 * - a unique-key race: two requests created the same code at the same moment;
 * - PostgreSQL refusing a NUL character in text.
 * Everything else stays a 500.
 */
function clientFault(err: unknown): { status: number; message: string; loud?: boolean } | null {
  const e = err as { name?: string; code?: string; message?: string } | null;
  if (!e || typeof e !== "object") return null;
  if (e.name === "PrismaClientValidationError") return { status: 400, message: "بيانات الطلب غير صالحة: نوع حقل غير متوقع" };
  if (e.name === "PrismaClientKnownRequestError" && e.code === "P2002") return { status: 409, message: "السجل ده موجود بالفعل (تكرار) — حدّث الصفحة وراجع" };
  if (typeof e.message === "string" && /invalid byte sequence for encoding \\?"UTF8\\?": 0x00|unsupported Unicode escape sequence/.test(e.message)) return { status: 400, message: "النص فيه حرف غير مسموح (NUL)" };
  // A database rule refused the row (CHECK / foreign key). The transaction rolled back,
  // nothing was written; the request cannot succeed as sent.
  const check = typeof e.message === "string" ? /violates check constraint \\?"([A-Za-z0-9_]+)\\?"/.exec(e.message) : null;
  if (check) return { status: 422, message: `البيانات مخالفة لقاعدة: ${check[1]} — راجع التواريخ والكميات`, loud: true };
  if ((e.name === "PrismaClientKnownRequestError" && e.code === "P2003") || (typeof e.message === "string" && /violates foreign key constraint/.test(e.message)))
    return { status: 400, message: "مرجع غير موجود (صنف/مكان/طرف غير معروف)", loud: true };
  return null;
}
