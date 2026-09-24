# Intake Planning reconciliation — local review, September 23

## Authority and state

Chris authorized the attached reconciliation contract and temporary Admin/Developer-only module boundary. Normal `dev` started clean at `85708a5a27bc8edca0bc9ed41ec16dfd56fe205f`. This is uncommitted local work. No push, deployment, hosted migration, hosted business mutation or demo insertion occurred. The preserved checkpoint `181ab83cf6478d2cda98779295c64fe8560378d0` is unchanged.

## Reconciliation

Ported the checkpoint's BidWorkspace hunk, BidPlanningCard, IntakePlanning, planning model/data loaders, deterministic eight-Bid demo manifest and SQL printer, focused verifier, headless tests and historical implementation record. Compared the checkpoint parent to current HEAD for all ported existing files and shared Production/Planning dependencies: no intervening changes in those dependencies needed merging. No whole-branch merge or baseline replacement was used.

Current PO allocations/partial receipts, Sample managed profiles, Unified Catalog, performance work and Pending Receival fixes remain byte-for-byte unchanged. No old migration filename, broad role assumptions, old release infrastructure, inferred Bid Due Date/Tier schema, or hosted demo data was ported. The shared Production components were reused without modification.

## Data and user workflow

Existing Bids remain the canonical Intake model: Active/Won/Lost, customer/project, owner, contact, notes and deposit date. Seven nullable fields add projected start/end, projected update actor/time, unique canonical Production Job link and conversion actor/time. Both dates must be present or absent and start must not exceed end. There is no historical backfill, no invented Bid Due Date/Tier, and no weighted capacity math.

Pipeline remains default. Planning is lazy-loaded, with Projected Intake / Production / Combined modes. Projected blocks use dashed/patterned treatment plus explicit PROJECTED text; committed Production stays solid. Move/left/right resize writes only projected dates through an optimistic concurrency RPC. Accessible ordinary date controls and lightweight Bid activity retain actor/time and old/new values. Timeline ranges are bounded to 42/90/180 days and scroll within the surface on narrow layouts.

Conversion requires saved Won + recorded deposit + existing createProductionJob; scheduled conversion also requires scheduleProduction. Admin can convert; Developer's Intake access does not grant Job creation/scheduling. Carry forward, explicitly chosen new dates or unscheduled conversion are supported. Bid row locking and retry return the same canonical Job; errors roll back all changes. Converted Bids stop appearing as projected capacity. Source Bid/Job cleanup protections prevent detaching provenance. The existing Production scheduling RPC remains authoritative and unchanged.

Production overlay reads existing Job/phase loaders on demand, caches requests across mode switches, retains the existing protected-project visibility filter, and opens the existing Production workspace. It does not duplicate schedule state, change phase semantics or expose new financial/Bid queries to Production users. The existing four-phase/Pause/overlay scheduling implementation is untouched.

## Temporary authorization boundary

Fresh read-only hosted inspection found broad readOperationalData policies on Bid tables and security-definer RPCs. Navigation hiding alone would not enforce the request.

The new accessIntake capability is granted only to active Admin/Developer. An app route layout gates the entire /pre-production subtree before mounting data loaders; navigation uses the same capability and active profile. Lead/Member/Guest see no Intake link and direct routes show an access-denied surface.

Database restrictive policies add an AND condition to bids, bid_activity, bid_updates, bid_file_relationships, bid_proposal_relationships, bid-files canonical metadata and Storage objects. Existing policies remain intact. Nineteen reviewed RPC definitions are narrowly corrected: Bid reads/writes/files, contextual Proposal/Sample link/create and Bid-scoped Sample listing. Exact normalized-definition guards fail closed on installed drift; CREATE OR REPLACE preserves ownership, grants, security attributes and search_path. The capability must not already exist. New Planning RPCs require accessIntake, with independent existing Production capability gates for conversion.

Independent Sample/Proposal document access retains its established permissions and historical snapshots; this is not an expansion or removal of that separate document permission model. No Planning data is added to those independent surfaces. Production data retains its existing permission model. No user IDs implement this boundary.

To widen later: an explicitly approved forward migration grants accessIntake to Lead in app_role_capabilities, and the matching client ROLE_CAPABILITIES Lead bundle adds accessIntake. Review focused allow/deny tests and change temporary UI copy. No Planning component, data model, RPC body or restrictive policy rewrite is needed. Do not reuse accessDevelopmentEnvironment as an Intake permission.

## Local migrations (apply in this order only after separate authorization)

| File | SHA-256 |
|---|---|
| `20260923215900_intake_early_access.sql` | `2c31bac9d889aa4ddae27044ef754d67576b7d06a7b29c19f7c9eee1d0d5cb53` |
| `20260923220000_intake_projected_planning.sql` | `bb089eed546ce961cde531635bcbc57659619cd6e98696fbc6b81db397ca07db` |

The early-access migration precedes Planning. Both versions are absent from the freshly inspected hosted ledger; current Sample/PO versions 20260923160000–20260923160200 remain untouched. Ledger presence was not treated as complete schema evidence: installed function definitions, policies and Bid columns were read directly. Planning adds nullable columns/constraint/index, two RPCs, two history event types and source-cleanup guards. No Production/PO/Sample/Inventory business rows are updated. The contextual create_sample guard changes only authorization when a Bid is supplied, not formulas or standalone behavior.

## Validation — focused Level 3

- `npx tsx scripts/verify-intake-planning.mts`: PASS. PostgreSQL date constraints/null/clear/save, historical field preservation, stale edits, gates, carry/new dates, replay/concurrent conversion, rollback, protected cleanup, demo idempotency and zero local residue.
- `npx tsx scripts/verify-intake-access.mts`: PASS. Both new migrations together; exact hosted function guards; Admin/Developer allow and date saves; Lead/Member/Guest deny at table/RPC/Storage/contextual entry points and conversion; historical fields preserved.
- `npx playwright test --config=tests/intake-planning.config.ts`: 8 PASS. Three focused Planning/interaction/conversion/narrow-layout fixtures plus five role route/navigation cases. All API data mocked; no visible browser or hosted writes.
- TypeScript: PASS after Production build regenerated the added layout route types. The initial standalone invocation found stale generated Next route types, not application type errors.
- Targeted ESLint: PASS. `git diff --check`: PASS. Production build: PASS, 22 routes.
- No unrelated PO/Sample/Inventory/Catalog/Manpower suites ran.

Limits: disposable tests replay the relevant actual Bid/file/RBAC/schedule migrations and captured hosted RPC bodies. Unrelated Proposal/Sample dependencies and Job deletion blocker internals use minimal scaffolding; this is not a full hosted database clone. Existing independent document permissions and formula lifecycles were not re-tested broadly because their semantics were not changed. Future release requires fresh installed-schema/guard validation. This is local readiness, not hosted migration acceptance.

## Demo and next review step

All eight deterministic TEST Bids and eight activity rows remain in planning-demo.ts / the SQL printer; no hosted execution occurred. No real Job or document is created by the demo. Converted source/conflicting identities cause cleanup/seed failure rather than destructive overwrite.

Chris can review localhost /pre-production as Admin/Developer. Pipeline works against current hosted schema; new Planning persistence cannot save until the two migrations exist on the connected backend. Current TenDev and Production share the same Supabase project, so applying to “TenDev” would also affect Production and is not authorized here. For actual persistence review, use a separately configured disposable/local backend with the migrations, or explicitly authorize a coordinated hosted schema gate. Demo seeding requires later separate approval of owner and exact eight-Bid/eight-activity manifest. Do not insert it merely to make the UI preview populated.

## Changed-file boundary

- `docs/project-memory/OPEN_QUESTIONS.md`
- `src/app/client-layout-shell.tsx`
- `src/lib/rbac.ts`
- `src/modules/pre-production/BidWorkspace.tsx`
- `docs/project-memory/2026-09-22-intake-projected-planning.md`
- `scripts/intake-planning-demo-sql.mts`
- `scripts/verify-intake-access.mts`
- `scripts/verify-intake-planning.mts`
- `src/app/pre-production/layout.tsx`
- `src/modules/pre-production/BidPlanningCard.tsx`
- `src/modules/pre-production/IntakePlanning.tsx`
- `src/modules/pre-production/planning-data.ts`
- `src/modules/pre-production/planning-demo.ts`
- `src/modules/pre-production/planning.ts`
- `supabase/migrations/20260923215900_intake_early_access.sql`
- `supabase/migrations/20260923220000_intake_projected_planning.sql`
- `tests/e2e/intake-planning.spec.ts`
- `tests/intake-planning.config.ts`
- `docs/project-memory/2026-09-23-intake-planning-reconciliation.md`
