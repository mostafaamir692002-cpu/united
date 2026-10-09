/** A fresh idempotency key for one filled form. `crypto.randomUUID` exists only in secure
 *  contexts (HTTPS / localhost); a tablet on the warehouse LAN over plain HTTP falls back. */
export const newClientKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
