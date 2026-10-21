import { recoverVoidDraftInvoice } from "@/lib/sales/invoicing";
import { postHandler } from "@/lib/route-handlers";

/**
 * POST /api/sales/invoices/:id/recover
 *
 * Recover a voided draft invoice back to draft status. The invoice keeps its
 * existing lines and pricing; it can then be issued normally.
 *
 * Body: { reason: string, expected_version?: number }
 */
export const POST = postHandler("sales.invoices.manage", (body, actor, params) =>
  recoverVoidDraftInvoice(params.id, body, actor).then((invoice) => ({ invoice })), () => 200);