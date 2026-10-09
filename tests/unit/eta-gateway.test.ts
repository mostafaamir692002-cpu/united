/* ETA transport: credentials only from the environment and never echoed; the token is
   requested with client credentials and cached; failures say whether ETA may have
   received the document (the basis of "never submit twice"). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { etaConfigStatus, loadEtaConfig, ETA_ENV_VARS } from "../../lib/eta/config";
import { EtaTransportError, externalSigner, httpGateway } from "../../lib/eta/gateway";
import type { EtaDocumentV1 } from "../../lib/eta/types";

const env = { ETA_API_BASE_URL: "https://api.example.test/", ETA_ID_SERVER_URL: "https://id.example.test", ETA_CLIENT_ID: "cid", ETA_CLIENT_SECRET: "top-secret-value", ETA_SIGNER_URL: "https://signer.example.test/sign", ETA_ENV: "preprod" };
const doc = { internalID: "INV-1" } as EtaDocumentV1;

type Call = { url: string; init: RequestInit };
function fakeFetch(handler: (c: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler({ url, init });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("configuration: missing variables are reported by name only; a missing one refuses with 503", () => {
  assert.deepEqual(etaConfigStatus({}).missing, [...ETA_ENV_VARS]);
  const s = etaConfigStatus(env);
  assert.equal(s.configured, true);
  assert.equal(JSON.stringify(s).includes("top-secret-value"), false);
  assert.throws(() => loadEtaConfig({ ...env, ETA_CLIENT_SECRET: "" }), (e: any) => e.status === 503 && !e.message.includes("cid") && e.message.includes("ETA_CLIENT_SECRET"));
  assert.equal(loadEtaConfig(env).apiBaseUrl, "https://api.example.test");
});

test("submit: client-credentials token, bearer auth, token cached, accepted documents parsed", async () => {
  const { f, calls } = fakeFetch(({ url }) =>
    url.endsWith("/connect/token") ? json(200, { access_token: "tok-1", expires_in: 3600 }) : json(202, { submissionId: "S1", acceptedDocuments: [{ uuid: "U1", longId: "L1", internalId: "INV-1", hashKey: "H" }], rejectedDocuments: [] }));
  const gw = httpGateway(loadEtaConfig(env), f);
  const r1 = await gw.submit([doc]);
  await gw.submit([doc]);
  assert.deepEqual(r1.accepted, [{ uuid: "U1", longId: "L1", internalId: "INV-1", hashKey: "H" }]);
  assert.equal(r1.submissionId, "S1");
  assert.equal(calls.filter((c) => c.url.endsWith("/connect/token")).length, 1, "token reused");
  const tokenBody = new URLSearchParams(String(calls[0].init.body));
  assert.deepEqual([tokenBody.get("grant_type"), tokenBody.get("client_id")], ["client_credentials", "cid"]);
  const submit = calls.find((c) => c.url === "https://api.example.test/api/v1/documentsubmissions")!;
  assert.equal((submit.init.headers as Record<string, string>).authorization, "Bearer tok-1");
  assert.deepEqual(JSON.parse(String(submit.init.body)), { documents: [doc] });
});

test("failures: login failure never reached ETA; a 5xx or a dropped submit may have; a 4xx is a rejection", async () => {
  const login = httpGateway(loadEtaConfig(env), fakeFetch(() => json(401, { error: "invalid_client" })).f);
  await assert.rejects(login.submit([doc]), (e: any) => e instanceof EtaTransportError && e.reachedEta === false && !JSON.stringify(e.detail).includes("top-secret-value"));

  const tok = (u: string) => u.endsWith("/connect/token");
  const s5 = httpGateway(loadEtaConfig(env), fakeFetch(({ url }) => (tok(url) ? json(200, { access_token: "t", expires_in: 60 }) : json(503, {}))).f);
  await assert.rejects(s5.submit([doc]), (e: any) => e instanceof EtaTransportError && e.reachedEta === true);

  const drop = httpGateway(loadEtaConfig(env), fakeFetch(({ url }) => { if (tok(url)) return json(200, { access_token: "t", expires_in: 60 }); throw new Error("socket hang up"); }).f);
  await assert.rejects(drop.submit([doc]), (e: any) => e instanceof EtaTransportError && e.reachedEta === true);

  const bad = httpGateway(loadEtaConfig(env), fakeFetch(({ url }) => (tok(url) ? json(200, { access_token: "t", expires_in: 60 }) : json(400, { error: { message: "bad structure" } }))).f);
  const r = await bad.submit([doc]);
  assert.deepEqual([r.accepted.length, r.rejected[0].internalId], [0, "INV-1"]);
});

test("signer: sends the document to the signing bridge and refuses an empty answer (nothing reached ETA)", async () => {
  const ok = fakeFetch(() => json(200, { signatures: [{ signatureType: "I", value: "sig" }] }));
  const signed = await externalSigner({ signerUrl: env.ETA_SIGNER_URL, signerToken: "st" }, ok.f).sign(doc);
  assert.deepEqual(signed.signatures, [{ signatureType: "I", value: "sig" }]);
  assert.equal((ok.calls[0].init.headers as Record<string, string>).authorization, "Bearer st");
  await assert.rejects(externalSigner({ signerUrl: env.ETA_SIGNER_URL, signerToken: null }, fakeFetch(() => json(200, {})).f).sign(doc), (e: any) => e.reachedEta === false);
});

test("no browser code imports the ETA configuration, gateway or service", () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) {
        const src = readFileSync(p, "utf8");
        if (/^\s*["']use client["']/.test(src) && /lib\/eta\/(config|gateway|service)/.test(src)) offenders.push(p);
      }
    }
  };
  walk("components");
  walk("app");
  assert.deepEqual(offenders, []);
});
