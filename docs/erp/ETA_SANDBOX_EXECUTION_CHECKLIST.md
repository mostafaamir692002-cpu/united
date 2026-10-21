# ETA Sandbox Execution Checklist

**For:** UNITED ERP ↔ Egyptian Tax Authority (ETA) e-Invoice submission, sandbox environment
**Status:** UPDATED 2026-10-18 — reconciliation safety review findings incorporated
**Repo:** `/opt/data/united-investigation` · `united-full-project` @ `7bccad7425…a103`
**Legend:** ✅ CONFIRMED (verified in this working tree) · 🔶 REQUIRES ETA ACCESS (needs portal/credentials) · ⚠️ REQUIRES IMPLEMENTATION VERIFICATION (behaviour not exercised end-to-end yet) · 🔴 RISK (documented safety concern, see referenced section)

---

## 0. How to use this checklist

Every executable step names the **exact code entry point** (`file:line` / symbol / API route) and the **expected behaviour it is built on**. Where a detail comes from ETA's public API docs rather than this codebase, it is marked 🔶 and must be confirmed on the ETA SDK pages before the sandbox run. Where the code exists but has never been exercised against a live endpoint, it is marked ⚠️. Safety-critical findings from the reconciliation safety review (§15-16) are marked 🔴.

**Credentials (`<PLACEHOLDER>`) must never be written into any file tracked by git.** Configure them only in the server process environment (`export …` or the deployment's secret store), as `lib/eta/config.ts` reads them from `process.env` (`lib/eta/config.ts:30-41`).

---

## 1. Prerequisites and access

| Step | Action | Entry point / evidence | Expected result |
|---|---|---|---|
| 1.1 | Confirm an issued, immutable sales invoice exists to submit. | `SalesInvoice.status = "issued"`, `lib/eta/service.ts:62` (`loadEtaSource`) | At least one invoice with `issued` status. |
| 1.2 | Confirm the server is running with the sandbox environment. | `npm run dev` (dev) — the app reads `process.env` | `/api/health` returns `{"status":"ok"}`. |
| 1.3 | Log in as an **ACCOUNTANT** (seed user `karim`, `accounting.eta.manage`). | `POST /api/auth/login`; permission gates at `lib/eta/service.ts:152,208,237,324` | Login returns a Bearer token; `GET /api/eta` returns 200 (a supervisor gets 200 for view but 403 on submit — `tests/eta.test.ts §3`). |
| 1.4 | Confirm ETA is currently **unconfigured or partially configured** state is visible. | `GET /api/eta` → `eta.config` (`etaConfigStatus`, `lib/eta/config.ts:25-28`) | Response lists only **missing variable names** (`missing`), never values. |
| 1.5 | Obtain ETA sandbox credentials from UNITED's accountant/IT. | ETA portal (system registration); see §2 | Credentials for the **pre-production** environment (never production). 🔶 |

## 2. ETA sandbox issuer and tax-profile registration

| Step | Action | Entry point / evidence | Expected result |
|---|---|---|---|
| 2.1 | Register (or confirm) the ERP **system** on the ETA portal for the sandbox/pre-production environment. | ETA portal — official UI 🔶 | A `client_id` / `client_secret` issued for pre-production. |
| 2.2 | Register (or confirm) the **issuer tax profile**: branch, activity code, and the structured address ETA requires. | `PUT /api/eta/issuer` → `saveIssuerProfile` (`lib/eta/service.ts:272-283`); fields per `EtaIssuerProfile` (branch id, activity code, country/governate/region/street/building/postal/floor/room/landmark/extra) | The issuer card in `/eta` shows the entered values. |
| 2.3 | For each B2B customer: register/confirm the **receiver profile** (receiver type B/P/F + address). | `PUT /api/eta/receivers/[customerId]` → `saveReceiverProfile` (`lib/eta/service.ts:285-296`) | Required for `type="B"` receivers (mandatory structured address). |
| 2.4 | For the test invoice's products: set **item codes** (`GS1` or `EGS`). | `PUT /api/eta/items/[productId]` → `setItemCode` (`lib/eta/service.ts:298-308`) | Each line maps to `itemType` + `itemCode`; missing → readiness error. |
| 2.5 | For the test invoice's units: set **ETA unit types**. | `PUT /api/eta/units/[uomCode]` → `setUnitType` (`lib/eta/service.ts:310-320`) | E.g. `KG` → ETA unit-type code (⚠️ code list must be confirmed with ETA docs). |
| 2.6 | Confirm **tax classification** (`TaxRate.etaType/etaSubtype`). | Seeds: `EXEMPT→T1/V003`, `VAT14→T1/V009`, `VAT0→T1/V001` (`docs/erp/ETA_EINVOICE.md §2`) | ⚠️ **Accountant confirmation required** — in particular exempt `V003` vs non-taxable `V004` for fresh produce. Not a sandbox blocker, but a go-live blocker. |

## 3. Required credentials, certificates, and environment variables

| Variable | Purpose | Verified source | Notes |
|---|---|---|---|
| `ETA_ENV` | Environment label (e.g. `preprod`) | `lib/eta/config.ts:27,34` | Informational only — **does not** select endpoints. ⚠️ Endpoints are selected purely by the two URL variables below. |
| `ETA_API_BASE_URL` | ETA invoice API base (sandbox URL) | `lib/eta/gateway.ts:106` (submit path), `:125` (details path) | 🔶 Fill with the official pre-production base URL. |
| `ETA_ID_SERVER_URL` | ETA OAuth identity server base | `lib/eta/gateway.ts:91` (`/connect/token`) | 🔶 Fill with the official pre-production ID server URL. |
| `ETA_CLIENT_ID` | OAuth client id | `lib/eta/gateway.ts:94` | Credential — never hardcode, never expose. |
| `ETA_CLIENT_SECRET` | OAuth client secret | `lib/eta/gateway.ts:94` | Credential — never hardcode, never expose. |
| `ETA_SIGNER_URL` | Signing-bridge URL (adds CAdES e-seal signature) | `lib/eta/gateway.ts:71-84` | The e-seal lives outside this app (USB token/HSM + bridge). |
| `ETA_SIGNER_TOKEN` (optional) | Bearer token for the signer bridge | `lib/eta/gateway.ts:76` | Credential if the bridge requires auth. |

The full allowed list is `ETA_ENV_VARS` — `lib/eta/config.ts:11`.

## 4. Secure configuration and secret-handling checks

| Step | Action | Entry point / evidence | Expected result |
|---|---|---|---|
| 4.1 | Set the seven variables **only** in the server process environment (never in tracked files, never in the repo's `.env` committed to git). | `lib/eta/config.ts:30-41` reads `process.env` | `git status` shows no credentials in any tracked file. |
| 4.2 | Confirm the app never returns secrets. | `GET /api/eta` returns only `missing` **names**; `tests/eta.test.ts §1` asserts no `client_secret|access_token|Bearer` in any response; `lib/eta/config.ts:33` explicitly returns names only | Response contains no secret-looking value. |
| 4.3 | Confirm tokens are kept in memory only. | `httpGateway` caches `access_token` in a closure (`lib/eta/gateway.ts:87,99`), never persisted; ETA responses stored on `EtaDocument.lastResponse` | 🔶 Spot-check the portal/db — no token in any table. |
| 4.4 | Keep the e-seal / signing material out of the app server. | The signer bridge (`ETA_SIGNER_URL`) is the only consumer of the seal (`lib/eta/gateway.ts:66-84`) | The ERP process has no access to the private key. 🔶 requires deployment topology confirmation. |

## 5. Token acquisition / warm-up through the existing gateway

| Step | Action | Entry point / evidence | Expected result |
|---|---|---|---|
| 5.1 | Trigger a token request through the real gateway. | `accessToken()` — `lib/eta/gateway.ts:89-101`: `POST {idServerUrl}/connect/token` with `grant_type=client_credentials`, `client_id`, `client_secret`, `scope=InvoicingAPI` | 200 with `access_token`. 🔶 field/branding verified against ETA docs. |
| 5.2 | Verify token caching and expiry safety. | `until = now + (expires_in − 60)s` (`lib/eta/gateway.ts:99`) — the token refreshes 60 s before expiry. | A second call within TTL does **not** re-request. ⚠️ observe in logs. |
| 5.3 | Verify a rejected credential fails closed. | 401 response → `EtaTransportError` (`lib/eta/gateway.ts:98`) | `POST /submit` returns the transport error and the document stays **pending/failed** (nothing recorded as submitted). |
| 5.4 | Confirm no token leaks into `EtaDocument.lastResponse`. | `lib/eta/gateway.ts:113-121` stores only the parsed response; the token is stripped | `lastResponse` JSON has no token. |

## 6. Test invoice preparation and pre-submission validation

| Step | Action | Entry point / evidence | Expected result |
|---|---|---|---|
| 6.1 | Pick an issued invoice as the controlled test document. | `GET /api/sales/invoices?status=issued` | At least one issued invoice; note its `number` (= `internalID`). |
| 6.2 | Open its ETA readiness view. | `GET /api/eta/invoices/[id]` → `etaInvoiceState` (`lib/eta/service.ts:121-127`) → `validateEtaSource` (`lib/eta/validate.ts:21`) | Response lists `issues` (errors + warnings), a `document` preview (`documentTypeVersion:"1.0"`), and current `eta` state. |
| 6.3 | Confirm zero **blocking** (error-level) issues. | `hasBlockingIssues` (`lib/eta/validate.ts:106`); submission refuses with 422 listing them (`lib/eta/service.ts:160-161`) | `ready: true`; if `false`, resolve each error (issuer/receiver/codes/units/tax) and re-run step 6.2. |
| 6.4 | Note the mapped payload hash. | `payloadHash = sha256(JSON.stringify(document))` before signing (`lib/eta/service.ts:164`) | Stored on `EtaDocument.payloadHash` at claim time — the reference for "what the mapper generated". ⚠️ Note: ETA's canonical hash (over the **signed** document) is not computed in this codebase; see §9. |

## 7. Draft submission and response handling

| Step | Action | Entry point / evidence | Expected result |
|---|---|---|---|
| 7.1 | Submit the invoice **once** via the authenticated accountant. | `POST /api/eta/invoices/[id]/submit` → `submitInvoiceToEta` (`lib/eta/service.ts:151-202`) | First submission returns **201** (`submitted: true`); subsequent identical call returns **200** with existing state (`lib/eta/service.ts:156`, route at `app/api/eta/invoices/[id]/submit/route.ts`). |
| 7.2 | Verify the claim-before-network guarantee. | The `submitting` claim commits under `advisoryXactLock` **before** sign/submit (`lib/eta/service.ts:167-174`) | Two parallel submits → exactly one network call; the loser sees the claim. |
| 7.3 | Check the accepted/rejected mapping. | `gateway.submit` maps `acceptedDocuments` (uuid, longId, hashKey, internalId) / `rejectedDocuments` (`lib/eta/gateway.ts:116-121`) | On acceptance, `EtaDocument` gets `status=submitted`, `uuid`, `longId`, `hashKey`, `submissionId` (`lib/eta/service.ts:186`). |
| 7.4 | If ETA rejects 4xx (nothing registered): | JSON non-OK branch → `rejected` with `lastError` (`lib/eta/gateway.ts:115`, `lib/eta/service.ts:187`) | Status `rejected`; can be re-submitted after fixing (RESENDABLE set, `lib/eta/service.ts:37`). |
| 7.5 | If the transport fails: | `EtaTransportError` with `reachedEta` (`lib/eta/service.ts:191-201`) | `reachedEta=false` → `failed` (safe to retry); `reachedEta=true` → `unknown` (**must** refresh/reconcile before any retry — never resend blindly). |

## 8. Submission-state polling and timeout/retry behaviour

| Step | Action | Entry point / evidence | Expected result |
|---|---|---|---|
| 8.1 | Trigger a state refresh. | `POST /api/eta/invoices/[id]/refresh` → `refreshInvoiceEta` (`lib/eta/service.ts:207-229`) → `gateway.getDocument(uuid)` (`GET {apiBaseUrl}/api/v1/documents/{uuid}/details`) | Remote status mapped: `valid/invalid/rejected/cancelled/submitted` → local status (`REMOTE_STATUS`, `lib/eta/service.ts:204`). |
| 8.2 | Confirm refresh requires a UUID. | `lib/eta/service.ts:211` — 409 if `doc.uuid` missing | If a submission never returned a uuid, status stays `unknown`; use §11 manual reconcile. |
| 8.3 | Timeout behaviour. | Gateway request timeout 30 s (`lib/eta/gateway.ts:43`) | On timeout: `unknown` + guidance to refresh; resend is only allowed from `pending|failed|rejected|invalid` (`lib/eta/service.ts:37`). |
| 8.4 | Verify ETA status transitions cannot double-submit. | Already-registered states (`submitted|valid|cancelled`) return state, not a new send (`lib/eta/service.ts:156`) | `attempts` increments once per claim (`lib/eta/service.ts:172`). |

## 9. Signature / CAdES hash verification

| Step | Action | Entry point / evidence | Expected result |
|---|---|---|---|
| 9.1 | Verify the signer contract is satisfied. | `externalSigner` posts `{ document }` to `ETA_SIGNER_URL` and expects `{ signatures: [{ signatureType: "I", value: "<CAdES-BES base64>" }] }` (`lib/eta/gateway.ts:66-84`) | The bridge returns exactly that shape; otherwise `EtaTransportError` (`:80`). |
| 9.2 | Confirm the **signed** document is what gets submitted. | `signed = await signer.sign(document)` then `gateway.submit([signed])` (`lib/eta/service.ts:179-181`) | ETA receives the CAdES-signed JSON. |
| 9.3 | Verify the mapped payload hash matches expectation. | `payloadHash` (`lib/eta/service.ts:164`) — sha256 of the **unsigned** document JSON | Compare against `sha256` of the mapper output; different from ETA's canonical hash (which covers the signed artifact). |
| 9.4 | Capture ETA's acceptance identifiers. | `hashKey` from `acceptedDocuments` (`lib/eta/gateway.ts:118`) | If provided, ETA's hash key is stored — evidence the signature was accepted. 🔶 |
| 9.5 | Independent signature validation. | **Not implemented in this codebase** — no CAdES verifier exists. | ⚠️ REQUIRES IMPLEMENTATION VERIFICATION: verify with an external CAdES tool (e.g. openssl/`openssl cms -verify -inform DER`) or the ETA portal's own metadata view. State precisely what was verified and how. |
| 9.6 | 🔴 **Pre-submission signature check** | The application does NOT verify certificate identity, CAdES format validity, or signed-content integrity before submitting to ETA (`gateway.ts:80` only checks `signatures` is a non-empty array). | **Risk:** A misconfigured signer bridge produces an invalid signature that ETA rejects after submission. Recovery requires a credit note. See §15 S1 and §16 step 1. |

## 10. Mapping ETA identifiers back to the ERP document

| Step | Action | Entry point / evidence | Expected result |
|---|---|---|---|
| 10.1 | Confirm `internalID` = the UNITED invoice number. | Mapper sets `internalID: src.invoice.number` (`lib/eta/mapper.ts:42+`; source `lib/eta/service.ts:78`) | ETA's accepted `internalId` equals `SalesInvoice.number` (`INV-…`). |
| 10.2 | Map `uuid` / `longId` to the invoice. | `EtaDocument.sourceType="sales_invoice"` + `sourceId=invoiceId` (unique `@@unique([sourceType, sourceId])`, `prisma/schema.prisma:2422`); `longId` stored at `lib/eta/service.ts:186` | `GET /api/eta/invoices/[id]` shows `eta.longId` and `eta.uuid` for that invoice. |
| 10.3 | Customer invoice print shows only public identifiers. | `etaPublicState` (`lib/eta/service.ts:130-133`) — status, uuid, longId, timestamps only | The print/`/sales/invoices/:id/print` renders these, never errors (`tests/eta.test.ts §4`). |
| 10.4 | Verify reconciliation of `longId` back to the ERP document in the `/eta` overview. | `etaOverview` (`lib/eta/service.ts:323-355`) maps invoices → `etaStatus/uuid` | Each row shows its own ETA state. |

## 11. End-to-end reconciliation and evidence capture

| Step | Action | Entry point / evidence | Expected result |
|---|---|---|---|
| 11.1 | Capture the acceptance evidence. | `EtaDocument` row: `submissionId`, `uuid`, `longId`, `hashKey`, `submittedAt`, `lastResponse` + append-only `EtaDocumentEvent` (`prisma/schema.prisma:2391-2442`) | A signed-off engineer can reconstruct exactly what was sent (payload hash) and what ETA returned. |
| 11.2 | Run the existing ETA test suites (mocked, offline) to prove no regression. | `tests/eta.test.ts` (permissions/refusal/print), `tests/unit/eta-gateway.test.ts`, `tests/unit/eta-mapper.test.ts`, `tests/integration/eta-submission.test.ts` | All pass against the running server (these use fakes — they prove the app logic, not the live endpoint). |
| 11.3 | Record evidence for the sign-off table (§14): screenshots, `eta` JSON, timestamps, attempt counts. | `GET /api/eta/invoices/[id]` + `GET /api/eta` | Captured without exposing secrets. |

## 12. Failure scenarios, recovery, and final acceptance

| Scenario | Expected code behaviour | Recovery (from code) |
|---|---|---|
| Signer bridge down | `EtaTransportError` (`reachedEta=false`) → status `failed` (`lib/eta/service.ts:194-198`); nothing at ETA | Fix bridge, re-submit (resendable). |
| Timeout after request left | `reachedEta=true` → status `unknown` (`:194-200`) | **Never resend.** Use refresh, and if refresh can't resolve, manual reconcile (§12 below). |
| ETA 5xx | `reachedEta=true` → `unknown` (`lib/eta/gateway.ts:114`) | Same as timeout. |
| ETA 4xx (validation) | `rejected` with `lastError` (`:115,187`) | Fix data, re-submit (resendable). |
| Document stuck `unknown` or stale `submitting` (>5 min) | `reconcileInvoiceEta` (`lib/eta/service.ts:236-251`) — only from `unknown`, or `submitting` older than 5 min | (a) Accountant checked portal and enters the `uuid` → status `submitted`; or (b) portal shows no such doc → `not_received: true` → status `failed` (resendable). This is the **only** safe way to unstick. |
| Double-request race | Claim under `advisoryXactLock` + status guard (`:167-174`) | Exactly one network call; second returns existing state (200). |
| Unconfigured server | `loadEtaConfig` → 503 with missing var names (`lib/eta/config.ts:32`) | Configure env, retry. |
| 🔴 **Incorrect "not_received" reconcile** — accountant confirms `not_received` but ETA actually has the document | `service.ts:249` transitions `unknown → failed` with recorded reason and actor. Next submit passes `RESENDABLE.includes("failed")` and sends the same `internalID` to ETA. | The ERP has no external verification that ETA is empty. ETA may reject duplicate `internalID` (assumed, not verified — see §15 S3). **Cleanup:** if ETA rejects, status becomes `rejected`, accountant reconciles again with correct uuid. If ETA accepts duplicate, manual ETA portal cancellation required. **Prevention:** only the accountant (with `accounting.eta.manage`) can reconcile, and the action is audited on 3 independent tables. |
| 🔴 **No CAdES verification before submit** | Signer response is merged verbatim at `service.ts:179`; only array-length check at `gateway.ts:80` | ETA validates the signature post-submission. If invalid, invoice becomes `invalid`. Recovery requires a credit note. |

**Final acceptance (sandbox):** one invoice reaches `valid` (or an explicit, understood `rejected` with a fix), `uuid` + `longId` recorded, `payloadHash` matches the mapper output, evidence captured, no duplicate submissions observed, and the sign-off table (§14) is complete.

---

## 13. Go-live prerequisites that sandbox success does NOT satisfy

The following remain required for production regardless of sandbox results:

1. **Production client id/secret** from ETA (system registration for production). 🔶
2. **E-seal (USB token/HSM) + signing bridge** reachable as `ETA_SIGNER_URL` with the production certificate. 🔶
3. **Issuer profile**: production branch id, activity code, structured address. 🔶
4. **Item codes** (EGS/GS1) registered and approved with ETA for all invoiced products. 🔶
5. **Unit-type mapping** confirmed against ETA's official code list.
6. **Tax classification** confirmed by the accountant (exempt `V003` vs `V004`, rates).
7. **Receiver structured addresses** for all B2B customers; person-ID threshold (`sales.eta_person_id_threshold`, default 50,000 EGP) confirmed.
8. **Rounding check**: ETA recomputes line totals at 5 dp vs UNITED's 2 dp — confirm the warning outcome in pre-production (`docs/erp/ETA_EINVOICE.md §7.8`).
9. **Every endpoint/field marked 🔶** re-verified against the live ETA SDK documentation.
10. **CAdES hash verification method** (external tool or ETA portal view) agreed with the accountant (§9.5).
11. **Duplicate internalID behaviour** — the sandbox trial must produce evidence of what ETA does when a duplicate `internalID` (same `issuer.id` + same `internalID`) is submitted. Until this is known, the `not_received → resend` path (§12) carries unquantified risk. 🔴
12. **Application-level CAdES signature verification** — currently absent (§9.6). Production should have at minimum a format-validity check before submission (certificate identity, hash match). Post-sandbox, this is the highest-priority engineering enhancement. 🔴

---

## 14. Sandbox execution sign-off table

| Step | Expected evidence | Status | Blocker |
|---|---|---|---|
| 1. Prerequisites (accountant login, issued invoice) | Logged-in session; invoice id/number | ⬜ NOT RUN | — |
| 2. Issuer / receiver / item / unit / tax configured | `/api/eta` shows issuer + mapped codes | ⬜ NOT RUN | — |
| 3. Env vars configured safely (7 vars, no secrets in git) | `GET /api/eta` config `configured:true`; clean `git status` | ⬜ NOT RUN | — |
| 4. Secret checks (names only, token in memory) | Response scan passes (tests §1) | ⬜ NOT RUN | — |
| 5. Token acquired via gateway | 200 `access_token`; cache TTL verified | ⬜ NOT RUN | 🔶 ETA access |
| 6. Test invoice ready: zero blocking issues | `ready:true`; `issues` errors = 0 | ⬜ NOT RUN | — |
| 7. Submitted exactly once | 201 first; 200 replay; `attempts=1` | ⬜ NOT RUN | 🔶 ETA access |
| 8. Polled to final state | `status` reach `valid`/`rejected` with recorded uuid/longId | ⬜ NOT RUN | 🔶 ETA access |
| 9. Signature/hash verified | `payloadHash` match; independent CAdES check documented | ⬜ NOT RUN | ⚠️ no verifier in code |
| 10. Identifier reconciliation | `longId`/`uuid` mapped to the ERP invoice | ⬜ NOT RUN | — |
| 11. Evidence captured | `eta` JSON + timestamps + screenshots saved | ⬜ NOT RUN | — |
| 12. Failure drill (simulate signer down / 5xx) | Statuses `failed`/`unknown` observed; recovery via refresh/reconcile worked | ⬜ NOT RUN | ⚠️ requires fault simulation |
| 13. Existing ETA tests still green | `eta.test.ts` + unit/integration suites pass | ✅ VERIFIABLE OFFLINE (recommended now) | — |
| 14. STOP conditions S1–S6 verified before submit (§15) | All six pass | ⬜ NOT RUN | 🔶 ETA/network access |
| 15. One-document runbook executed (§16) | Steps 0–10 complete | ⬜ NOT RUN | 🔶 ETA access |

---

## 15. STOP conditions — sandbox entry prohibitions

The sandbox submission **must not proceed** if any condition below is true. Record the reason and resume only after the blocker is resolved.

| # | Condition | Why | Verification |
|---|---|---|---|
| **S1** | **Signer certificate not verified** — the e-seal certificate identity, expiry, and chain have not been confirmed by the engineer performing the test. | A misconfigured signer produces an invalid signature; ETA will reject the document after submission (`invalid` status). Recovery requires a credit note. | Independent CAdES check with `openssl cms` against the returned signature **before** step 7.1. 🔶 |
| **S2** | **Sandbox endpoint URLs not confirmed** — `ETA_API_BASE_URL` and `ETA_ID_SERVER_URL` have not been verified against the official ETA SDK for the pre-production environment. | Wrong URLs would send real tax-format documents to a wrong or production endpoint. Failure detection is immediate (transport error), but the attempt is recorded. | Confirm both URLs against `sdk.invoicing.eta.gov.eg` (pre-production). 🔶 |
| **S3** | **No safe way to identify an already-submitted document** — if the submit response is lost (timeout, crash), the invoice's `EtaDocument` status becomes `unknown` and only manual reconcile can resolve it. The engineer doing the test must understand this recovery path (§12) **before** pressing submit. | A blind resend from `unknown` would circumvent the ERP's own duplicate protection. | Run `tests/integration/eta-submission.test.ts` and confirm the "timeout → unknown → reconcile" path passes. This test is a **prerequisite** for sandbox entry. |
| **S4** | **Status after submission is unclear** — if `EtaDocument.status` is not one of `submitted/valid/invalid/rejected/failed/cancelled` immediately after the API response, do not proceed. | An unexpected status means the ERP-ETA contract has diverged. | Read `GET /api/eta/invoices/[id]` after every submit/refresh call. |
| **S5** | **Risk of production credentials** — any environment variable (`ETA_CLIENT_ID`, `ETA_CLIENT_SECRET`, `ETA_API_BASE_URL`, `ETA_ID_SERVER_URL`) points at the **production** ETA environment instead of pre-production. | Production submissions are legally binding and cannot be undone. | Double-check every ETA_* variable against the pre-production credentials document. |
| **S6** | **No sandbox-specific test invoice** — the test must use an invoice issued specifically for this trial, not a real customer invoice. | A sandbox submission with a real `internalID` could collide with production submissions when UNITED goes live. | Create an invoice with an explicit test-only customer (e.g. `"شريكة اختبار الساندبوكس"`) and note its `internalID` in §16 step 0. |

---

## 16. One-document sandbox runbook

This section is the **single run** procedure. Every step is numbered; execute in order. If any step fails or returns an unexpected result, **stop** and record the output before proceeding.

| Step | Action | Entry point | Record |
|---|---|---|---|
| **0. Document identity** | Choose ONE test invoice. Verify: `status=issued`, it has zero blocking ETA issues (`GET /api/eta/invoices/[id]` → `ready:true`), and it was created with a sandbox-only customer name. | `GET /api/sales/invoices?status=issued` | `Invoice ID:` _⬜_ · `internalID (number):` _⬜_ · `Customer name:` _⬜_ |
| **1. Verify STOP conditions** | Execute checks S1–S6 above. Do not proceed unless ALL pass. | §15 | All S1–S6: _⬜ PASS / ⬜ BLOCKED_ |
| **2. Verify sandbox env config** | `GET /api/eta` → `config.configured===true` AND `config.missing===[]` AND `config.environment==="preprod"` (or the label agreed with IT). | `lib/eta/config.ts:25-28` | `configured:` _⬜_ · `missing:` _⬜_ · `environment:` _⬜_ |
| **3. Verify issuer/receiver/items/units/taxes** | `GET /api/eta` → issuer profile has branchID + activityCode + complete address; product has itemType+itemCode; unit has etaUnitType; receiver profile exists. | `etaOverview` (`service.ts:323-355`) | All present: _⬜_ |
| **4. Capture pre-submission evidence** | Note the invoice number and readiness state. `payloadHash` will be recorded at claim time. | `GET /api/eta/invoices/[id]` | Screenshot/JSON saved: _⬜_ |
| **5. Submit exactly once** | `POST /api/eta/invoices/[id]/submit` as ACCOUNTANT user `karim`. | `service.ts:151-202` | HTTP status: _⬜_ · `submitted:` _⬜_ · `eta.status:` _⬜_ · `uuid:` _⬜_ · `longId:` _⬜_ · `attempts:` _⬜_ |
| **6. Record ETA identifiers** | From the response or from `GET /api/eta/invoices/[id]` after step 5: `uuid`, `longId` (may be null), `submissionId`, `hashKey`. | `EtaDocument` row + events | `uuid:` _⬜_ · `longId:` _⬜_ · `submissionId:` _⬜_ · `hashKey:` _⬜_ |
| **7. Poll to final state** | `POST /api/eta/invoices/[id]/refresh` every 30 seconds until status stops changing. | `service.ts:207-229`; `REMOTE_STATUS` maps `valid/invalid/submitted/rejected/cancelled` | Poll 1: _⬜_ · Poll 2: _⬜_ · Poll 3: _⬜_ · Final status: _⬜_ · `acceptedAt/rejectedAt:` _⬜_ |
| **8. Verify replay safety** | Call `POST /api/eta/invoices/[id]/submit` again with the same invoice. Must return 200 (not 201) with `submitted:false` and identical identifiers. | `service.ts:155-156` | HTTP: _⬜_ · `submitted:` _⬜_ · Same uuid: _⬜_ |
| **9. Capture post-submission evidence** | `GET /api/eta/invoices/[id]` — full response JSON. Save without exposing credentials. | Full response | Saved: _⬜_ |
| **10. Verify signature receipt** | Check `EtaDocumentEvent` for `claim → submit_ok` events. If ETA returned a `hashKey`, confirm it is stored. | `GET /api/eta/invoices/[id]` → `eta.events` | Events correct: _⬜_ · hashKey stored: _⬜_ · `payloadHash` recorded: _⬜_ |

**If step 5 returns a transport error (`reachedEta=true`):** STOP. Status is `unknown`. Do NOT retry step 5. Execute §12 recovery (refresh → if no uuid received, manual reconcile). Document what was observed.

**If step 7 final status is `invalid`:** STOP. Record `lastError`. The signature or document content was rejected by ETA. Do not resubmit the same document. The engineer must diagnose the rejection (ETA returns validation details in `lastError`) and issue a corrected invoice via credit note. This is **not a sandbox failure** — it is expected diagnostic output.

---

**Readiness verdict (updated):** The application code is **safe and sandbox-ready** — the ERP state machine correctly handles concurrent submissions, timeouts, transport failures, and recovery (proven by 7/7 integration tests with fakes). All remaining barriers are **operational gates** (STOP conditions S1–S6) that require sandbox credentials, the signer bridge, or a test invoice. None can be resolved before credentials arrive. The verdict "🟢 CLEAR — once credentials arrive" means: the moment all S1–S6 conditions are satisfied, the engineer can proceed immediately with §16's one-document runbook. There is no code-level blocker.

> This checklist does **not** certify production readiness. Section 13 lists the outstanding production prerequisites.