/**
 * Writes docs/erp/RBAC_MATRIX.md (for people) and docs/erp/rbac-snapshot.json (for
 * tests/unit/rbac-snapshot.test.ts) from the code itself: the permission catalogue, the
 * role bundles, every API handler's gate and every page's gate.
 *
 *   npx tsx scripts/rbac/matrix.ts        regenerate both after a deliberate change
 *
 * The unit test fails when the code and the snapshot disagree, so any change to who
 * may do what — a new route, a weakened gate, a widened role — shows up as a reviewed
 * diff of the snapshot, never silently.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PERMISSION_DEFS, ROLE_PERMISSIONS, ALL_PERMISSIONS } from "../../lib/permissions";
import { ROLES, ROLE_LABEL } from "../../lib/types";
import { NAV_LINKS } from "../../lib/nav";
import { scanRoutes, allowed, type Gate } from "./route-scan";

export function buildSnapshot(root = process.cwd()) {
  const bundles = Object.fromEntries(ROLES.map((r) => [r, r === "SUPER_ADMIN" ? ["*"] : [...ROLE_PERMISSIONS[r]].sort()]));
  const routes = scanRoutes(root).map((h) => ({ method: h.method, path: h.path, gate: h.gate }));
  const pages = NAV_LINKS.map((l) => ({ href: l.href, permission: l.permission, pageOpenToAll: l.pageOpenToAll ?? false }));
  return { permissions: PERMISSION_DEFS.map((p) => p.key), bundles, routes, pages };
}

const held = (r: (typeof ROLES)[number]) => new Set<string>(r === "SUPER_ADMIN" ? ALL_PERMISSIONS : ROLE_PERMISSIONS[r]);
const gateText = (g: Gate) =>
  g.kind === "all" ? g.permissions.map((p) => `\`${p}\``).join(" + ")
  : g.kind === "any" ? `any of ${g.permissions.map((p) => `\`${p}\``).join(", ")}`
  : g.kind === "api-key-or" ? `integration key, or \`${g.permissions[0]}\``
  : g.kind === "api-key" ? `integration key with scope \`${g.scope}\` only`
  : g.kind === "authenticated" ? "signed in (checked per record in the service)"
  : g.kind === "per-field" ? "per field: role → `users.change_role`, active → `users.disable`, name/username/password → `users.edit`"
  : g.kind === "per-import-kind" ? `\`${g.basePermission}\` + per import type: ${g.permissions.map((p) => `\`${p}\``).join(", ")}`
  : "public";

function markdown(root: string) {
  const routes = scanRoutes(root);
  const head = `| | ${ROLES.map((r) => ROLE_LABEL[r]).join(" | ")} |\n|---|${ROLES.map(() => ":-:").join("|")}|`;
  const L: string[] = [];
  L.push("# RBAC matrix", "", "Generated from the code by `npx tsx scripts/rbac/matrix.ts` — do not edit by hand.", "Enforcement is verified end to end by `tests/security.test.ts` (every handler × every role that lacks its permission).", "");
  L.push("## Roles × permissions", "", `| Permission | ${ROLES.join(" | ")} |`, `|---|${ROLES.map(() => ":-:").join("|")}|`);
  for (const p of PERMISSION_DEFS) L.push(`| \`${p.key}\` — ${p.label} | ${ROLES.map((r) => (held(r).has(p.key) ? "✓" : "")).join(" | ")} |`);
  L.push("", "## Pages", "", head.replace("| |", "| Page (permission) |"));
  for (const l of NAV_LINKS) {
    const perms = Array.isArray(l.permission) ? l.permission : [l.permission];
    L.push(`| \`${l.href}\` ${l.label} (${perms.map((p) => `\`${p}\``).join(" / ")}${l.pageOpenToAll ? "; page open to all, filters itself" : ""}) | ${ROLES.map((r) => (l.pageOpenToAll || perms.some((p) => held(r).has(p)) ? "✓" : "")).join(" | ")} |`);
  }
  L.push("", "## API", "", `| Method | Path | Gate | ${ROLES.join(" | ")} |`, `|---|---|---|${ROLES.map(() => ":-:").join("|")}|`);
  for (const h of routes) {
    L.push(`| ${h.method} | \`${h.path}\` | ${gateText(h.gate)} | ${ROLES.map((r) => { const a = allowed(h.gate, held(r)); return a === null ? "·" : a ? "✓" : ""; }).join(" | ")} |`);
  }
  L.push("", "`·` = decided per field / public; see the gate column.", "");
  return L.join("\n");
}

if (require.main === module) {
  const root = process.cwd();
  writeFileSync(join(root, "docs/erp/RBAC_MATRIX.md"), markdown(root));
  writeFileSync(join(root, "docs/erp/rbac-snapshot.json"), JSON.stringify(buildSnapshot(root), null, 2) + "\n");
  console.log("wrote docs/erp/RBAC_MATRIX.md and docs/erp/rbac-snapshot.json");
}
