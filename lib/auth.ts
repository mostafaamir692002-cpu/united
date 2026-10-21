import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { JWT_SECRET } from "@/lib/env";
import type { Role } from "@/lib/types";

const COOKIE_NAME = "united_session";

// lib/env.ts is the single place that decides what a missing secret means: in
// production a missing JWT_SECRET refuses the boot rather than falling back to a
// string baked into this repo, which anyone who has read the source could use to
// forge a SUPER_ADMIN session.
const secret = new TextEncoder().encode(JWT_SECRET);

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: Role;
  /** User.sessionEpoch at sign-in. A token whose epoch no longer matches the user's
   * row is refused, which is how a password change ends every older session. Tokens
   * issued before this claim existed read as epoch 1, so deploying it signs nobody out. */
  sessionEpoch: number;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser, ttlHours: number) {
  return new SignJWT({ id: user.id, name: user.name, username: user.username, role: user.role, sep: user.sessionEpoch })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${Math.max(1, Math.floor(ttlHours))}h`)
    .sign(secret);
}

export async function setSessionCookie(user: SessionUser, ttlHours: number) {
  const token = await createSessionToken(user, ttlHours);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(3600, Math.floor(ttlHours) * 3600),
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

/** Verify a raw JWT string and return the embedded SessionUser, or null on any
 * failure (expired, tampered, wrong key). Shared by the cookie path and the Bearer
 * path below. */
async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      name: payload.name as string,
      username: payload.username as string,
      role: payload.role as Role,
      sessionEpoch: typeof payload.sep === "number" ? payload.sep : 1,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the session from two sources, in order of precedence:
 *
 *  1. `Authorization: Bearer <JWT>` — set by the client from
 *     sessionStorage (tab-scoped). If this header is present but its token is
 *     invalid or expired, the request is refused as unauthenticated (returns
 *     null). There is NO silent fallback to the shared cookie when a Bearer
 *     token is present but bad — that would let a compromised tab read
 *     the cookie of another user.
 *
 *  2. `united_session` httpOnly cookie — the traditional shared storage,
 *     used when no Authorization header is supplied (backward-compatible
 *     path for users who do not need multi-tab isolation).
 *
 * A well-formed Bearer token that is valid for a *different* user than the
 * cookie happens to also hold is not possible (the JWT carries the identity;
 * the server re-reads permissions from the DB for every request), so there
 * is no cross-user confusion risk.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  // 1. Authorization: Bearer — tab-scoped sessionStorage
  try {
    const { headers } = await import("next/headers");
    const authHeader = headers().get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const user = await verifyToken(authHeader.slice(7));
      // SECURITY: if a Bearer token is present but invalid or expired, DO NOT
      // fall back to the cookie. A Bearer-bearing request explicitly opted into
      // per-tab auth; silently using the cookie would defeat the isolation.
      return user;
    }
    // If an Authorization header is present but NOT a Bearer token, refuse.
    if (authHeader) return null;
  } catch {
    // headers() may not be available outside a request context (e.g. build
    // phase). Silently fall through to cookie.
  }

  // 2. Cookie — shared traditional path
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}