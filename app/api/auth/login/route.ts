import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/rbac";
import { isLoginLocked, recordLoginFailure, recordLoginSuccess } from "@/lib/loginRateLimit";
import type { Role } from "@/lib/types";
import { readJson } from "@/lib/http";

/** A bcrypt hash (cost 10, same as real accounts) of a random string nobody knows. It
 * only exists so a failed lookup costs the same time as a failed password. */
const TIMING_DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8DXUhCeWbcnA1sAxP7QSL6kZt0RBzu";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await readJson(req);
    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      throw new ApiError(400, "دخّل اسم المستخدم وكلمة السر");
    }

    const lockState = await isLoginLocked(username);
    if (lockState.locked) {
      throw new ApiError(429, `محاولات كتير غلط — حاول تاني بعد ${Math.ceil(lockState.retryAfterSec / 60)} دقيقة`);
    }

    const user = await prisma.user.findUnique({ where: { username } });
    // Always pay for one bcrypt comparison, even for an unknown or disabled account.
    // Answering those instantly while a real account takes ~70ms tells anyone timing
    // the endpoint which usernames exist.
    const ok = await verifyPassword(password, user?.passwordHash ?? TIMING_DUMMY_HASH);
    if (!user || !user.active) {
      await recordLoginFailure(username, req.headers.get("x-forwarded-for"));
      throw new ApiError(401, "بيانات الدخول غلط");
    }
    if (!ok) {
      await recordLoginFailure(username, req.headers.get("x-forwarded-for"));
      throw new ApiError(401, "بيانات الدخول غلط");
    }
    await recordLoginSuccess(username, req.headers.get("x-forwarded-for"));

    const role = user.role as Role;
    await setSessionCookie({
      id: user.id,
      name: user.name,
      username: user.username,
      role,
      sessionEpoch: user.sessionEpoch,
    });

    return NextResponse.json({
      user: { id: user.id, name: user.name, role, username: user.username, mustChangePassword: user.mustChangePassword },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
