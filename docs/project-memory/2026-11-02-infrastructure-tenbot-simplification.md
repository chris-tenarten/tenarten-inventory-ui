# Infrastructure and TenBot simplification — November 2, 2026

Chris's attached **TENOPS — INFRASTRUCTURE & TENBOT SIMPLIFICATION** authorizes implementation, focused validation and local commits in the existing `dev` checkout. TenDev deployment is conditional on normal release checks; Production deployment, spending activation and additional paid services are excluded. Separate Advisory context is unavailable. This current explicit decision governs. **Implemented locally, pending Product acceptance.**

Base: `0caad99` on `dev`, initially 78 commits ahead / 14 behind the local `origin/dev` tracking ref (not refreshed by this pass). All four named local TenBot commits are in HEAD ancestry. No extra branch or worktree was created. Initial modified/untracked work and the unresolved evaluation journal are preserved separately from this pass's commit.

## Resulting architecture and employee behavior

The same five authorized Job read executors, capability registry, Terra/Qwen adapters and owner-private session/history services remain. The Edge entrypoint can now opt selected origins into model-directed reads using `TENBOT_MODEL_DIRECTED_READ_ORIGINS`. This defaults to empty and still requires the existing assistant enabled/origin gates; this pass changes no hosted configuration. Terra remains preferred when its key, spending authorization and atomic budget admission permit a dispatch. Qwen remains an optional metered fallback.

Simple population count/list requests use the existing deterministic handler inside the claimed owner session, without a model call or inference reservation. A conservative whole-request check prevents a second goal disappearing behind one matching intent. Separate counts, conjunctions, comparisons and richer requests go through the existing model-selected tool sequence. Individual status/schedule/labor requests remain model-first, with safe direct fallback where the whole request is understood; this pass does not claim every simple question bypasses inference.

Compound Job handoffs can combine saved dates, labor and unresolved-follow-up counts from multiple authorized reads. Canonical Job grouping removes repeated identities while retaining fact provenance and unknown/readiness qualifications. Explicit references and follow-ups use current authorized lookup evidence. If reasoning fails, TenBot says it could not complete the full request; it does not silently present one matching operational intent as a complete briefing. Permitted static workflow guidance remains available with an explicit coverage notice.

No new operational source, arbitrary SQL, write tool, permission or approval gate is introduced. Authentication, RLS, current record access, publication checks, owner-private history, consequential-write controls and existing feedback confirmation remain intact. Authorized reads need no per-operation Product approval.

The [monthly allowance](2026-11-02-tenbot-monthly-allowance.md) reuses the atomic hosted ledger: up to **$5 per UTC calendar month**, bounded requests and burst protection, full unknown-cost holds across month boundaries, and no permanent stale-open counter lockout. Historical rows and imports remain. The new narrow migration is **created and rollback-tested, not persistently applied**. Spending stays OFF; the local **$0.018723 unresolved hold** is neither refunded nor settled. Historical one-use evaluation tools/locks remain evidence, not prerequisites for ordinary hosted operation.

## Backup and recovery

The [backup/recovery record](2026-11-02-supabase-backup-recovery.md) contains current Management API verification, private bucket inventory, the independent Storage snapshot process and recovery steps. Automatic physical database backups are enabled; nine completed recovery points were listed from October 26 through November 2. Pro entitlement is seven-day retention, not a guarantee that every extra observed point will remain. Storage binary objects need their separate snapshot. No restore, Production data change or paid add-on was performed.

## Validation and limits

Tier 3 / focused Testing Level 3 covers the financial contract and authenticated orchestration blast radius. Existing relevant fixtures and verifiers were reused:

| Check | Actual result |
| --- | --- |
| `tsx scripts/verify-tenbot-read-orchestration.mts` | 19 groups PASS: multi-tool handoff, explicit identity, attribution/period follow-up, capability limits, current access/freshness, whole-request dispatch, incomplete fallback and private history |
| `tsx scripts/verify-tenbot-direct-answers.mts` | 8 groups PASS |
| `tsx scripts/verify-tenbot-resource-orchestration.mts` | 15 groups PASS |
| `node scripts/verify-tenbot-monthly-allowance.mjs --isolated-free-fixture` | 12 checks PASS in real PostgreSQL; one rollback-only transaction; original policy/ledger/function hashes restored |
| Storage exporter | 7 focused fake-CLI checks PASS; actual object export/restore awaits an owner-selected independent encrypted destination |
| Actual `http://localhost:3000/my-work` Messaging browser review | 7 focused checks PASS: compound handoff, date comparison, ambiguity, count, restored history and mobile containment; desktop/mobile screenshots inspected |
| TypeScript / targeted ESLint including `--no-ignore` Edge sources / `git diff --check` | PASS |
| `npm run build -- --webpack` with synthetic loopback data settings | PASS; generated knowledge snapshot unchanged |

Provider responses in orchestration and browser verification are **scripted**. No live Terra/Qwen reasoning, new funding or inference cost is claimed. Current live Terra quality remains unproven; the preceding evaluation stopped on an expired key. Unchanged prior concurrency evidence is reused; the monthly delta test is real PostgreSQL but is not a new concurrent/HTTP JWT run.

Two older, unchanged harnesses exposed preexisting harness drift: `verify-tenbot-hosted.mts` expects the old status shape without `persistentHistoryAvailable`; `verify-tenbot-edge.mjs` cannot resolve an existing extensionless canary import. Neither is reported as passing. The current orchestration and directly adjacent verifiers above supply this pass's focused behavior evidence. The initial sandboxed Turbopack build made no progress and was stopped; the supported Webpack build completed successfully.

Task scratch, initial dirty snapshots and selected browser/test output are in `/private/tmp/tenops-infrastructure-simplification-20261102`. The existing synthetic review adapter is reused on port 55597 and the built application is served at localhost:3000; port 3000 was unoccupied before this task started it. Review data, Auth and provider planning are synthetic, and operational writes are blocked. No unrelated process or artifact was retired.

## Delivery boundary and next decision

No push, persistent migration, hosted configuration edit, provider activation or deployment occurred. TenDev is **not deployed**: this checkout is a divergent development boundary, the backend/database are shared with Production, and the allowance migration still needs separate application approval. A clean selective release boundary and the required hosted checks must precede deployment. Existing Production behavior is preserved by the default-off origin gate and unchanged hosted state.

Stop for Product acceptance of this local candidate and backup/recovery approach. Migration application, any journal reconciliation/import and spending activation remain distinct explicit owner actions; the proposed budget mechanism does not authorize them.

## Deferred assistant home — November 2 Product direction

During this pass Chris directed that, **after this infrastructure/orchestration work**, TenBot's primary home move from Messaging to a dedicated global header icon: a right-side desktop assistant panel, expandable into a full workspace, and a full-screen mobile assistant. Persistent conversation history must remain intact. **Do not implement the relocation in this pass.**

Current changes remain in shared conversation/session, routing, provider and ledger code with no new dependency on Messaging presentation. No anticipatory UI refactor or expanded UI test scope was added. The subsequent relocation should reuse these contracts and persistent history; its implementation and UX acceptance are deferred.
