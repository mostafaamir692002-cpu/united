"use client";

import { useContext } from "react";
import { LocaleContext, type LocaleContextValue } from "./context";

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

export { LocaleProvider } from "./context";
export type { Locale } from "./context";
export { DICTIONARY } from "./dictionary";
export type { TranslationKey } from "./dictionary";