# TenBot live-answer history — executed TenDev staging, November 1, 2026

**Deployed to TenDev; Product acceptance pending. TenOps Pages unchanged.** Chris's current APPROVED LIVE ANSWER HISTORY STAGING accepts a00d62e354f4c5086d2ca5ad9bb9c87d31a40a60 and authorizes selective source proof, the two compatible migrations, matching UI/Edge deployment and private purge configuration. Advisory thread unavailable; current explicit instruction governs. Tier 3/focused Testing Level 3 release pass, reusing completed security/database/browser evidence. This receipt supersedes earlier local-only/unapplied status only at the boundary below; original receipts remain historical.

## Exact release boundary

| Surface | Verified result |
| --- | --- |
| TenDev selective SHA | c45f12a6b10aa01b524922b654ce61b12e7be9f8 |
| Parent staging baseline | 509abf3be39e77d607e458a297abbaa3e592f189 |
| TenDev Pages deployment | 54960d4f-d92f-4d0f-af2d-7ac82a7a227d |
| TenDev URL | https://tendev.pages.dev |
| Shared tenbot Edge | v35, ACTIVE, JWT verification ON; bundle SHA256 6641a8278302afc3f38218d2153f0b258c124af326a5c46edc13009eba2e5ff5 |
| TenOps Pages, unchanged | 01c0b4576a61329d973ce65ca58437ce26627be1; deployment 967ed4d1-0ee8-4488-8db2-ee984cabc953 |

The private detached archive contains the16 accepted task paths plus the existing hosted adapter's small compatibility guard; no dev merge, branch/worktree, source push or unrelated promotion. Source hashes and accepted-versus-technical authority are in [candidate.json](evidence/2026-11-01-tenbot-live-history-staging/candidate.json). Unchanged release verifier/generator: zero holds, no semantic/unclassified-source holds, knowledge records and permissions unchanged. Standard final build PASS:287 artifacts,37 relative Edge modules; all37 hosted module bytes and34 served assets match. TypeScript, targeted lint, diff check and12 focused history/legacy-client groups PASS. Two test-helper corrections used the existing canonical fallback fixture and correct single-argument API; they did not change application/migration semantics. No broad QA or model benchmark.

### Necessary shared-Edge compatibility guard

The current TenOps UI accepts only workflow/scope history, so returning operational-history turns from the shared Edge would break its hydration. Two modules are explicitly classified **technical-review**, not falsely claimed as exact Product-accepted a00d62e bytes: tenbot-hosted.ts opts only https://tendev.pages.dev into the new display transport; tenbot-agent-session.ts leaves old-origin operational responses volatile and withholds new history fields/turns. Existing private TenDev receipts remain bounded when the same owner accesses an old client. Authorization, current source checks, model prompts, providers, budgets and allowlisted tools remain unchanged. The focused fixture proves old-client compatibility. The [technical patch](evidence/2026-11-01-tenbot-live-history-staging/tendev-compatibility.patch) and exact source-proof receipt are retained with the candidate; Product acceptance of these technical integration bytes remains pending. The guard must be deliberately reviewed for any later Production-rooted candidate, never silently enabled on TenOps.

## Exact migrations applied

Both approved files were applied once in one bounded atomic transaction with exact predecessor/result function, protected authorization/RLS/ACL, disabled-control and accounting guards, and their original source recorded in the migration ledger. Readback matches:

| Version | SHA256 |
| --- | --- |
| 20261101180000 | 67ce36cca4e5ecee965182e544ef588c70f18f17125992089a556cf14a0ad342 |
| 20261101181000 | 8dda0d2e7dcb665f4b589f3cd16c15269b66ff41900db2b80ea46a0b7b85a472 |

The current shared state validator matched the exact context-migration predecessor. Existing histories/states remain valid; only an optional strict operational-receipt array is admitted. Existing history policies, table ACL/RLS, owner claims/leases/CAS, protected functions and earlier migration ledger are unchanged. The private purge's sole executor is postgres; no employee or service-role EXEC grant. No receival migration or new business capability.

## Private retention maintenance

Existing infrastructure: postgres pg_cron, already responsible for the hourly **signed-invocation** attachment-cleanup dispatcher. Its job3, command hash and hourly schedule remain unchanged. Because the newly reviewed purge is deliberately postgres-only, it is called **inside the trusted database scheduler**, not by widening the signed HTTP handler/service-role allowlist. No HTTP purge endpoint, reusable secret, queue credential, new service or permission was added.

New private job **4 / tenbot-operational-history-expiry**, schedule **every minute**, command only SELECT public.tenbot_purge_expired_operational_history();. It removes at most100 expired answer receipts per invocation, skips active claims and leaves static guidance/context and invoice originals untouched. Successful runs observed at19:38 and19:39UTC (about20ms/13ms). No raw answer content is returned/logged by the job. Ten-minute display expiry and fresh reauthorization deny display independently of scheduler success; an outage can delay physical deletion until maintenance resumes. Five completed real purge checks are reused; no retention of approved invoice evidence is affected.

## Actual validation versus limitations

**New hosted checks performed:** exact migration bodies/ACL/ledger and private purge execution; JWT verification enabled;37 deployed Edge module bytes;34 exact served Auth/Inventory/Messaging/shared assets; Auth health and zero-row Inventory REST HTTP200; unauthenticated status/history requests rejected401 from both TenDev and TenOps origins. No employee records queried with administrative credentials. One stale Cloudflare OAuth session caused preflight401; one existing CLI-session refresh and bounded retry succeeded, with no configuration change.

**Reused, not rerun:**44 accepted deterministic groups,12 genuine isolated PostgreSQL/Auth/JWT/RLS groups (count/list, owner/Admin isolation, record/global revocation, changed evidence, expiry and fresh labor),5 real private-purge checks and5 local desktop/mobile UI checks (send/blur/reopen/remount/browser-storage isolation). Twelve narrow deterministic groups were run for this candidate, including the new shared-Edge compatibility gate. These are not fresh hosted employee results.

**Not performed:** signed-in hosted count → list, readable operational history, navigation/reopening, owner/cross-user isolation, real permission revocation and normal signed-in Messaging interaction. No legitimate authenticated hosted employee session is available to this thread. Previously unavailable browser integration was not retried; no token extraction, manufactured JWT, impersonation or service-role business-data bypass. These focused hosted checks remain a Production release limitation/gate. No Terra/Qwen inference was dispatched; cost **$0** and no spending activation.

## Final boundaries and next decision

All agent writes, execution-only authorization, preparation/funding and ordinary OpenAI spending remain OFF; grants0/enrollment0/active permits0. Existing Terra configuration, Qwen fallback, secrets, finite policies, cumulative/uncertain accounting and unrelated functions are unchanged. No temporary permissions, operational Inventory/catalog/receival/stock mutations, source push or TenOps Pages deployment.

Next: Product accepts the staged scope/explicit compatibility guard; obtain a legitimate hosted employee session for the small outstanding signed-in checks (or Product explicitly accepts the limitation), then prepare a separately Production-rooted exact source/proof/build candidate and obtain separate TenOps deployment approval. No new migration, inference funding or write activation is needed for that review. The current old-client gate intentionally keeps operational-history display TenDev-only.

Root dev HEAD/index/branch refs and all13 initial dirty paths were verified unchanged before these append-only documentation updates. Localhost3000/API55597 review processes were not touched. Task source/private Git, bounded operator logs and incremental recovery bundle are in /private/tmp/tenops-tenbot-live-history-staging-20261101. No new review port/worktree. Sanitized [final hosted receipt](evidence/2026-11-01-tenbot-live-history-staging/final.json), [smoke limitations](evidence/2026-11-01-tenbot-live-history-staging/smoke.json) and [workspace preservation](evidence/2026-11-01-tenbot-live-history-staging/workspace-preservation.json) accompany this report. Stop for Product acceptance.
