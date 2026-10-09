import { postOpeningStock } from "@/lib/inventory/documents";
import { postHandler } from "@/lib/route-handlers";

/** Stock brought over at go-live: quantity, lot, cost — through the stock ledger, into the GL against opening equity. */
export const POST = postHandler("accounting.manage", async (body, actor) => ({ document: await postOpeningStock(body, actor) }));
