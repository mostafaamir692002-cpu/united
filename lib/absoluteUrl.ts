import { headers } from "next/headers";

/** Best-effort absolute origin for this request — used to build a URL that's
 * actually scannable from a printed page (a relative path means nothing on paper). */
export function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
