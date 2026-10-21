/* Session isolation — independent Bearer-token sessions across simulated
   browser tabs. Tests that two users can authenticate independently via
   Bearer tokens, make concurrent API calls, and that logging out one does
   NOT affect the other.

   Each "tab" is a separate caller identity in the test harness that holds
   its own Bearer token (mimicking sessionStorage). */
import { call, login, makeChecker } from "./_harness";

const { check, section, finish } = makeChecker();
const TAG = `ZZSESS${Date.now() % 1_000_000}`;
let r: any;

async function main() {
  // Use the seed users: ahmed (PREPARER) and mostafa (LOADER)
  // They exist in every seed database with password "1234".

  // -----------------------------------------------------------------------
  section("1. TAB A LOGIN (Bearer token)");
  const rA = await call("tabA", "POST", "/api/auth/login", { username: "ahmed", password: "1234" });
  check("tabA login 200", rA.status === 200, rA.status);
  check("tabA token in response", typeof rA.body?.token === "string" && rA.body.token.length > 20, { hasToken: !!rA.body?.token, len: rA.body?.token?.length });

  // Tab A makes a request — verify identity via Bearer token
  r = await call("tabA", "GET", "/api/auth/me");
  check("tabA /auth/me shows ahmed (PREPARER)", r.body?.user?.username === "ahmed" && r.body?.user?.role === "PREPARER", { user: r.body?.user?.username, role: r.body?.user?.role });

  // -----------------------------------------------------------------------
  section("2. TAB B LOGIN (different user, same browser context)");
  const rB = await call("tabB", "POST", "/api/auth/login", { username: "mostafa", password: "1234" });
  check("tabB login 200", rB.status === 200, rB.status);
  check("tabB token in response", typeof rB.body?.token === "string", { hasToken: !!rB.body?.token });

  r = await call("tabB", "GET", "/api/auth/me");
  check("tabB /auth/me shows mostafa (LOADER)", r.body?.user?.username === "mostafa" && r.body?.user?.role === "LOADER", { user: r.body?.user?.username, role: r.body?.user?.role });

  // -----------------------------------------------------------------------
  section("3. CONCURRENT — each tab retains its own identity");
  const [meA, meB] = await Promise.all([
    call("tabA", "GET", "/api/auth/me"),
    call("tabB", "GET", "/api/auth/me"),
  ]);
  check("tabA still ahmed", meA.body?.user?.username === "ahmed" && meA.body?.user?.role === "PREPARER", meA.body?.user);
  check("tabB still mostafa", meB.body?.user?.username === "mostafa" && meB.body?.user?.role === "LOADER", meB.body?.user);
  check("tabs are different users", meA.body?.user?.id !== meB.body?.user?.id, { a: meA.body?.user?.id?.slice(0,8), b: meB.body?.user?.id?.slice(0,8) });

  // -----------------------------------------------------------------------
  section("4. AUTHORIZATION — each tab acts as its own role");
  // PREPARER cannot create suppliers
  r = await call("tabA", "POST", "/api/stock/suppliers", { name: `${TAG} Supplier` });
  check("tabA (PREPARER) denied creating supplier -> 403", r.status === 403, r.status);
  // LOADER cannot create suppliers either
  r = await call("tabB", "POST", "/api/stock/suppliers", { name: `${TAG} Supplier2` });
  check("tabB (LOADER) denied creating supplier -> 403", r.status === 403, r.status);

  // -----------------------------------------------------------------------
  section("5. TAB A LOGOUT — tab B unaffected");
  r = await call("tabA", "POST", "/api/auth/logout");
  check("tabA logout 200", r.status === 200, r.status);
  // Tab B should still work after Tab A logs out
  r = await call("tabB", "GET", "/api/auth/me");
  check("tabB still works after tabA logout", r.body?.user?.username === "mostafa", r.body?.user?.username);
  check("tabB role unchanged", r.body?.user?.role === "LOADER", r.body?.user?.role);

  // -----------------------------------------------------------------------
  section("6. EXPIRED / FORGED TOKEN REJECTED");
  r = await call(null, "GET", "/api/auth/me", undefined, { authorization: "Bearer forged-token-that-is-definitely-not-valid" });
  check("forged token -> null user (401 shown client-side)", r.body?.user === null, r.body?.user === null);

  r = await call(null, "GET", "/api/auth/me", undefined, { authorization: "" });
  check("empty auth header -> null user", r.body?.user === null, r.body?.user === null);

  // -----------------------------------------------------------------------
  section("7. NO HEADER → COOKIE FALLBACK (backward compat)");
  // Without an Authorization header, the cookie path should still work.
  // Re-login admin to get a fresh cookie, then call without Bearer.
  const admin2 = await call("admin", "POST", "/api/auth/login", { username: "admin", password: "1234" });
  check("admin re-login 200", admin2.status === 200, admin2.status);
  r = await call("admin", "GET", "/api/auth/me");
  check("cookie fallback: admin is SUPER_ADMIN", r.body?.user?.role === "SUPER_ADMIN", r.body?.user?.role);

  // -----------------------------------------------------------------------
  section("8. REGRESSION: auth/me returns correct shape");
  r = await call("admin", "GET", "/api/auth/me");
  const u = r.body?.user;
  check("user has id", typeof u?.id === "string", u?.id);
  check("user has name", typeof u?.name === "string", u?.name);
  check("user has permissions array", Array.isArray(u?.permissions), u?.permissions);
  check("user has role string", typeof u?.role === "string", u?.role);

  finish("SESSION-ISOLATION");
}
main().catch((e) => { console.error("SUITE CRASHED", e); process.exit(2); });