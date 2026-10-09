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

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ id: user.id, name: user.name, username: user.username, role: user.role, sep: user.sessionEpoch })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
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
