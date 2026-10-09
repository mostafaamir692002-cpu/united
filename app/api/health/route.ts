import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Liveness/readiness probe for whatever keeps this long-lived Node server up
 * (a process supervisor, a reverse proxy's upstream check, an uptime monitor).
 *
 * No auth: a health check has to work before anyone can sign in, and it leaks
 * nothing sensitive. Deliberately a single trivial query rather than anything
 * heavier — the session pooler this app uses has a strict, small connection
 * budget (see .env), so a probe hit every few seconds must not compete with it.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[health] database check failed", err);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
