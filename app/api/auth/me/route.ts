import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/authz";

/** The client's view of the session: who you are and what you may do. The permission
 * list drives navigation only — every action it leads to is checked again server-side. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: ctx.id,
      name: ctx.name,
      username: ctx.username,
      role: ctx.role,
      mustChangePassword: ctx.mustChangePassword,
      permissions: [...ctx.permissions].sort(),
    },
  });
}
