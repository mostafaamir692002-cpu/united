"use client";

import { useCallback, useEffect, useRef } from "react";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft-persistence";
import type { DraftMeta } from "@/lib/draft-persistence";

/**
 * Hook for auto-saving form drafts to localStorage.
 * Namespaced by user ID, form type, and optional entity ID.
 *
 * Usage:
 *   const { triggerSave, clearFormDraft, restoreDraft } = useFormDraft("order", userId);
 *   // restore on mount
 *   useEffect(() => {
 *     const saved = restoreDraft();
 *     if (saved) setFormFields(saved.fields);
 *   }, []);
 *   // trigger on every change
 *   triggerSave({ field1: value1, ... });
 *   // clear on successful submit
 *   clearFormDraft();
 */

export function useFormDraft(
  formType: DraftMeta["formType"],
  userId: string | undefined | null,
  entityId?: string
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * Save draft with debounce (2s after the last change).
   */
  const triggerSave = useCallback(
    (fields: Record<string, unknown>) => {
      if (!userId) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveDraft(userId, formType, fields, entityId);
      }, 2_000);
    },
    [userId, formType, entityId]
  );

  /**
   * Clear the draft after successful submission or explicit discard.
   */
  const clearFormDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearDraft(userId ?? "", formType, entityId);
  }, [userId, formType, entityId]);

  /**
   * Restore a saved draft. Returns null if no draft exists or if
   * the user/form/entity don't match. Use on mount.
   */
  const restoreDraft = useCallback(() => {
    if (!userId) return null;
    return loadDraft(userId, formType, entityId);
  }, [userId, formType, entityId]);

  return { triggerSave, clearFormDraft, restoreDraft };
}