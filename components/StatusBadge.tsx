import type { OrderStatus } from "@/lib/types";
import { STATUS_DOT, STATUS_LABEL } from "@/lib/orderPresentation";

const STYLES: Record<OrderStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  preparing: "bg-amber-100 text-amber-800",
  ready_for_loading: "bg-united-light/40 text-united-dark",
  loading: "bg-orange-100 text-orange-800",
  loaded: "bg-united-green/20 text-united-dark",
  dispatched: "bg-united-dark text-white",
  cancelled: "bg-united-dark/10 text-united-dark/60",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ${STYLES[status]}`}
    >
      <span>{STATUS_DOT[status]}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}
