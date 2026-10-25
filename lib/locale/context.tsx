"use client";

import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { DICTIONARY } from "./dictionary";

export type Locale = "ar" | "en";

export type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
  isRTL: boolean;
  isEN: boolean;
};

const STORAGE_KEY = "united_locale";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "ar";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "ar" || stored === "en") return stored;
  // Respect browser language preference
  const browserLang = navigator.language?.slice(0, 2);
  return browserLang === "en" ? "en" : "ar";
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: "ar",
  setLocale: () => {},
  toggleLocale: () => {},
  t: (key) => {
    const dict = DICTIONARY as any;
    return dict[key]?.ar ?? key;
  },
  dir: "rtl",
  isRTL: true,
  isEN: false,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(getInitialLocale());
    setMounted(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
    }
    // Update html attributes
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    document.body.className = l === "ar"
      ? "font-arabic bg-united-bg text-united-dark"
      : "font-english bg-united-bg text-united-dark";
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "ar" ? "en" : "ar");
  }, [locale, setLocale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const entry = (DICTIONARY as any)[key];
      if (!entry) return key;
      const arText = entry.ar;
      const enText = entry.en;
      const text = locale === "en" ? enText : arText;
      if (!params || !text) return text ?? key;
      return text.replace(/\{(\w+)\}/g, (_: string, name: string) => String(params[name] ?? `{${name}}`));
    },
    [locale]
  );

  const dir: "ltr" | "rtl" = locale === "ar" ? "rtl" : "ltr";
  const isRTL = locale === "ar";
  const isEN = locale === "en";

  // Avoid hydration mismatch — render nothing until mounted
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, toggleLocale, t, dir, isRTL, isEN }}>
      {children}
    </LocaleContext.Provider>
  );
}