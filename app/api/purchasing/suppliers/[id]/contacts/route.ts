import { saveSupplierContact } from "@/lib/purchasing/suppliers";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler("purchasing.suppliers.manage", (body, actor, params) => saveSupplierContact(params.id, null, body, actor).then((contact) => ({ contact })));
