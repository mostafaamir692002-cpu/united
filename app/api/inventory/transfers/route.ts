import { createTransfer } from "@/lib/inventory/documents";
import { documentStatus, postHandler } from "@/lib/route-handlers";

export const POST = postHandler("stock.transfer", (body, actor) => createTransfer(body, actor), documentStatus);
