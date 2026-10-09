import { saveContact } from "@/lib/sales/customers";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("sales.customers.manage", (body, actor, params) => saveContact(params.id, null, body, actor).then((contact) => ({ contact })));
