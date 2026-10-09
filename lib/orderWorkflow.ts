import type { OrderStatus, Role } from "@/lib/types";

// Allowed forward transitions and which roles may drive them.
//
// This is the WORKFLOW rule only — who may legally take a given step from a given
// state. It deliberately says nothing about who may FORCE a non-standard step: that
// is an authorization question, decided by the orders.edit permission in
// moveOrderStatus. Special-casing a role here would create a second route to
// overriding the workflow that no permission change could ever take away.
const TRANSITIONS: Record<OrderStatus, { to: OrderStatus; roles: Role[] }[]> = {
  new: [{ to: "preparing", roles: ["PREPARER", "SUPERVISOR"] }],
  preparing: [{ to: "ready_for_loading", roles: ["PREPARER", "SUPERVISOR"] }],
  ready_for_loading: [{ to: "loading", roles: ["LOADER", "SUPERVISOR"] }],
  loading: [{ to: "loaded", roles: ["LOADER", "SUPERVISOR"] }],
  loaded: [{ to: "dispatched", roles: ["LOADER", "SUPERVISOR"] }],
  dispatched: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus, role: Role): boolean {
  return TRANSITIONS[from]?.some((t) => t.to === to && t.roles.includes(role)) ?? false;
}

/** True if `to` is a normal next step from `from` for ANY operational role (i.e. not
 * a supervisor skipping/reversing steps). Used to decide whether a supervisor-driven
 * change is a routine action or a true override that must be justified with a reason. */
export function isStandardTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.some((t) => t.to === to) ?? false;
}
