import { ApiError } from "@/lib/rbac";
import { createCustomerReturn, createSupplierReturn } from "@/lib/inventory/documents";
import { documentStatus, postHandler } from "@/lib/route-handlers";

/** Body: { direction: "customer" | "supplier", ... } */
export const POST = postHandler(
  "stock.receive",
  (body, actor) => {
    if (body.direction === "customer") return createCustomerReturn(body, actor);
    if (body.direction === "supplier") return createSupplierReturn(body, actor);
    throw new ApiError(400, "direction لازم يكون customer أو supplier");
  },
  documentStatus
);
