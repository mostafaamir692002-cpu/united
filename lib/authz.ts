import { cache } from "react";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ApiError } from "@/lib/rbac";
import { forbiddenMessage } from "@/lib/authz-core";
import { type Permission } from "@/lib/permissions";
import { type Role } from "@/lib/types";
import { applyOverrides, loadUserWithOverrides } from "@/lib/authz-core";

// The rules live in authz-core, which has no framework dependency and can therefore be
// imported by scripts. This module is only the request-scoped layer over them.
export {
  actorCan,
  assertPermission,
  forbiddenMessage,
  resolveEffectivePermissions,
  syncPermissionCatalogue,
} from "@/lib/authz-core";

/**
 * The one authorization mechanism in the system.
 *
 * Every protected route, service action and page resolves access through this file.
 * Nothing anywhere else may decide access from a role string — that is exactly how
 * authorization drifts out of sync between the API and the screen that calls it.
 *
 * Three properties this is built to guarantee:
 *
 *  1. It reads the user from the DATABASE on every request, never from the JWT. The
 *     token proves who you are; it does not say what you may do. A disabled account
 *     or a changed role therefore takes effect on the very next request, with no
 *     session to expire and nothing to revoke.
 *  2. It fails CLOSED. If permission resolution throws — the database is unreachable,
 *     a row is malformed — the caller gets no permissions and the request is refused.
 *     A failure to prove access is never treated as access.
 *  3. SUPER_ADMIN short-circuits to every permission and ignores overrides, so the
 *     administrator role cannot be edited into uselessness.
 */

export type AuthContext = {
  id: string;
  name: string;
  username: string;
  role: Role;
  permissions: Set<Permission>;
  /** The account may do nothing but choose its own password (see /api/auth/password). */
  mustChangePassword: boolean;
  deviceId?: string;
  can: (permission: Permission) => boolean;
};

function buildContext(
  user: { id: string; name: string; username: string; role: string; mustChangePassword?: boolean },
  permissions: Set<Permission>,
  deviceId?: string
): AuthContext {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role as Role,
    permissions,
    mustChangePassword: user.mustChangePassword ?? false,
    deviceId,
    can: (permission) => permissions.has(permission),
  };
}

/**
 * Loads the current user and their effective permissions, or null when there is no
 * valid session, the account no longer exists, or it has been disabled.
 *
 * Any error while resolving is swallowed into null — refused, not allowed.
 */
export async function getAuthContext(deviceId?: string): Promise<AuthContext | null> {
  const resolved = await loadAuthState();
  return resolved ? buildContext(resolved.user, resolved.permissions, deviceId) : null;
}

/**
 * One database round trip for identity AND permissions, memoised for the lifetime of
 * the request.
 *
 * Both matter on site: every protected request pays this cost, the database is a
 * region away, and a page guard plus the endpoints it calls would otherwise each
 * re-resolve the same user. Fetching the overrides alongside the user keeps the total
 * at exactly one query — the same as the role-only check this replaced — so adding
 * permissions cost the request nothing.
 */
const loadAuthState = cache(async () => {
  try {
    const session = await getSessionUser();
    if (!session) return null;
    // The DB is authoritative for role and active state, not the signed token.
    const loaded = await loadUserWithOverrides(session.id);
    if (!loaded || !loaded.user.active) return null;
    // A password change (or any future "sign out everywhere") bumps the epoch; tokens
    // minted before it stop working on their very next request.
    if (loaded.user.sessionEpoch !== session.sessionEpoch) return null;
    return {
      user: loaded.user,
      // A password set by an administrator is a key someone else knows: until the user
      // replaces it, the session carries no permissions at all.
      permissions: loaded.user.mustChangePassword ? new Set<Permission>() : applyOverrides(loaded.user.role as Role, loaded.overrides),
    };
  } catch (err) {
    // Next signals "this route must render dynamically" and "redirect" by throwing.
    // Those are control flow, not failures — swallowing them would both spam the log
    // with fake auth errors and interfere with Next's own rendering decisions.
    if (isFrameworkControlFlow(err)) throw err;
    console.error("[authz] permission resolution failed — denying access", err);
    return null;
  }
});

function isFrameworkControlFlow(err: unknown) {
  const digest = (err as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_") || digest === "DYNAMIC_SERVER_USAGE");
}

function deviceIdOf(req?: NextRequest) {
  return req?.headers.get("x-device-id") ?? undefined;
}

/** 401 when not signed in, 403 when signed in without the permission. */
export async function requirePermission(
  req: NextRequest | undefined,
  permission: Permission | Permission[]
): Promise<AuthContext> {
  const ctx = await getAuthContext(deviceIdOf(req));
  if (!ctx) throw new ApiError(401, "لازم تسجل دخول الأول");
  const needed = Array.isArray(permission) ? permission : [permission];
  const missing = needed.filter((p) => !ctx.can(p));
  if (missing.length > 0) throw new ApiError(403, forbiddenMessage(missing));
  return ctx;
}

/** Passes when the caller holds ANY of the listed permissions. */
export async function requireAnyPermission(
  req: NextRequest | undefined,
  permissions: Permission[]
): Promise<AuthContext> {
  const ctx = await getAuthContext(deviceIdOf(req));
  if (!ctx) throw new ApiError(401, "لازم تسجل دخول الأول");
  if (!permissions.some((p) => ctx.can(p))) throw new ApiError(403, forbiddenMessage(permissions));
  return ctx;
}

/** Authenticated only — for endpoints whose finer checks happen in the service. */
export async function requireAuth(req?: NextRequest): Promise<AuthContext> {
  const ctx = await getAuthContext(deviceIdOf(req));
  if (!ctx) throw new ApiError(401, "لازم تسجل دخول الأول");
  if (ctx.mustChangePassword) throw new ApiError(403, "لازم تغيّر كلمة السر الأول");
  return ctx;
}
