import { addCustomerAlias } from "@/lib/sales/customers";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("sales.customers.manage", (body, actor, params) => addCustomerAlias(params.id, body.alias, actor).then((alias) => ({ alias })));
