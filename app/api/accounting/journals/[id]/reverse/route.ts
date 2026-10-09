import { reverseJournal } from "@/lib/accounting/ledger";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("accounting.manage", async (body, actor, params) => ({ journal: await reverseJournal(params.id, body, actor) }));
