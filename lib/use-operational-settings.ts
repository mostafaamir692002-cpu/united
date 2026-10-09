"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { DEFAULT_OPERATIONAL_SETTINGS, type OperationalSettings } from "@/lib/core/settings-registry";

/**
 * The configured operational thresholds, for client-side classification (waiting,
 * stalled, delivery-soon). Falls back to the code defaults while loading or if the
 * request fails, so a board never stops rendering over a settings read.
 */
export function useOperationalSettings(): OperationalSettings {
  const { data } = useQuery({
    queryKey: ["settings", "operational"],
    queryFn: () => apiFetch<{ settings: OperationalSettings }>("/api/settings/operational"),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  return data?.settings ?? DEFAULT_OPERATIONAL_SETTINGS;
}
