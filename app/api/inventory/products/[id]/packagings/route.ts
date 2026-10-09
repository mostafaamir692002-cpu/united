import { savePackaging } from "@/lib/inventory/products";
import { postHandler } from "@/lib/route-handlers";

/** Create or update the packaging for one unit: { uom, qty_in_base_unit, barcode?, active?, expected_version? } */
export const POST = postHandler("stock.manage_products", (body, actor, params) => savePackaging(params.id, body, actor).then((packaging) => ({ packaging })), () => 200);
