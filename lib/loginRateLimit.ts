import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

/**
 * Brute-force lockout on sign-in, keyed per username, kept in the database: it holds
 * across every app instance and survives restarts (the earlier in-memory version did
 * neither). Five failures within five minutes lock the name for five minutes after
 * the last failure; attempts made while locked are refused before they are checked
 * or counted, so a locked account cannot be kept locked forever by hammering it…
 * beyond the five minutes. A successful sign-in clears the count.
 *
 * Every attempt is recorded (LoginAttempt) — that is also the failed-login record.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60_000;
const LOCKOUT_MS = 5 * 60_000;
const key = (u: string) => u.trim().toLowerCase();

export async function isLoginLocked(username: string): Promise<{ locked: true; retryAfterSec: number } | { locked: false }> {
  const u = key(username);
  const now = Date.now();
  const lastSuccess = await prisma.loginAttempt.findFirst({ where: { username: u, success: true }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const since = new Date(Math.max(now - WINDOW_MS - LOCKOUT_MS, lastSuccess?.createdAt.getTime() ?? 0));
  const failures = await prisma.loginAttempt.findMany({ where: { username: u, success: false, createdAt: { gt: since } }, orderBy: { createdAt: "desc" }, take: MAX_ATTEMPTS, select: { createdAt: true } });
  if (failures.length < MAX_ATTEMPTS) return { locked: false };
  const newest = failures[0].createdAt.getTime();
  const oldest = failures[MAX_ATTEMPTS - 1].createdAt.getTime();
  if (newest - oldest > WINDOW_MS) return { locked: false };
  const until = newest + LOCKOUT_MS;
  return until > now ? { locked: true, retryAfterSec: Math.ceil((until - now) / 1000) } : { locked: false };
}

export async function recordLoginFailure(username: string, ip?: string | null) {
  const u = key(username);
  await prisma.loginAttempt.create({ data: { username: u, success: false, ip: ip ?? null } });
  const lock = await isLoginLocked(u);
  if (lock.locked) {
    const user = await prisma.user.findUnique({ where: { username: username.trim() }, select: { id: true } });
    await prisma.$transaction((tx) =>
      writeAudit({ userId: null, userName: u, role: "SYSTEM", action: "login_locked", entityType: "user", entityId: user?.id ?? `unknown:${u}`, fieldChanged: "login", newValue: `${MAX_ATTEMPTS} محاولات غلط — مقفول ${LOCKOUT_MS / 60_000} دقائق`, source: "system", deviceId: ip ?? undefined }, tx)
    );
  }
}

export async function recordLoginSuccess(username: string, ip?: string | null) {
  await prisma.loginAttempt.create({ data: { username: key(username), success: true, ip: ip ?? null } });
}

/** Recent failed sign-ins, for the administrator. */
export async function recentFailedLogins(limit = 50) {
  return prisma.loginAttempt.findMany({ where: { success: false }, orderBy: { createdAt: "desc" }, take: limit });
}
