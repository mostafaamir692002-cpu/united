import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAuth } from "@/lib/authz";
import { serviceActorFromContext } from "@/lib/core/actor";
import { readAttachment } from "@/lib/core/attachments";

/**
 * Streams the file after the record-level permission check. Served as a download by
 * default; ?inline=1 is honoured only for PDFs and images, and even then inside a
 * sandbox CSP with nosniff, so nothing served from here can run script on our origin.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = serviceActorFromContext(await requireAuth(req));
    const { row, bytes, inlineSafe } = await readAttachment(params.id, actor);
    const inline = inlineSafe && new URL(req.url).searchParams.get("inline") === "1";
    const ascii = row.fileName.replace(/[^\x20-\x7e]/g, "_");
    return new NextResponse(new Blob([bytes as BlobPart]), {
      status: 200,
      headers: {
        "Content-Type": row.contentType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err, req);
  }
}
