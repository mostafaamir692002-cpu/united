/* The Supabase provider's REST contract, verified against a recording fetch (the
   real service is not reachable from CI). The local provider runs for real. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { SupabaseStorageProvider } from "@/lib/core/storage/supabase";
import { LocalStorageProvider } from "@/lib/core/storage/local";

function recorder(status = 200, body: BodyInit = "{}") {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return { calls, f };
}

const cfg = { url: "https://abc.supabase.co/", serviceKey: "svc-key", bucket: "erp-attachments" };

test("upload: POST to the bucket path, service-role auth, no overwrite", async () => {
  const { calls, f } = recorder();
  await new SupabaseStorageProvider(cfg, f).put("order/o1/x y.pdf", new Uint8Array([1, 2, 3]), "application/pdf");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://abc.supabase.co/storage/v1/object/erp-attachments/order/o1/x%20y.pdf");
  assert.equal(calls[0].init.method, "POST");
  const h = calls[0].init.headers as Record<string, string>;
  assert.equal(h.Authorization, "Bearer svc-key");
  assert.equal(h.apikey, "svc-key");
  assert.equal(h["x-upsert"], "false", "never overwrite an existing object");
  assert.equal(h["Content-Type"], "application/pdf");
});

test("download uses the authenticated route (bucket stays private)", async () => {
  const { calls, f } = recorder(200, new Uint8Array([9, 8]));
  const bytes = await new SupabaseStorageProvider(cfg, f).get("order/o1/a.pdf");
  assert.equal(calls[0].url, "https://abc.supabase.co/storage/v1/object/authenticated/erp-attachments/order/o1/a.pdf");
  assert.deepEqual([...bytes], [9, 8]);
});

test("failures surface as errors; delete tolerates 404", async () => {
  await assert.rejects(new SupabaseStorageProvider(cfg, recorder(409, "exists").f).put("k", new Uint8Array([1]), "image/png"), /409/);
  await assert.rejects(new SupabaseStorageProvider(cfg, recorder(403).f).get("k"), /403/);
  await new SupabaseStorageProvider(cfg, recorder(404).f).remove("k");
});

test("local provider: round trip, never overwrites, refuses escapes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "united-store-"));
  try {
    const p = new LocalStorageProvider(dir);
    await p.put("order/o1/a.pdf", new Uint8Array([1, 2]), "application/pdf");
    assert.deepEqual([...(await p.get("order/o1/a.pdf"))], [1, 2]);
    await assert.rejects(p.put("order/o1/a.pdf", new Uint8Array([3]), "application/pdf"), "no overwrite");
    await assert.rejects(p.put("../outside.pdf", new Uint8Array([1]), "application/pdf"));
    await assert.rejects(p.get("order/../../etc/passwd"));
    await p.remove("order/o1/a.pdf");
    await assert.rejects(p.get("order/o1/a.pdf"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
