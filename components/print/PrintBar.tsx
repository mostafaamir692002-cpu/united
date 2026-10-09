"use client";

import Link from "next/link";

/** Screen-only toolbar (hidden on the printed page itself via .no-print) — the
 * physical print/PDF path is the browser's own print dialog (Save as PDF), which
 * is more reliable across devices than a homegrown PDF generator. */
export function PrintBar({ backHref }: { backHref: string }) {
  return (
    <div className="no-print sticky top-0 z-10 bg-united-dark text-white px-4 py-3 flex items-center justify-between gap-3">
      <Link href={backHref} className="font-bold text-sm hover:underline">
        ← رجوع
      </Link>
      <button onClick={() => window.print()} className="btn-primary text-sm px-5 py-2">
        🖨️ طباعة / حفظ PDF
      </button>
    </div>
  );
}
