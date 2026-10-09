import type { StorageProvider } from "./types";

/**
 * Supabase Storage over its REST API (no SDK — three calls do not justify a
 * dependency). Uses the service-role key, so it must only ever run server-side, and
 * the bucket should be PRIVATE: every download goes through the app's own
 * permission check, never through a public URL.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase" as const;

  constructor(
    private readonly cfg: { url: string; serviceKey: string; bucket: string },
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  private objectUrl(key: string, mode: "write" | "read") {
    const path = key.split("/").map(encodeURIComponent).join("/");
    const base = this.cfg.url.replace(/\/+$/, "");
    const bucket = encodeURIComponent(this.cfg.bucket);
    return mode === "read"
      ? `${base}/storage/v1/object/authenticated/${bucket}/${path}`
      : `${base}/storage/v1/object/${bucket}/${path}`;
  }

  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.cfg.serviceKey}`, apikey: this.cfg.serviceKey, ...extra };
  }

  async put(key: string, bytes: Uint8Array, contentType: string) {
    const res = await this.fetchImpl(this.objectUrl(key, "write"), {
      method: "POST",
      headers: this.headers({ "Content-Type": contentType, "x-upsert": "false", "Cache-Control": "private, max-age=0" }),
      body: new Blob([bytes as BlobPart], { type: contentType }),
    });
    if (!res.ok) throw new Error(`Supabase Storage upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }

  async get(key: string) {
    const res = await this.fetchImpl(this.objectUrl(key, "read"), { headers: this.headers() });
    if (!res.ok) throw new Error(`Supabase Storage download failed (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async remove(key: string) {
    const res = await this.fetchImpl(this.objectUrl(key, "write"), { method: "DELETE", headers: this.headers() });
    if (!res.ok && res.status !== 404) throw new Error(`Supabase Storage delete failed (${res.status})`);
  }
}
