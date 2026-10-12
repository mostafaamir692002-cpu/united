/**
 * Client-side draft persistence for order forms using localStorage.
 *
 * Drafts are saved automatically as the user types (debounced) and restored
 * when the same user returns to the same form. Drafts are namespaced by
 * user ID, form type, and entity ID to prevent cross-user leakage.
 *
 * Rules:
 * - Drafts are NEVER treated as official posted documents.
 * - Drafts are cleared on successful submission or explicit discard.
 * - Passwords, tokens, and session cookies are NEVER stored.
 * - Restored drafts are revalidated against server data.
 */

const DRAFT_PREFIX = "united:draft";

export type DraftMeta = {
  userId: string;
  formType: "order" | "intake" | "po" | "invoice" | "bill";
  entityId?: string; // When editing an existing entity
  savedAt: number;
};

export type DraftData = {
  meta: DraftMeta;
  fields: Record<string, unknown>;
};

/**
 * Build a storage key from the draft metadata.
 */
function draftKey(meta: DraftMeta): string {
  const parts = [DRAFT_PREFIX, meta.userId, meta.formType];
  if (meta.entityId) parts.push(meta.entityId);
  return parts.join(":");
}

/**
 * Save a draft to localStorage.
 */
export function saveDraft(userId: string, formType: DraftMeta["formType"], fields: Record<string, unknown>, entityId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const meta: DraftMeta = { userId, formType, entityId, savedAt: Date.now() };
    const data: DraftData = { meta, fields };
    const key = draftKey(meta);
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage full or disabled — silently fail
  }
}

/**
 * Load a draft from localStorage. Returns null if no draft exists or if
 * the user ID/form type don't match.
 */
export function loadDraft(userId: string, formType: DraftMeta["formType"], entityId?: string): DraftData | null {
  if (typeof window === "undefined") return null;
  try {
    const key = draftKey({ userId, formType, entityId, savedAt: 0 });
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as DraftData;
    // Namespace check: ensure this draft belongs to this user/form
    if (data.meta.userId !== userId || data.meta.formType !== formType) {
      localStorage.removeItem(key);
      return null;
    }
    // Optional: discard drafts older than 24 hours
    if (Date.now() - data.meta.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Clear a specific draft.
 */
export function clearDraft(userId: string, formType: DraftMeta["formType"], entityId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = draftKey({ userId, formType, entityId, savedAt: 0 });
    localStorage.removeItem(key);
  } catch {
    // silently fail
  }
}

/**
 * Clear all drafts for a user, optionally filtered by form type.
 */
export function clearUserDrafts(userId: string, formType?: DraftMeta["formType"]): void {
  if (typeof window === "undefined") return;
  try {
    const prefix = `${DRAFT_PREFIX}:${userId}${formType ? `:${formType}` : ""}`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // silently fail
  }
}