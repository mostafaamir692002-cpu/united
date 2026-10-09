/**
 * Product identity: how a piece of text becomes a canonical product, and how it does
 * not.
 *
 * The one rule this module exists to enforce: matching is EXACT, on a deterministic
 * normalization. There is no similarity scoring, no edit distance, no "did you mean",
 * and nothing that could resolve two different products to each other because their
 * names look alike. A name either normalizes to a string the master already knows, or
 * it is UNMAPPED and a human decides.
 *
 * That strictness is the point. A fuzzy match that is right 95% of the time means one
 * stock movement in twenty is posted against the wrong product, and nothing downstream
 * would ever reveal it.
 */

/**
 * Normalization rules, in order. Every one of these is a reversible-in-meaning
 * transformation — it collapses ways of WRITING the same word, never different words.
 *
 *  1. Unicode NFKC, so visually identical characters have one encoding.
 *  2. Arabic diacritics and tatweel removed: they are pronunciation aids that are
 *     freely omitted when typing, so "مانجا" and "مَانجا" are the same word.
 *  3. Alef forms (أ إ آ ٱ) folded to ا, and alef maqsura ى folded to ي. Egyptian
 *     keyboards produce these interchangeably.
 *  4. Ta marbuta ة folded to ه — the same substitution people make when typing fast.
 *  5. Arabic-Indic digits folded to ASCII, so "مانجا ٢" and "مانجا 2" agree.
 *  6. Separators (-, _, /, and any whitespace run) collapse to a single space.
 *  7. Lower-cased and trimmed.
 *
 * Deliberately NOT done: removing "ال" prefixes, stemming, dropping vowels, or
 * ignoring word order. Each of those can merge genuinely different products
 * ("Mango Naomi" vs "Mango Eweis" differ only in the final word).
 */
const ARABIC_DIACRITICS = /[ً-ْٰـ]/g;
const ARABIC_INDIC_DIGITS = /[٠-٩]/g;
const EASTERN_ARABIC_DIGITS = /[۰-۹]/g;
const SEPARATORS = /[\s\-_/\\]+/g;

export function normalizeProductName(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا") // أ إ آ ٱ -> ا
    .replace(/ى/g, "ي") // ى -> ي
    .replace(/ة/g, "ه") // ة -> ه
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(SEPARATORS, " ")
    .trim()
    .toLowerCase();
}

/** True when a string still carries meaning after normalization. */
export function isResolvableName(raw: string): boolean {
  return normalizeProductName(raw).length > 0;
}

// ---------------------------------------------------------------------------
// Resolution contract
// ---------------------------------------------------------------------------

export type ResolvedProduct = {
  id: string;
  name: string;
  nameAr: string | null;
  sku: string | null;
  unit: string;
  active: boolean;
  stockTracked: boolean;
};

/**
 * The three answers the master can give, and the only three.
 *
 * This is also the contract an integration (n8n / Hermes) codes against: it submits a
 * product name and gets back one of these. An AI may one day PROPOSE that an unmapped
 * name should become a product, but it proposes into this same shape — the master
 * stays the authority on what a name means.
 */
export type ProductResolution =
  | { status: "matched"; normalized: string; product: ResolvedProduct; matchedOn: "canonical" | "canonical_ar" | "manual" }
  | { status: "ambiguous"; normalized: string; candidates: ResolvedProduct[] }
  | { status: "unmapped"; normalized: string; reason: "no_match" | "blank" };

export function blankResolution(): ProductResolution {
  return { status: "unmapped", normalized: "", reason: "blank" };
}
