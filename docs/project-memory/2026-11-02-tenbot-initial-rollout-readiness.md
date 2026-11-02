# TenBot initial employee Production rollout readiness — November 2, 2026

**Implemented and built locally; full initial rollout requires one focused authorization correction. Not deployed or activated.**

Chris's **TENDEV — TENBOT PRODUCTION READINESS & INITIAL EMPLOYEE ROLLOUT**, attachment `56b986b3`, accepts the completed TenDev scope and authorizes focused local corrections, selective Production preparation and scoped local commits. The separate Advisory conversation was unavailable. This receipt supersedes the prior Pending receipt's acceptance-pending status only: completed TenDev behavior is now Product accepted. New local eligibility changes and the proposed permanent execution contract remain subject to this review. Tier 2 release preparation, focused Tier 3 authorization review/Testing Level 3 for the affected eligibility and action boundary; no broad campaign.

## A. Decision and exact boundary

Local source correction **`fbff048ee24ea9b8283811b84c9c1089709d2612`** on root `dev` base `7a0243e1` implements persistent cohort eligibility, independent paid-provider gating, exact Production action-host compatibility and permission-filtered discovery. It does not activate anyone.

Exact clean selective candidate **`40037650c63c68214aa1e4c1ce71a2812ce45650`**, tree **`6b11cdec845f78782a26ea6cb567e14f515e5bfd`**, descends only from actual Production **`e71bd981a583e0a4e706f9953c6cc1fcc4d576e1`**. Accepted runtime input is TenDev **`afb549d157453b767e726313bcea87dc4e43f2ed`** plus six runtime blobs from the local correction. No dev merge or branch promotion occurred.

**Genuine blocker:** normal Pending execution is still finite-pilot/enrollment-dependent in both Edge and SQL. Neither an origin flag nor persistent cohort membership can safely remove that dependency. The [exact proposed contract](2026-11-02-tenbot-permanent-pending-activation-plan.md) changes one existing SQL action-dispatch branch and one Edge pre-execution branch, without new tables, grants, RLS policies or helpers. It is not implemented or applied. Product must approve the material authority change before the full accepted rollout is ready. Additional tools, capability-request persistence, OCR, forecasting and further conversational tuning are optional/outside this release.

## B. Actual employee accounts and permissions

At **22:15:53Z / 4:15:53 PM CST**, narrow read-only account records and the existing effective-capability helper established:

| Employee | Existing email | Account UUID | Role | Proposal access |
|---|---|---|---|---|
| Chris Ngo | christopher@tenartenterrazzo.com | `553948ec-f71e-4c06-9da8-6ad3755584d7` | Admin | Yes |
| Patrick Soldow | patrick@tenartenterrazzo.com | `c85c852e-6775-4ee7-bfb7-f6ff0778243b` | Lead | No |
| Giovanni Coppola | giovanni@tenartenterrazzo.com | `29bed5b3-2ed8-43aa-9af2-45578b00388e` | Lead | Yes |
| Anthony Iorio | sales@tenartenterrazzo.com | `92edea19-e431-4493-9a1b-3c3ecf32aeae` | Lead | Yes |
| Marcos Alvarado | marcos@tenartenterrazzo.com | `70ecf39f-d873-4330-92e7-a78df3329655` | Lead | No |

All five are active, confirmed existing accounts, not read-only, with effective `readOperationalData`, `writeBusinessData`, `adjustInventory`, `manageVendorsCatalog`, `previewOperationalDocuments` and `uploadSupportingFiles`. No account, role or capability was created or changed. Chris's previously designated business/Admin account is selected; the separate `chris developer` account `3785f6b9-742e-452f-af6c-31613a983633` is excluded.

The local correction reuses default-OFF `TENBOT_EMPLOYEE_MODE_ENABLED` and adds configured `TENBOT_EMPLOYEE_IDS`, default empty. Membership uses exact verified UUIDs, current authenticated owner/session, exact canonical TenOps/TenDev origin and existing hosted/model-read gates. It has no acceptance-window expiry or temporary enrollment renewal. Paid Terra additionally requires independent spending authority and the atomic meter. Current existing capabilities filter discovery and recheck execution; Pat and Marcos do not acquire Proposal preparation access.

Existing JWT/RLS, owner-private history/source reauthorization and requesting-account password confirmation remain intact. A distinct fresh same-owner Auth session is bound to the exact action ID/revision/hash, live permission/policy version and one-use authorization. The accepted 15-minute action and at-most-two-minute password proof expiries remain action-specific. The TenDev-only transient-history flag does not affect Production's separate persistent history path. There is no new credential system or transcript-reading bypass.

## C. Funding recommendation and actual financial state

**Propose $5 shared per UTC calendar month for the five accounts, $0.25/request, Terra only, maximum 16 model steps/request, 16 steps/user/minute and 60 steps/global/minute.** Use one shared pool, without per-user dollar partitions. Existing observed successful reads cost $0.008738–$0.017835; the accepted eight-step Pending request cost $0.021574. Allowing for existing holds, $5 roughly supports 225–550 similar questions/month; this is extrapolation, not measured five-user demand.

The applied monthly reserve already supports this configuration with a hard schema ceiling of $5/month and serialized reservation/settlement. The old total/day/user-day/daily-request/open-limit columns remain historical inspection fields and are **not enforced gates** in the monthly reserve; do not advertise them as additional limits. No billing infrastructure or funding migration is needed. Recommend an ongoing financial policy using existing `expires_at='infinity'` rather than another acceptance window, subject to explicit Product funding approval. Monthly accounting advances automatically; unknown reservations continue to count. Existing administrator/operator meter and ledger reads expose allowance, remaining amount and per-user usage; no new Settings budget UI was built.

At exhaustion the atomic reserve refuses a new paid dispatch; the employee receives the existing unavailable/retry behavior. There is no automatic top-up, hidden budget increase, historical reset or invented refund. More specific budget copy is not a release dependency. The current configured provider cutoff remains independently enforced at **2026-11-28T22:46:56Z**, verified against its existing digest without reading the credential value; ordinary credential-lifetime maintenance must occur before that real configured cutoff.

Fresh financial state at **22:14:47Z**: policy v13 **OFF**, month cap **$0.842208**, November accounted **$0.363782**, configured remaining **$0.478426 under disabled funding**. All **173** usage rows/hash `ef0176dd59599ef82a318c2ea6fce57a` remain unchanged. Historical held **$0.142953**, including **$0.018723**, is preserved. New inference/cost this pass: **zero / $0**. Neither the old unused amount nor the recommendation authorizes spending.

## D. Source, shared backend and deployment boundary

Fresh read-only Cloudflare/Supabase metadata at **22:14:47Z** confirms:

| Hosted target | Actual served identity |
|---|---|
| Production Pages | `e71bd981a583e0a4e706f9953c6cc1fcc4d576e1`, deployment `eb191ab7-6e40-4275-b0a1-c616044b89a5` |
| TenDev Pages | `afb549d157453b767e726313bcea87dc4e43f2ed`, deployment `4f87390b-6f14-490d-b3d6-d859abfd3240` |
| Shared TenBot Edge | v67 ACTIVE, JWT ON, source hash `7d48ef0647128fb5b78a6624da68df523870a01de1bb4a5b407517a854177230` |

The candidate selects **44 application runtime paths** (23 frontend, 21 Edge/shared), two reference READMEs and six already-applied migration history files; twelve additional paths contain exact source proof/receipts/derived integrity metadata. [Exact selection](evidence/2026-11-02-tenbot-initial-rollout-readiness/selected-source-manifest.json), [candidate](evidence/2026-11-02-tenbot-initial-rollout-readiness/candidate.json). It retains accepted Workspace/Messaging continuity, reviewed actions, existing own-password session handoff and the accepted Pending refresh event. Unrelated business logic, Purchasing, Production, Web Push, branding/assets/PWA and routes remain Production-rooted. Existing optional request UI dependencies retain their unavailable/default-null backend; no optional persistence is enabled. Canary UI/routes/control files and unrelated cleanup changes are excluded. The dirty root agent implementation is excluded/pinned to accepted bytes.

The local correction's six runtime paths are `ActionWorkspaceBridge.tsx`, shared `tenbot-action-transport.ts`, `tenbot-agent-session.ts`, `tenbot-hosted-operations.ts`, `tenbot-hosted.ts`, and Edge `tenbot/index.ts`; five existing verifier/fixture files accompany them. [All eleven exact paths and checks](evidence/2026-11-02-tenbot-initial-rollout-readiness/access-validation.json).

The shared ledger already contains **20261102100000**, **120000**, **130000**, **140000**, **150000** and **160000** (November 2): monthly allowance, reviewed actions, canonical stages, operation history, deferred record boundary and total-quantity evidence. All six exact files are history-only in the candidate. Fresh object/owner/ACL checks and quantity body MD5 `d3a63872347bbe7ac6dc1283b73f4289` match the accepted current contract. Prior exact migration/database compatibility receipts are reused; none was reapplied. Candidate migration application list is empty **because the new required permanent Pending contract remains a plan**, not because configuration alone solves it.

The build uses fresh existing Production settings, canonical TenOps/main/candidate identity, dev branding false, canary controls off and `NEXT_PUBLIC_TENBOT_ACTIONS_ENABLED=true` only in the local artifact. Existing opaque planning settings use the same digest-matched value from the verified e71 build. Both PWA manifests and Production title/gold icons match base bytes. No hosted environment was changed.

Future activation would separately configure the five UUIDs, normal mode, exact TenOps model-read origin, reviewed-operation/action controls and approved financial policy. Existing TenDev compatibility can remain; both canonical surfaces would share the same five-account pool. Temporary acceptance, canary and legacy pilot enrollment stay OFF. Pending control/execution must wait for its approved permanent contract.

Any later release requires fresh exact-base/config checks, matching Pages/Edge deployment and separate explicit Product approval. Emergency disable: stop ordinary spending and monthly policy, disable employee/review/action execution controls; policy versions invalidate unconsumed approvals. Before rolling Edge back to v67, keep spending disabled, because that older source lacks the new cohort restriction. Pages rollback target is current e71; preserve history/accounting and use forward schema corrections rather than editing applied migrations. No rollback or deployment occurred here.

## E. Inventory “Load received items”

**Retain it.** Source `src/app/inventory/page.tsx:2346` sets `includeReceived=true`, triggering `loadReceivalRows` in `src/modules/inventory/retrieval.ts:15`. It expands the paginated SELECT from outstanding statuses to also include `received`; cancelled/cleared entries remain excluded. It changes no business records, quantities or stock. Separate Undo Receive/Clear Received Items actions retain their own capability/lineage paths and are not invoked by loading.

Original **`1dc57a3f4c35f1d3f31312191f84df1052dc695c`**, October 19, 4:20:18 PM CDT; integrated as **`c43f0c74e3654b5229c7ec3d0bdb444ffa0ba830`** at 4:26:15 PM. Git attributes both to Christopher; it does not establish the editor/tool used. The performance Wave 4 receipt documents intentional lazy loading of completed delivery history, independent of TenBot. Employee purpose: show completed deliveries when needed while keeping the outstanding queue quick to open. [Read-only finding](evidence/2026-11-02-tenbot-initial-rollout-readiness/inventory-button.json).

## F. Actual verification, evidence reuse and preservation

- **61 focused model-free groups pass:** 24 Terra eligibility/funding gates, 10 hosted sessions, 10 operation/discovery groups, 17 trusted adapter groups. Includes outsiders, exact origins, mixed Proposal/Inventory permissions, current permission revocation and normal-mode independence from finite acceptance. TypeScript, targeted lint and diff checks pass; independent affected-authorization review finds no blocker in the local patch.
- **Exact Production candidate passes:** original unchanged release verifier, zero holds; clean full-history source; 55-module closure; Production build **278 artifacts / 31.85 seconds**; generated artifact unchanged through prebuild; secret-pattern scan; Production branding/PWA/canary exclusions. Original proof exposed incomplete receipt formatting/dependency classifications; only proof metadata was corrected, preserving failed attempts, with no runtime/verifier weakening.
- Reused accepted real Terra Job/compound/evidence reasoning, Proposal/Pending employee password completion, canonical database quantity/source/rollback/concurrency/privacy and Workspace desktop/mobile/Messaging evidence. None of those successful scenarios was repeated. New capability/session tests use Auth/RPC/provider doubles, not actual employee credentials or new real RLS acceptance. Five current accounts were read back, but five separate signed-in browser sessions were not tested.
- No browser automation, screen capture, password access, paid inference, new fixture, hosted mutation or broad Inventory/security/regression suite this pass. Existing root localhost3000/internal servers and prior build output remain untouched; no process or session was stopped.
- Eight preexisting dirty files were preserved; only an owned compact handoff was appended to the execution standard. Its original dirty bytes remain intact and are excluded from the scoped documentation commit by staging only HEAD plus that append. Other unrelated dirty/untracked artifacts and concurrent work are untouched. New raw private metadata/configuration/logs remain in `/private/tmp/tenops-production-readiness-20261102`; selected sanitized evidence and the verified recovery bundle are retained here. [Recovery](evidence/2026-11-02-tenbot-initial-rollout-readiness/source-recovery.json), [candidate preservation](evidence/2026-11-02-tenbot-initial-rollout-readiness/candidate-preservation-final.json).

## G. Next Product decision / compact handoff

**Recommend focused correction before authorizing full Production rollout.** Approve the small permanent reviewed-Pending authority change described above; then implement/verify the exact SQL/Edge correction in the existing fixture and return its migration/hash and refreshed candidate for separate shared-application/release approval. Product can also accept the inactive $5/month funding proposal for later explicit activation. No further conversational benchmark or new AI feature is needed.

Current authority is local preparation only. Completed TenDev scope is accepted; `fbff048` and Production-rooted `40037650` are locally implemented/validated, not deployed or generally activated. Existing shared source/schema and all funding/write controls remain unchanged/OFF. No push, Production deployment, migration application, funding renewal or activation is authorized by this receipt. Stop for Product review.
