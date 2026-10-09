import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSnapshot } from "../../scripts/rbac/matrix";

/* Who may do what is reviewed, not drifted into: the code must match the committed
   snapshot exactly. A deliberate change regenerates it (npx tsx scripts/rbac/matrix.ts)
   and the diff shows reviewers every route, role and gate that moved. */
test("API gates, role bundles and page gates match docs/erp/rbac-snapshot.json", () => {
  const committed = JSON.parse(readFileSync("docs/erp/rbac-snapshot.json", "utf8"));
  const current = JSON.parse(JSON.stringify(buildSnapshot()));
  assert.deepEqual(current.permissions, committed.permissions, "permission catalogue changed");
  assert.deepEqual(current.bundles, committed.bundles, "a role bundle changed");
  assert.deepEqual(current.pages, committed.pages, "a page gate changed");
  assert.deepEqual(current.routes, committed.routes, "an API route or its gate changed");
});

test("every route's gate is readable and no handler is open by accident", () => {
  const { routes } = buildSnapshot();
  const open = routes.filter((r: { gate: { kind: string } }) => r.gate.kind === "public").map((r: { path: string }) => r.path);
  assert.deepEqual([...new Set(open)].sort(), ["/api/auth/login", "/api/auth/logout", "/api/auth/me", "/api/auth/password", "/api/health"]);
});
