import { NextRequest } from "next/server";
import { requirePermission, type AuthContext } from "@/lib/authz";
import type { Permission } from "@/lib/permissions";
import type { Role } from "@/lib/types";

/**
 * Who is acting, as every service below the order module receives it. Carries the
 * resolved effective permissions, so a service enforces the same rule whichever
 * route (or script, or integration) reached it.
 */
export type ServiceActor = {
  id: string | null;
  name: string;
  role: Role;
  deviceId?: string;
  permissions: readonly string[];
};

export function serviceActorFromContext(ctx: AuthContext): ServiceActor {
  return {
    id: ctx.id,
    name: ctx.name,
    role: ctx.role,
    deviceId: ctx.deviceId,
    permissions: [...ctx.permissions],
  };
}

/** Actor for an endpoint, gated on the permission(s) that endpoint needs. */
export async function requireServiceActor(
  req: NextRequest,
  permission: Permission | Permission[]
): Promise<ServiceActor> {
  return serviceActorFromContext(await requirePermission(req, permission));
}
