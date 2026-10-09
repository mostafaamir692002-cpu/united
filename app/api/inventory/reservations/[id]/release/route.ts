import { releaseReservation } from "@/lib/inventory/reservations";
import { postHandler } from "@/lib/route-handlers";

export const POST = postHandler(
  "stock.reserve",
  (body, actor, params) => releaseReservation(params.id, body.reason, actor, body.expected_version as number | undefined).then((reservation) => ({ reservation })),
  () => 200
);
