import { repriceDraftInvoice } from "@/lib/sales/invoicing";
import { postHandler } from "@/lib/route-handlers";

/**
 * POST /api/sales/invoices/:id/reprice
 *
 * Explicitly refresh a DRAFT invoice's lines from the order's CURRENT prices.
 * The issue endpoint refuses a draft whose frozen prices no longer match the
 * order (e.g. a recovered draft whose order was repriced while voided); this is
 * the authorized, audited step to refresh them before issuing. Issued invoices
 * are refused — their prices are the legal document.
 */
export const POST = postHandler("sales.invoices.manage", (body, actor, params) =>
  repriceDraftInvoice(params.id, body, actor).then((r) => ({ invoice: r.invoice, changed: r.changed }))
);