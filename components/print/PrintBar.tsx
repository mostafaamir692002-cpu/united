"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale";

/** Screen-only toolbar (hidden on the printed page itself via .no-print) */
export function PrintBar({ backHref }: { backHref: string }) {
  const { t } = useLocale();
  return (
    <div className="no-print sticky top-0 z-10 bg-united-dark text-white px-4 py-3 flex items-center justify-between gap-3">
      <Link href={backHref} className="font-bold text-sm hover:underline">
        ← {t("ui.back")}
      </Link>
      <button onClick={() => window.print()} className="btn-primary text-sm px-5 py-2 bg-white text-united-dark hover:bg-gray-100">
        🖨️ {t("ui.print")}
      </button>
    </div>
  );
}