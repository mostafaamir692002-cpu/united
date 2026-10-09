import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/rbac";
import { getAuthContext } from "@/lib/authz";
import { setSessionCookie } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { changeOwnPassword } from "@/lib/admin-service";
import { isLoginLocked, recordLoginFailure, recordLoginSuccess } from "@/lib/loginRateLimit";

/**
 * Any signed-in user changes their own password — including one whose password an
 * administrator set and who can do nothing else until they do. Every other session
 * ends; this one continues on a fresh token.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) throw new ApiError(401, "لازم تسجل دخول الأول");
    const body = await readJson(req);
    // Guessing the current password from a hijacked session meets the same lockout
    // as guessing it at the login screen.
    const lock = await isLoginLocked(ctx.username);
    if (lock.locked) throw new ApiError(429, `محاولات كتير غلط — حاول تاني بعد ${Math.ceil(lock.retryAfterSec / 60)} دقيقة`);
    let user;
    try {
      user = await changeOwnPassword(ctx.id, body.current_password, body.new_password);
    } catch (err) {
      if (err instanceof ApiError && err.message === "كلمة السر الحالية غلط") await recordLoginFailure(ctx.username, req.headers.get("x-forwarded-for"));
      throw err;
    }
    await recordLoginSuccess(ctx.username, req.headers.get("x-forwarded-for"));
    await setSessionCookie({ id: user.id, name: user.name, username: user.username, role: ctx.role, sessionEpoch: user.sessionEpoch });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
