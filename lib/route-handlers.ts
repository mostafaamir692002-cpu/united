import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { requireServiceActor, type ServiceActor } from "@/lib/core/actor";
import type { Permission } from "@/lib/permissions";

/** Shared shape of the inventory write endpoints: gate, parse, run, answer. The
 * service re-checks the permission itself — this is the HTTP door, not the lock. */
export function postHandler(
  permission: Permission,
  run: (body: Record<string, unknown>, actor: ServiceActor, params: Record<string, string>) => Promise<unknown>,
  status: (result: unknown) => number = () => 201
) {
  return async (req: NextRequest, ctx: { params: Record<string, string> }) => {
    try {
      const actor = await requireServiceActor(req, permission);
      const result = await run(await readJson(req), actor, ctx.params ?? {});
      // Cost fields leave only for holders of stock.valuation.view (see redact.ts).
      return jsonFor(actor, result, { status: status(result) });
    } catch (err) {
      return handleApiError(err);
    }
  };
}

/** A replayed idempotent request answers 200 with the original document; a document
 * waiting on approval answers 202 — accepted, nothing moved yet. */
export const documentStatus = (r: unknown) => {
  const x = r as { replayed?: boolean; document?: { status?: string } };
  if (x.replayed) return 200;
  return x.document?.status === "pending_approval" ? 202 : 201;
};
