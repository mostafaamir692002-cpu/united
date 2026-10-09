import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { readJsonLimited, readLimitedBody } from "@/lib/http";

test("request body limits reject oversize streams without relying on Content-Length", async () => {
  const request = new NextRequest("http://localhost/api/admin/data-import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: new Uint8Array(11),
  });
  await assert.rejects(readLimitedBody(request, 10), (error: any) => error.status === 413);
});

test("bounded JSON import keeps valid objects and rejects malformed JSON", async () => {
  const valid = new NextRequest("http://localhost/api/admin/data-import", { method: "POST", body: JSON.stringify({ action: "preview" }) });
  assert.deepEqual(await readJsonLimited(valid, 100), { action: "preview" });
  const malformed = new NextRequest("http://localhost/api/admin/data-import", { method: "POST", body: "{" });
  await assert.rejects(readJsonLimited(malformed, 100), (error: any) => error.status === 400);
});
