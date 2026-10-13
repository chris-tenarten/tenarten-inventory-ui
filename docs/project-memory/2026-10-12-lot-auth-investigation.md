# Production LoT authentication investigation — Product review required

Read-only hosted inspection on 2026-10-12. Tier 3 / focused Testing Level 3 boundary investigation. No hosted business writes, migrations, commits, pushes or deployments.

## Confirmed defect

Supabase project `vxdxjhazkqhpkwdqtobp`, `generate-job-transmittal-pdf`, ACTIVE v12, `verify_jwt: true`, updated_at `1791223573610`. Source downloaded with Supabase CLI into `/private/tmp/tenops-lot-auth-inspection`. Its main handler is byte-identical to the current repository handler. Its bundled `_shared/rbac.ts` is byte-identical to repository version immediately before `c8602494897f05e813c117ccd47a678083cdd98f` (SHA-256 `db5f2ae0130033c37d7050b67faae0594a48f0258df378ecbbc7773a5cb911d1`).

The deployed guard sets lowercase `authorization` in global headers; SDK `auth.getUser(token)` adds uppercase `Authorization`. HTTP Headers combines these into a comma-separated value. The real installed SDK with disposable HTTP fixtures reproduces valid-user rejection at Auth, before `has_app_capability` or PDF generation claim. Existing correction c860249 uses uppercase `Authorization`, preserving one bearer header. No permission expansion is needed. This correction already exists locally and in the cached origin/main ancestry, but is missing from the deployed LoT bundle.

## Request and persistence boundary

`src/modules/transmittals/mutations.ts` uses the shared Supabase client and `functions.invoke`; SDK supplies the session bearer token. Shared client enables persistent sessions and automatic refresh. No LoT-specific manual header or refresh override exists. RPC `issue_job_transmittal` runs first, followed by Edge action `generate`, then action `preview` for signed download. Draft preview invokes the Edge directly and creates no capture.

The Edge checks `issueTransmittal` for generate, `previewOperationalDocuments` otherwise. Existing role defaults grant issuance to Lead/Admin; read-only accounts cannot issue. The hosted malformed header affects all otherwise-valid callers, including preview callers, before role authorization. Anthony's actual role and session were not inspected.

If Anthony reached Edge generation via the normal issue flow, the immutable capture was already created. The failure precedes `claim_job_transmittal_pdf_generation`, rendering, Storage upload and signing. Anthony's particular record and status are **not verified**. Existing retry uses the same record ID; issuance guard prevents issuing another number within the same panel. Do not create a replacement record as a workaround.

## Limits on incident attribution

Chris subsequently supplied a screenshot showing the literal error “Authentication required.” in the LoT panel. This corrects the initial paraphrase “Failure to authenticate” and matches the downloaded shared guard's 401 error exactly. The screenshot shows Job `26-0826`, Create view, History (0), and a provisional next number; it does not identify whether Preview PDF or Generate & Download triggered the failure. History (0) establishes only the loaded UI count, not an independently verified absence of captures. No request-correlated sanitized hosted logs or browser network response were obtained. The screenshot strengthens attribution to the Edge authentication guard, but actual session validity, gateway status and incident-specific capture existence remain unconfirmed.

Cached origin/main `4597d804608622d47ee584e2b05db4f8c36af1ea` has no LoT/client/shared-guard delta versus local main. Recent Bids/Sample changes are not demonstrated causes. The inspected LoT bundle predates those latest releases. No last-known-working hosted LoT bundle was available; repository history establishes the existing fix, not a successful historical hosted request. CLI access permitted function metadata/source inspection; no supported request-log reader was available through the inspected CLI surface.

## Focused validation

- `node scripts/verify-transmittal-auth-boundary.mjs /private/tmp/tenops-lot-auth-inspection/supabase/functions/_shared/rbac.ts`: PASS deployed valid-user defect reproduction; corrected authorized/repeated authorization success; expired/invalid/missing token rejection; insufficient capability rejection. Mock HTTP with real SDK; does not assert full session refresh or persisted retry lifecycle.
- `node scripts/verify-edge-capability-auth.mjs`: PASS existing shared authorization regression checks.
- `node scripts/verify-transmittal-pdf-overflow.mjs`: PASS local six-page PDF rendering (font-data warnings). Not full authenticated issuance/storage validation.
- `node scripts/verify-job-transmittal-linkage-semantics.mjs`: PASS.
- `node scripts/verify-job-transmittals.mjs`: FAIL existing source assertion `>Customer Name<input` against current `BusinessInput`; not an authentication failure. No test weakened.
- `git diff --check`: PASS. Application source unchanged; build/browser/full disposable database lifecycle not run. These remain release gates if a deployment candidate is authorized.

## Proposed correction and safe action

Product should review redeploying only the LoT function with the already-existing c860249 shared guard correction, retaining JWT verification and capability checks. This investigation does not authorize deployment. Existing fix SHA is c8602494897f05e813c117ccd47a678083cdd98f; no new candidate commit was created. New local work is this evidence note and the focused verifier only.

Until an approved correction, inspect the user's existing LoT history and preserve any capture. Signing in again cannot repair the confirmed deployed header defect. No confirmed generation workaround is available. After correction, retry the existing capture rather than issue another number. Before declaring the incident fully resolved, obtain a sanitized failing response/request timestamp and narrowly verify the capture metadata, then run disposable successful issuance and failure/retry lifecycle coverage.
