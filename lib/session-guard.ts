import { redirect } from "next/navigation";
import { getAuthContext, type AuthContext } from "@/lib/authz";
import { homePathFor } from "@/lib/nav";
import type { Permission } from "@/lib/permissions";
import { HOME_BY_ROLE } from "@/lib/types";

export { HOME_BY_ROLE };

export type PageGate =
  | { ok: true; user: AuthContext }
  | { ok: false; user: AuthContext; missing: Permission[] };

/**
 * Server-side page guard.
 *
 * Unauthenticated (or disabled) visitors are sent to /login. An authenticated user
 * who lacks the permission is NOT bounced somewhere else — the page renders an
 * explicit access-denied state. A silent redirect hides the fact that a rule exists,
 * which makes a genuine permission problem indistinguishable from a broken link.
 *
 * This is defence in depth, not the defence: every API the page calls enforces the
 * same permission independently, so a hidden link is never what keeps data safe.
 */
export async function requirePagePermission(
  permission: Permission | Permission[]
): Promise<PageGate> {
  const user = await getAuthContext();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/account/password");
  const needed = Array.isArray(permission) ? permission : [permission];
  const missing = needed.filter((p) => !user.can(p));
  if (missing.length > 0) return { ok: false, user, missing };
  return { ok: true, user };
}

/** Landing page for the signed-in user, derived from what they can actually reach. */
export async function resolveHomePath() {
  const user = await getAuthContext();
  if (!user) redirect("/login");
  if (user.mustChangePassword) return "/account/password";
  return homePathFor(user.permissions, user.role);
}
