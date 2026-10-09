/**
 * Refuses to run anything destructive outside a test environment.
 *
 * The suites create and delete real rows, and the reset wipes whole tables. They
 * were originally written against the live Supabase project, so one mistyped
 * DATABASE_URL or BASE was all that stood between a test run and a destroyed stock
 * ledger. Every suite and every reset now passes through here first.
 *
 * Two independent conditions, both required:
 *  1. An explicit acknowledgement: UNITED_TEST_DB=1. Nobody sets that by accident.
 *  2. The target looks local. A remote server or a Supabase-hosted database is refused
 *     unless UNITED_TEST_ALLOW_REMOTE=1 is also set — for a dedicated, disposable
 *     staging database, never for production.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "db", "postgres"]);

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function refuse(message: string): never {
  console.error(`\n[test-guard] REFUSING TO RUN: ${message}\n`);
  process.exit(2);
}

/** For suites that talk to a running server over HTTP. */
export function assertTestServer(base: string) {
  if (process.env.UNITED_TEST_DB !== "1") {
    refuse("set UNITED_TEST_DB=1 to confirm the server under test uses a disposable database.");
  }
  const host = hostOf(base);
  if (!host) refuse(`BASE is not a valid URL: ${base}`);
  if (!LOCAL_HOSTS.has(host) && process.env.UNITED_TEST_ALLOW_REMOTE !== "1") {
    refuse(`BASE points at "${host}", not a local server. Set UNITED_TEST_ALLOW_REMOTE=1 only for a disposable staging instance.`);
  }
}

/** For scripts that open the database directly (reset, fixtures). */
export function assertTestDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (process.env.UNITED_TEST_DB !== "1") {
    refuse("set UNITED_TEST_DB=1 to confirm DATABASE_URL is a disposable test database.");
  }
  const host = hostOf(databaseUrl);
  if (!host) refuse("DATABASE_URL is missing or not a valid URL.");
  const remote = !LOCAL_HOSTS.has(host);
  if (remote && process.env.UNITED_TEST_ALLOW_REMOTE !== "1") {
    refuse(`DATABASE_URL points at "${host}". Test scripts only run against a local database unless UNITED_TEST_ALLOW_REMOTE=1.`);
  }
  if (/supabase\.(co|com)$/.test(host) && process.env.UNITED_TEST_ALLOW_SUPABASE !== "1") {
    refuse(`DATABASE_URL is a Supabase host ("${host}"). That is where production lives — refused.`);
  }
}
