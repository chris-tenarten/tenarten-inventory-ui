# Persistent TenBot conversations — executed TenDev staging, November 1, 2026

**Deployed to TenDev; Product acceptance pending.** Chris's APPROVED PERSISTENT CONVERSATION STAGING accepts local candidate `a96c89b7a7c2a12984b0746fbb88f5836be6fb88` and authorizes the single compatible migration and matching TenDev UI/Edge deployment. The Advisory thread was unavailable; this current explicit decision governs. Tier 3 / focused Testing Level 3 for private persistence and authorization contracts. Earlier [local-only claims](2026-11-01-tenbot-persistent-conversations.md) and [bounded-history staging](2026-11-01-tenbot-live-history-staging.md) remain historical receipts, superseded only at the boundary below.

## Exact staged boundary

| Component | Verified identity |
| --- | --- |
| Selective TenDev candidate / served runtime | `9415adc577e5509c2473001fbd514ab644077e3c` |
| TenDev Pages deployment | `f62e8e3f-4c5e-40fb-94c0-f0e02feed638` |
| URL | https://tendev.pages.dev |
| Previous TenDev source | `c45f12a6b10aa01b524922b654ce61b12e7be9f8` |
| Shared tenbot Edge | Version 36, ACTIVE, JWT verification ON |
| Edge source SHA256 | `7da38e7ce461acb01c29a2ca6713a5842ee8c0be563231b369e89908baa86c8a` |
| TenOps Pages, unchanged | `01c0b4576a61329d973ce65ca58437ce26627be1` / `967ed4d1-0ee8-4488-8db2-ee984cabc953` |

The selective source uses the 20 accepted runtime/UI/migration/fixture/verifier paths from a96c89b7, on the existing accepted TenDev source. Eleven runtime source acknowledgements and one accepted-but-unapplied migration acknowledgement retain the established candidate-scoped distinction; the mandatory verifier itself is unchanged. Existing knowledge entries and other application source were preserved. Uncommitted latency changes and unrelated root dev work were excluded. The candidate's unchanged mandatory proof reports **zero holds**. The standard build passed with 287 artifacts; credential-pattern scanning passed. The generated knowledge snapshot changed release metadata only, preserving content and the committed artifact contract.

The shared database and Edge were intentionally updated for this staging. TenOps Pages was not deployed. Persistent transcript routing remains **TenDev and localhost only**; the existing Production history transport remains guarded. Shared quantitative presentation improvements use the compatible existing response contract. This is not a claim that the Production backend was untouched.

## Single migration application and compatibility

Applied only **20261101200000_tenbot_persistent_employee_history.sql** to shared project `vxdxjhazkqhpkwdqtobp` / tenartenDB. Exact SHA256:

`535410dd08c0f199a87d9b1d7439990d9d5a2e90052d27cf9f62b4971f9f9811`

Fresh bounded preflight verified the deployed predecessor function bodies, existing private history tables, RLS/policies/ACLs, absent new objects and all write/accounting controls. An independent read-only migration review found no blocker, contingent on those checks. The same new definitions had passed the isolated real-database tests. Application used one bounded transaction with migration serialization, exact predecessor/state guards, the original approved migration bytes, exact ledger insertion, and full expected after-schema/control checks before commit. Ledger hash and catalog readback passed.

The additive columns/indexes and fixed RPCs reuse existing owner-private history storage. Existing history-table RLS/ACLs and replaced legacy function ACLs were preserved. Claim discovery remains owner-only; archive commit/page are service-only; the fixed Job-reference check uses the caller's current JWT/RLS. Admin status does not provide an archive-reading override. No Inventory/catalog/receival migration, business permission change, role change or operational record mutation occurred.

Existing minute legacy-text purge and hourly signed private-invoice cleanup schedules were unchanged and their recent runs succeeded. The minute purge touches only legacy short-lived state receipts, not the durable transcript archive. No new secret, scheduling infrastructure or service-role business gateway was added.

## Validation: actual, reused and unavailable

| Check | Result and evidence boundary |
| --- | --- |
| Mandatory clean selective proof | PASS, zero holds; unchanged verifier and accepted source hashes |
| Standard build / output safety | PASS, 287 artifacts; no credentials bundled |
| Shared schema and migration readback | PASS, exact ledger hash and expected catalog definitions; prior RLS/ACL/business authorization/control invariants preserved |
| Hosted Edge source/import boundary | PASS, 39 relative runtime modules match exact candidate bytes; version 36 active/JWT ON; served OPTIONS and unauthorized requests complete |
| Served TenDev identity/assets | PASS, runtime9415adc5 and 34 sampled core/Auth/Inventory/My Work/service-worker/manifest assets match the build |
| Auth/REST responsiveness | PASS, Auth health200 and zero-row catalog/pending-receival queries200; no employee records requested |
| Unauthenticated access | PASS, six status/history requests on TenDev/Production origins denied401; new claim/page RPCs denied anonymous access |
| TenDev CORS | PASS, OPTIONS204 with exact TenDev origin allowed |
| Provider/secrets/budgets/accounting/controls | PASS, before/after protected state unchanged |
| Previous answers survive navigation/reload, timestamps, count→list and labor wording | Completed local deterministic/UI evidence reused; **not tested in a genuine hosted employee session** |
| Hosted owner isolation and permission revocation | Prior real isolated JWT/RLS evidence reused; **not tested with genuine hosted employee callers** |
| Normal signed-in Messaging | Local UI evidence reused; **not verified in hosted employee UI during this pass** |

Reused exact-source evidence: **13** focused deterministic groups, **15** adjacent history/routing groups, **10** real isolated PostgreSQL/Auth/JWT/RLS groups, and **10** local desktop/mobile Messaging groups, plus prior types/lint/build checks. The isolated database tests include current count/list, later-session discovery, historical-versus-current values, genuine synthetic owner/Admin isolation, restrictive Job-RLS revocation, indexed paging and account revocation. Local browser tests use synthetic Auth/records/model transport and are not hosted authorization evidence. No broad QA or model benchmark was repeated.

No legitimate connected browser or non-browser employee session was available. The previously unavailable browser integration was not retried; no credentials were manufactured, tokens extracted, sessions borrowed, employee impersonated or service-role operational reads used. Consequently the requested signed-in hosted conversational checks remain a release limitation. Public 200/401 checks establish reachability and rejection, not successful employee behavior.

An initial Cloudflare metadata401 was resolved by one existing CLI OAuth refresh; one bounded retry passed. An initial isolated metadata query referenced that standalone fixture's absent migration ledger; a corrected catalog-only read passed. Neither is evidence of a Database/Auth outage. No repeated unavailable-service probes or infrastructure changes were made.

## Final safety and Production gates

Final readback at **2026-11-01 21:32:25 UTC** confirmed all agent writes OFF, execution-only authorization dormant, preparation/funding controls unchanged OFF, **zero** unrevoked temporary grants, **zero** enrollment and **zero** active write permits. Ordinary OpenAI spending authorization remains false; Terra/Qwen configuration, prior charges, uncertain reservations and all accounting are unchanged. **Zero inference calls and zero operational writes** occurred. No new permission grant, canary, upload, approval, funding, push or TenOps Pages deployment.

Remaining Production release requirements:

1. Focused legitimate TenDev employee smoke for persistent answers/timestamps/reopen, count→list, named Job labor, current access revalidation and normal Messaging. Owner/revocation behavior must not be claimed from the public probes. Product must review any remaining explicit limitation.
2. Product acceptance of this exact staged integration, followed by a separately Production-rooted selective source/proof/build boundary. Dev is not a wholesale release source.
3. Explicitly include and approve Production-origin persistent transport activation in that candidate. Promoting these Pages assets alone would not enable the guarded Production history contract. The approved shared migration is already applied; do not reapply it or infer authorization for another migration.
4. Separate Product authorization for TenOps deployment. Preserve operational writes/execution authorization OFF, empty grants/enrollment and existing provider/spending policy.

Root dev HEAD, index, branch refs and all 13 pre-existing dirty-file bytes were unchanged before scoped documentation appends. Only this receipt, sanitized evidence and append-only status/handoff/supersession links were added. Existing localhost review servers and ports were untouched; no new branch/worktree/framework. Task-owned exact source/private Git/operator/build/recovery bundle remain under `/private/tmp/tenops-tenbot-persistent-staging-20261101`; the incremental bundle is verified against c45f12a6. No root source commit or push occurred during staging.

Evidence: [candidate](evidence/2026-11-01-tenbot-persistent-staging/candidate.json), [unchanged release proof](evidence/2026-11-01-tenbot-persistent-staging/mandatory-proof.json), [build](evidence/2026-11-01-tenbot-persistent-staging/build.json), [migration](evidence/2026-11-01-tenbot-persistent-staging/migration-applied.json), [Edge](evidence/2026-11-01-tenbot-persistent-staging/edge.json), [Pages](evidence/2026-11-01-tenbot-persistent-staging/pages.json), [served assets](evidence/2026-11-01-tenbot-persistent-staging/served.json), [hosted smoke and limitation](evidence/2026-11-01-tenbot-persistent-staging/smoke.json), [final controls](evidence/2026-11-01-tenbot-persistent-staging/final.json), [workspace preservation](evidence/2026-11-01-tenbot-persistent-staging/workspace-preservation.json). Private credential/settings responses and command logs were not copied. Stop for Product acceptance.
