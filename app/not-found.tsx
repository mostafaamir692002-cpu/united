"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/locale";

/** Custom 404 page — friendlier than the browser's default "Not Found". */
export default function NotFound() {
  const { t } = useLocale();
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    // Capture the URL path on the client side (server headers are unavailable).
    setPath(typeof window !== "undefined" ? window.location.pathname : null);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-md flex flex-col gap-4 items-center text-center">
        <span className="text-6xl">🤔</span>
        <h1 className="text-2xl font-extrabold text-united-dark">{t("ui.not-found")}</h1>
        {path && (
          <p className="text-sm font-bold text-united-muted">
            <code className="text-xs">{path}</code>
          </p>
        )}
        <p className="text-sm text-united-muted">{t("ui.not-found-desc")}</p>
        <Link href="/" className="btn-primary text-lg px-8">{t("ui.back-home")}</Link>
      </div>
    </main>
  );
}
