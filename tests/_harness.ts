/** Shared plumbing for the end-to-end suites: a cookie-jarred client and a counter. */
import { assertTestServer } from "./_guard";

export const BASE = process.env.BASE ?? "http://localhost:3111";
assertTestServer(BASE);
const jars: Record<string, string> = {};

export type Res = { status: number; body: any; location?: string | null };

export async function call(
  who: string | null,
  method: string,
  path: string,
  body?: any,
  extra: Record<string, string> = {}
): Promise<Res> {
  const headers: Record<string, string> = { "content-type": "application/json", ...extra };
  if (who && jars[who]) headers.cookie = jars[who];
  const r = await fetch(BASE + path, {
    method,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(45_000),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = r.headers.get("set-cookie");
  if (who && set) {
    const m = /united_session=([^;]*)/.exec(set);
    if (m) jars[who] = m[0] === "united_session=" ? "" : `united_session=${m[1]}`;
  }
  const t = await r.text();
  let parsed: any = t;
  try { parsed = JSON.parse(t); } catch {}
  return { status: r.status, body: parsed, location: r.headers.get("location") };
}

export async function page(who: string | null, path: string) {
  const headers: Record<string, string> = {};
  if (who && jars[who]) headers.cookie = jars[who];
  const r = await fetch(BASE + path, { headers, redirect: "manual", signal: AbortSignal.timeout(45_000) });
  return { status: r.status, location: r.headers.get("location"), html: await r.text() };
}

export const cookieFor = (who: string) => jars[who];
export const login = (u: string, p = "1234") => call(u, "POST", "/api/auth/login", { username: u, password: p });

export function makeChecker() {
  const failures: string[] = [];
  let pass = 0;
  const check = (name: string, cond: boolean, detail?: unknown) => {
    if (cond) pass++;
    else {
      failures.push(name);
      console.log(`  FAIL  ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 300) : "");
    }
  };
  const section = (s: string) => console.log(`\n=== ${s} ===`);
  const finish = (suite: string) => {
    console.log(`\n======== ${suite}: ${pass} passed, ${failures.length} failed ========`);
    if (failures.length) console.log("FAILURES:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(failures.length ? 1 : 0);
  };
  return { check, section, finish };
}
