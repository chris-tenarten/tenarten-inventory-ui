# Intake projected Production planning — parked checkpoint record

> Historical record for `181ab83c`. Current reconciliation, authorization, migration names and validation are in [2026-09-23-intake-planning-reconciliation.md](2026-09-23-intake-planning-reconciliation.md). The old migration name and broad operational access described below are superseded; do not apply the parked migration.

## Authority and boundary

Chris's September 22 autonomous implementation request explicitly authorizes this local feature and additive migration, overriding the older blanket implementation hold for this bounded work only. Chris separately approved the conservative conversion gate: **saved Won + recorded Deposit Received Date + existing createProductionJob permission; exactly one canonical Job per Bid; no override**. This is the scoped acceptance contract, not approval of the broader unresolved Bid/Sample lifecycle.

Started from clean normal `dev` at `5f3d6489343aa115f8d517c9def011ba27d15b67`. The accepted Unified Catalog/performance work was already committed in that baseline. This feature remains uncommitted. No hosted changes, commits, pushes, deployments, separate branches or worktrees.

## Repository findings and implemented contract

- Existing Intake uses `bids`, Active/Won/Lost, Deposit Received Date, contact fields and notes. There is no structured Bid Tier, Bid Due Date, Lead Source, Next Action or existing conversion RPC. Those CRM fields were not invented. Dates mentioned in demo notes are not structured due dates.
- Pipeline remains the default. Planning code and projected metadata load on demand. Production/phase data loads only in Production or Combined mode and is reused across mode switches; refresh or changed Bids invalidates it.
- The timeline reuses Production calendar arithmetic, zoom widths, Planning geometry/intersection helpers and phase visuals. Bids are not fabricated Jobs. It bounds the displayed range to 42/90/180 days, with intentional local horizontal/vertical scrolling.
- Dashed/patterned **PROJECTED** blocks and explicit tentative copy distinguish Intake from solid **PRODUCTION** blocks beyond color. Move/edge resize and Inspector dates save only projected fields through one RPC. Escape/pointer cancellation does not save. Lost/converted Bids are excluded from projected rows; unscheduled eligible Bids remain discoverable.
- Production is a read-only overlay of existing authoritative loaders, including active Rework projection and existing fixture visibility. Its blocks open the existing Production workspace. Phase scheduling, phase limits, progress, Pause behavior and Production mutation paths are untouched.
- Conversion presents Carry Forward, Set New Dates or Plan in Production Later. Committed dates additionally require existing `scheduleProduction` permission. Users with create permission but no scheduling permission can create the canonical Job unscheduled; the original projection remains on the Bid. No new permission is granted.
- The Job receives Bid project name/customer/deposit date and an optional manually entered Job number. No number is automatically allocated. Explicit initial dates use the existing atomic Production schedule RPC. No phases, Work Orders, issued-document changes or communication are created.
- Row locking and expected `updated_at` reject stale edits. Conversion retries, including simultaneous requests, return the same linked Job. Failure rolls back Job creation, link and history together.
- Source relationship is `bids.production_job_id` (unique FK); Job creation metadata also records `source_bid_id`. Production owns scheduling after conversion. The original projection becomes read-only history; it cannot double-count in Combined.
- Existing Bid activity records projected old/new dates and conversion choice/Job/dates, with actor and time. No separate audit subsystem.

## Migration and cleanup protections

Local file: `supabase/migrations/20260922_001_intake_projected_planning.sql`.

Adds seven nullable Bid columns: projected start/end, projected update actor/time, Production Job link, conversion actor/time. Requires both dates or neither, ordered dates, a unique canonical Job link and a partial projected-window index. Existing rows receive no inferred values or updates. Existing Bid SELECT RLS and RPC-only writes remain unchanged.

Adds `set_bid_projected_window`, `convert_bid_to_production`, the converted-source deletion trigger, and two history event types. Extends the installed history constraint rather than replacing its accepted event vocabulary.

Preserves existing cleanup bodies under private `intake_base_*` names and wraps `prepare_admin_delete_bid` / `production_job_delete_blockers`. This rejects a converted Bid before external Storage deletion begins and blocks deleting its linked Job. Conversion rejects a Bid with pending file removal. No cleanup runs during implementation.

Hosted compatibility is **not verified** and the migration is **not applied**. Before any release, inspect installed columns, history constraint, capability functions, schedule RPC signature, cleanup function bodies/grants and dependent callers. The local PostgreSQL verifier uses actual relevant foundation/RBAC/schedule/Bid migrations and the actual Bid cleanup entry point, with minimal file tables and a stub for unrelated existing Job deletion blockers; it is not a replay of the entire hosted database.

## Validation (Level 3, focused)

Passed:

- `npx tsx scripts/verify-intake-planning.mts`: disposable PostgreSQL 17.6 migration, unchanged historical Bid fields, nullable/ordered windows, save/clear/reopen, inactive/guest/member/admin permission cases, direct-write denial, stale edits, Won/deposit/scheduling gates, carry/new dates, replay and simultaneous conversion, duplicate-number transaction rollback, source cleanup guard, demo idempotency and zero residue. Container removed afterward.
- `npx playwright test --config=tests/intake-planning.config.ts` (after `npm run build`), three headless Playwright fixtures: Pipeline lazy loading; source switches/cache; move and both resize edges; exact date-only RPC arguments; Inspector editing; retained Proposal/Sample actions; carry/new-date conversion; source transition/no duplicate; 390px local overflow behavior; stale-save message and unchanged fixture data. All requests mocked; no hosted mutations or visible browser.
- `node scripts/verify-planning-schedule-staging.mjs`, `node scripts/verify-planning.mjs`, `node --experimental-strip-types scripts/verify-production-schedule-staging.mjs`.
- TypeScript, targeted ESLint, `git diff --check`, Production build.

Two initial browser failures were locator issues (existing Status label includes option text; Next adds its own alert). The stale-save check also exposed a real generic-error issue; planning-data now converts Supabase errors to Error so specific conflict feedback survives. All three checks passed after correction.

## Limitations / localhost review

- Normal localhost still connects to hosted schema unless explicitly configured otherwise. The new persistence feature requires the local migration in a disposable/local backend; it cannot save against the unchanged hosted schema. The Production-build headless fixtures exercise the UI with mocked data without that dependency. Visual/UX acceptance remains Chris's responsibility.
- New projected metadata is paginated. The existing Bid list and reused Production/phase loaders retain their existing server row limits; this pass does not claim unlimited full-platform planning completeness. Before deployment against larger datasets, assess those loader cardinalities and address truncation in a separately reviewed loading change if needed.
- Production mode shows current non-complete/non-shipped/non-cancelled Jobs, including active Rework; it is not a historical schedule report or capacity calculation. No forecasts/probabilities/utilization metrics.
- Dates/contacts/scenarios in the fixture are deliberately TEST examples. No real Bid due-date/Tier feature, standalone CRM expansion or Sample lifecycle change.

## Eight-record demo gate

Exact manifest: `src/modules/pre-production/planning-demo.ts`. SQL generator: `scripts/intake-planning-demo-sql.mts`. It only prints SQL and never connects to any database. An explicit existing owner UUID is required.

All IDs use `de000000-0000-4000-8000-` plus the 12-digit scenario number below. Project names start `TEST —`; customers start `TEST CUSTOMER —`; contacts are `TEST CONTACT — Example N`, `intake-demo-N@example.invalid`, `202-555-010N`. Notes begin `TENOPS-INTAKE-PLANNING-DEMO-2026-09` and `DEMONSTRATION ONLY — not a real opportunity.` Full exact notes are in the manifest.

| N | TEST project | TEST CUSTOMER suffix | Status | Projected dates (2026) | Deposit |
|---|---|---|---|---|---|
| 1 | Website Lead — Downtown Restaurant | Restaurant Concept | Active | unset | unset |
| 2 | Hotel Lobby Terrazzo | Hotel Example | Active | Oct 5–23 | unset |
| 3 | University Stair Package | University Example | Active | Oct 19–Nov 6 | unset |
| 4 | Airport Concourse | Airport Example | Active | Nov 2–Dec 18 | unset |
| 5 | Retail Cove Base Package | Retail Example | Active | Oct 26–30 | unset |
| 6 | Corporate HQ Slabs | Office Example | Active | Nov 9–27 | unset |
| 7 | Mixed Terrazzo Package | Mixed Package Example | Active | Nov 16–Dec 4 | unset |
| 8 | Award / Ready-to-Convert Example | Award Example | Won | Oct 12–23 | TEST Sep 22 |

Insert scope is exactly **8 Bids + 8 created Bid activity rows**. Creator/owner/activity actor use the separately approved existing app-user UUID. Seven dated Bids also use it for projected-update provenance. Created/updated/provenance timestamps are insertion-time values. All Production links/conversion fields remain null. No customers/contact entities, Jobs, phases, Samples, Color Plates, Proposals, files, numbering, messages or notifications are seeded. Scenario 3 describes the existing Sample action without creating a document.

Seed repeats use deterministic IDs and do not overwrite existing demo edits. Identity/marker/creator/converted conflicts abort. Cleanup targets these eight IDs and activity only, refuses converted/conflicting records, and is transactional; dependent-record FK errors abort rather than detaching relationships. Seed twice/cleanup twice passed locally with zero residue and unchanged Job count.

Future authorization must name the owner and approve only this manifest's **8 Bids + 8 activity rows**, after client acceptance and a separate hosted migration/release gate. Recheck installed triggers/notification behavior and ID collisions immediately before a hosted insert. Do not convert scenario 8 or perform hosted cleanup without separate authorization. This document is not that authorization.
