import { mapOrderCustomerName } from "@/lib/sales/customers";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("sales.customers.manage", (body, actor) => mapOrderCustomerName(body.customer_name, body.customer_id, actor), () => 200);
