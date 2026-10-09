import type { QueryClient } from "@tanstack/react-query";

/**
 * Every stock screen keys its queries under ["stock", ...], so one prefix invalidation
 * refreshes the dashboard, the entry list, the ledger and the setup lists together.
 * Recording a receipt changes all four at once — refreshing only the screen you're on
 * is what makes a system feel like it "isn't syncing".
 */
export function invalidateStockData(qc: QueryClient) {
  // Not awaited: the caller has already shown its result, this only refreshes the
  // derived dashboard/ledger views in the background.
  void qc.invalidateQueries({ queryKey: ["stock"], refetchType: "active" });
}
