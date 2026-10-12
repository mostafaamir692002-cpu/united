"use client";

import { useQueryClient } from "@tanstack/react-query";

/**
 * Clears ALL React Query caches and navigates to the login page.
 * Called on logout or session expiry.
 */
export function useClearSession() {
  const qc = useQueryClient();

  return async function clearSession(redirectTo = "/login") {
    // Clear every cached query — orders, stock, approvals, everything.
    // The next time any component mounts, it will re-fetch from scratch
    // with the new session (or get a 401 and redirect again).
    qc.clear();

    // Hit the logout endpoint to clear the cookie server-side.
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Network error — the cookie will be stale anyway
    }

    // Navigate to login. Using window.location ensures a full page reload
    // and a fresh React Query instance.
    if (typeof window !== "undefined") {
      window.location.href = redirectTo;
    }
  };
}

/**
 * Register a cross-tab logout listener. When one tab logs out, it writes
 * a timestamp to localStorage. All other tabs detect the change and
 * redirect to login.
 */
export function useCrossTabLogout() {
  const qc = useQueryClient();

  // Only run on the client
  if (typeof window === "undefined") return;

  const handler = (e: StorageEvent) => {
    if (e.key === "united:logout" && e.newValue) {
      // Another tab logged out — clear our cache too
      qc.clear();
      window.location.href = "/login";
    }
  };

  // Register the listener (removed on cleanup by React StrictMode)
  window.addEventListener("storage", handler);

  // Cleanup
  return () => window.removeEventListener("storage", handler);
}

/**
 * Call this from the logout button to trigger a cross-tab logout signal.
 */
export function broadcastLogout() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("united:logout", String(Date.now()));
  } catch {
    // localStorage might be disabled or full
  }
}