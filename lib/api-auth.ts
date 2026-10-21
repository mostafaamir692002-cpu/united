import { NextRequest } from "next/server";
import { requirePermission, type AuthContext } from "@/lib/authz";
import type { Permission } from "@/lib/permissions";
import type { Actor } from "@/lib/orders-service";
import { integrationCaller, requireScope } from "@/lib/integrations/service";

/**
 * Bridges the request-level auth context into the Actor the order service already
 * takes. The actor now carries its effective permissions, so a service action
 * enforces the same rule no matter which route called it — the check can't be
 * skipped by adding a new endpoint that forgets to make it.
 */
export function actorFromContext(
  ctx: AuthContext,
  source: Actor["source"] = "user"
): Actor {
  return {
    id: ctx.id,
    name: ctx.name,
    role: ctx.role,
    source,
    deviceId: ctx.deviceId,
    permissions: [...ctx.permissions],
  };
}

/** Actor for an order endpoint, gated on the permission that endpoint needs. */
export async function requireOrderActor(
  req: NextRequest,
  permission: Permission | Permission[]
): Promise<Actor> {
  return actorFromContext(await requirePermission(req, permission));
}

/**
 * POST /api/orders: either an n8n/Hermes API key (automated creation) or a signed-in
 * user holding orders.create.
 *
 * The machine actor is given exactly one permission. It is not a role with a bundle
 * and it cannot be widened by a payload — `source` is the only thing the body
 * influences, and only between the two integration values.
 */
export async function requireOrderCreateActor(req: NextRequest): Promise<Actor> {
  const caller = await integrationCaller(req);
  if (caller) {
    requireScope(caller, "orders.create");
    // The order's source is the channel itself; the shared legacy key may still say
    // which of the two it is in the body.
    const body = caller.code === "legacy" ? await req.clone().json().catch(() => ({})) : null;
    const source: Actor["source"] = caller.code === "hermes" || body?.source === "hermes" ? "hermes" : caller.code === "n8n" || caller.code === "legacy" ? "n8n" : "system";
    return {
      id: null,
      name: caller.name,
      role: "SYSTEM",
      source,
      deviceId: req.headers.get("x-device-id") ?? undefined,
      permissions: ["orders.create"],
    };
  }
  const ctx = await requirePermission(req, "orders.create");
  return actorFromContext(ctx, "manual");
}
