"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Role } from "@/lib/types";
import type { Permission } from "@/lib/permissions";

export type SessionUserDTO = {
  id: string;
  name: string;
  username: string;
  role: Role;
  mustChangePassword?: boolean;
  permissions: Permission[];
};

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<{ user: SessionUserDTO | null }>("/api/auth/me"),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Permission helper for client components. Fails closed while the session is still
 * loading, so nothing flashes into view before the server has said it may.
 *
 * This decides what is SHOWN. It never decides what is ALLOWED — every route and
 * endpoint behind these links enforces the same permission independently.
 */
export function usePermissions() {
  const { data, isLoading } = useSession();
  const permissions = data?.user?.permissions ?? [];
  return {
    isLoading,
    role: data?.user?.role,
    permissions,
    can: (permission: Permission) => permissions.includes(permission),
  };
}
