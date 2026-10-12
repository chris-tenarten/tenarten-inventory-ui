# LoT authentication source reconciliation and regression prevention

## Source and Production evidence

On 2026-10-12, freshly fetched `origin/main` and `origin/dev` both pointed to `4597d804608622d47ee584e2b05db4f8c36af1ea`. Both already contained hotfix commit `c8602494897f05e813c117ccd47a678083cdd98f`. The exact correction is in `supabase/functions/_shared/rbac.ts`: use `global: { headers: { Authorization: authorization } }`, matching the SDK's own casing. The old lowercase property caused SDK `auth.getUser(token)` to construct two differently cased object keys, which HTTP Headers combined into an invalid comma-separated bearer value.

Fresh read-only hosted inspection confirmed LoT ACTIVE v13 with JWT verification enabled and bundle SHA-256 `40ea701e98e43a935292e92db20cbfcba12ae019c928cbdd78f1b3a133e9c39c`. Downloaded LoT source matches the canonical source and c860249. Shared guard file SHA-256 is `578e05ce14942c0f13e4a0ce0d2c8a8935b57ddca98cc112f09ec7ba205e9dc4`. This reconciliation therefore needs **no runtime code change and no duplicate cherry-pick**. It adds only the regression, its npm command and this record, from an isolated worktree based on the common remote head.

Chris subsequently confirmed that Anthony successfully generated his Production LoT. Earlier, the agent directly verified authenticated Production draft Preview using Chris's manually signed-in Admin session for Job 26-0826: branded PDF displayed; freshly loaded history stayed zero; provisional number stayed 0826-003. That was preview-only, with no capture creation. Anthony's successful issuance is user-confirmed evidence, not an agent-run Production write.

## Focused permanent regression

Run `npm run verify:transmittal-auth`. Optional argument to the underlying script selects an isolated/downloaded `supabase/functions` directory for artifact checks:

```sh
node scripts/verify-transmittal-edge-auth.mjs /path/to/candidate/supabase/functions
```

The test executes actual `src/modules/transmittals/mutations.ts`, the installed SDK's `functions.invoke`, actual LoT Edge handler/shared guard and SDK `auth.getUser(token)`. Only upstream HTTP, token provision and persistence are disposable fixtures; the PDF renderer is real. The SDK version exercised is 2.101.1, matching the Edge import. Every unexpected HTTP route fails the fixture; no environment credentials or hosted records are used.

Verified:

- One effective bearer header at browser-to-Edge and Edge-to-Auth boundaries; lowercase, uppercase and mixed-case incoming header names work independently.
- Missing, invalid and expired credentials are rejected; inactive accounts are denied before service access. This does not test token-refresh scheduling or gateway JWT cryptography.
- Guest/Member/Developer/Lead/Admin and read-only preview remain allowed under the existing capability contract. Issuance remains Lead/Admin only; read-only issuance is denied. Capability RPC responses are fixtures based on existing source roles, not a new hosted RLS audit.
- Authorized draft Preview returns PDF bytes without persistence/storage access; saved Preview remains unavailable until generated and succeeds afterward.
- Generate honors active-claim conflicts. Storage failure then retry uses the same immutable fixture capture; retry after success reuses the stored PDF (one successful upload). No issuance RPC is present in the fixture, so accidental capture creation fails as an unexpected route.
- Snapshot contents and capture count remain unchanged across retries. Database locking/concurrency itself is not reimplemented or claimed as tested by this HTTP fixture.

Testing level: Tier 3 / focused Testing Level 3 authentication/handler boundary. PASS new regression; PASS existing `verify-edge-capability-auth.mjs`; PASS targeted ESLint and diff check. Mutation sensitivity PASS: restoring the original lowercase global header in a disposable bundle makes this regression fail at Auth. No application source, schema, calculation, frontend or branding changed; an application build and fresh Production write test are unnecessary for these test/documentation additions. Existing legacy LoT static verifier's stale raw-input assertion is not weakened or claimed as passing.

## Other document-generation paths

| Paths | Request construction and assessment |
| --- | --- |
| `src/modules/transmittals/mutations.ts` → `generate-job-transmittal-pdf` | SDK `functions.invoke`; shared `requireEdgeCapability`; deployed v13 corrected and source matched. |
| `src/modules/purchasing/mutations.ts` → `generate-purchase-order-pdf` | SDK `functions.invoke`; same shared guard; separately downloaded deployed PO bundle also contains uppercase corrected header. No equivalent defect found. |
| `src/modules/proposals/queries.ts` → `generate-proposal-pdf/index.ts` | SDK `functions.invoke`; independent Edge caller construction uses uppercase `Authorization`. No equivalent pattern found in canonical source; hosted Proposal bundle not downloaded in this pass. |
| `src/modules/samples/queries.ts`, `ProductionBatchOutput.tsx` → `generate-sample-pdf/index.ts` | SDK `functions.invoke`; independent Edge caller construction uses uppercase `Authorization`. Batch/Blend handler receives this caller. No equivalent pattern found in canonical source; hosted Sample bundle not downloaded in this pass. |
| `src/lib/server-auth.ts` | Adjacent server authorization also uses uppercase `Authorization` with explicit `getUser(token)`; no equivalent pattern found. |

Frontend generators do **not** independently build bearer headers. `src/lib/supabase.ts` and SDK `fetchWithAuth` already provide shared session-aware request infrastructure. Adding another frontend authenticated request helper solely for this defect would duplicate that infrastructure. Keep `functions.invoke` as the shared transport and avoid manual bearer overrides.

Edge authorization is shared by LoT/PO but duplicated in Proposal/Sample. Optional future work: extend/reuse the common Edge caller/guard while preserving each generator's existing read/write/admin checks. Estimate **1–2 engineering days** for those two migrations and focused permission/error-path tests, plus separately approved rollout. No generator refactor is included here. Higher-value immediate release discipline: validate each exact staged/downloaded artifact (shared source changes do not update already deployed bundles), and add the focused auth command to future LoT release gates. Optional automated artifact-parity/auth gate: **0.5–1 engineering day**. Estimates are engineering judgment, not approved scope.

## Source-only push safety

Only three files belong to this reconciliation: `package.json`, `scripts/verify-transmittal-edge-auth.mjs`, and this record. Original dirty/untracked work, released Bids/Samples, Material Readiness and other experiments remain untouched. No permission or migration changes.

TenOps and TenDev have automatic Production builds enabled for main/dev respectively. Use `[CF-Pages-Skip]` as the commit-message prefix for both branch updates, per [Cloudflare's documented GitHub build-skip mechanism](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/). Inspect before/after hosting deployment identities and Edge inventories to ensure the pushes caused no deployment. No Cloudflare project settings are changed. Commit/push is explicitly authorized; deployment is explicitly forbidden for this pass.
