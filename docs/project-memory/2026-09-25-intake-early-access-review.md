# Intake Early Access + retained Timeline — local review, 2026-09-25

Review snapshot below records the completed local validation. **Release subsequently authorized by Chris:** the guarded transaction has now renamed all eight demos and removed Gio’s exact unconverted training Bid, its one creation activity and registry row. Protected integrity assertions passed. Migration/client release follows this source commit; final deployment evidence is retained separately. Normal `dev` baseline: `a76f4f83e66a1d3b149ff31bff44874a39c1b6f3`. Messaging worktree and unrelated discovery note are excluded.

## Approved access contract (after migration)

| Role | Read / ordinary Intake edits, Updates, files, projected windows | Ordinary conversion | Schedule at conversion | Guarded Bid/Job deletion |
| --- | --- | --- | --- | --- |
| Admin | Yes | Yes | Yes | Existing Admin cleanup only |
| Developer | Yes | No | No | No |
| Lead | Yes | Yes | Yes | No |
| Member | Yes | Yes, unscheduled | No | No |
| Guest | Yes | No | No | No |
| Anonymous / inactive | No | No | No | No |
| Service role | Existing trusted direct-table behavior unchanged | Existing RPC actor requirements unchanged | Unchanged | Existing trusted behavior unchanged |

`accessIntake` is added only for Lead/Member/Guest. All roles already had Intake read access. Direct authenticated business-table mutations remain denied: editing runs through the existing authenticated RPCs. Conversion retains active actor, createProductionJob, Won + deposit, optimistic version check, Bid row lock, retry returning the canonical Job, explicit date choice and scheduleProduction when committing dates. No fake numbering or implicit Job creation.

Existing normal Production grants/policies remain authoritative—including Member Requested delivery. No new normal Job capability or policy is granted. Existing raw authenticated DELETE and anonymous Jobs revocations remain intact. File management uses the established registered-upload / finalize / prepare-removal / remove-bytes / finalize lifecycle. Bid and Job deletion functions, typed confirmation, dependency refusal and separate manageUsers authority remain unchanged.

## Retired training scaffolding

Removed runtime client training loader, personal create/open/reset controls, owner exception props, owner-only identity UI, automatic TEST numbering and special conversion/scheduling exceptions. Removed unused UnderDevelopmentBadge component/style and training-only lifecycle fixture/verifier branch. Historical migration files remain immutable. Historical training documentation now points here.

The forward migration drops training grants/workflows, helper/creation/reset/assertion RPCs and the Bid/Job identity triggers; normal management/file helper functions retain their locking and active-account checks. Storage loses only its training-owner exception; existing policies/ACLs are guarded. Names and badges confer zero authority.

## Existing data and separate cleanup

Fresh read-only Production inspection found **eight curated demo Bids** and **one unconverted personal-training Bid**, `c6da2ea0-f6d0-4de2-a08f-d8c895291ac6` (Gio). That personal Bid has one creation activity, zero Updates/files/Proposal/Sample relationships and no Production Job. Chris requested its removal. Prepared `scripts/fixtures/intake-early-access/cleanup-retired-training.sql` removes only its exact unchanged Bid, creation activity and registry row. It checks captured row digests, rejects added dependencies including future FK relationships, locks dependencies, and refuses changed/converted/missing records. No Storage object exists to remove. **Not executed.**

The schema migration refuses a nonempty training registry. Review and execute the separately authorized exact-record cleanup first at eventual release, then apply the migration. No curated demo is identified for cleanup. The migration itself performs no business-row rewrite/backfill/deletion.

Fresh read-only baseline (not a claim that demo records still equal their original seed; users have added activity since seeding):

| Relation | Rows | SHA-256 |
| --- | ---: | --- |
| `bids` | 9 | `aa5a7eba6d40afaa4a95e9e4ac5131c460dccc684c0850646fa2edcbe55dbc58` |
| `bid_updates` | 16 | `7f2e197a7cb8344ef2e0bcb20208304290ddd9569fd12ae5c08842b3807eef86` |
| `bid_activity` | 28 | `47fe0e1c0427dedb0263d9faba290575637d8d5d59819a26abd5963922e8b7f2` |
| `canonical_files` | 8 | `f7b6b2b94e96508f928b4917e3775bf80efa609aea9e419f143485ec081941e4` |
| `bid_file_relationships` | 8 | `cc71141f6030a56467f83a31c47f3d8c61ff291b54f6d6d2344d01af8c062318` |
| `jobs` | 39 | `4a895bfd133b6766bfd32d84d5ffc17c0e26192b050aae4594687c1a3fcea45f` |
| `samples` | 1 | `30f13bc0332b96987ead827fe3c4cb75cfad5b34be6fad14e2da460a4aa0f6f3` |
| `proposals` | 3 | `f2cc36616d8cb396dd12d8d0116139337e90807d5a28f441d1b89cf416161190` |

No hosted mutations were made in this pass. All eight demo identities, their current Updates/activities/files, ownership, stages, deposit and windows are preserved. No Jobs were created or changed.

## Cosmetic demo identity (separate from authority)

Chris approved a fixed client UUID registry sourced from the eight immutable fixture identities. The compact TEST badge appears once per Pipeline row, Inspector heading and projected Timeline identity. It survives cosmetic renaming; a different record named TEST does not acquire it. It is never imported by authorization, conversion or cleanup code. EARLY ACCESS uses the existing module-maturity badge; TEST uses a restrained violet treatment with light/dark variants.

[Exact eight-record before → after rename proposal](2026-09-25-intake-demo-rename-proposal.md). **No name change has been executed or approved yet.** The immutable original manifest is not edited. Future seed/cleanup machinery will intentionally refuse renamed/edited records unless separately reviewed; the runtime registry does not bypass it.

## Financial visibility

No field-level financial capability exists for Bids. Deposit date, notes/context, Updates and attachments are already readable by all active Intake roles. This pass adds ordinary editing, not additional read fields. It does not introduce financial redaction or broaden the separate Proposal access predicate / document lifecycle guards. Financial visibility decomposition remains an explicit Product/RBAC follow-up in OPEN_QUESTIONS.

## Prepared migration and recovery

`supabase/migrations/20260925180000_intake_early_access_editing.sql`

SHA-256: `99d966518beb8c91e4720ca5275c3eb1091e6f9facdf84a2624361f9b3739995`

Guard covers freshly inspected relevant function bodies/owners/ACLs/security/search paths, table shapes/ACLs/RLS/triggers/constraints, policy composition and relevant capability matrix. Refuse drift or live training workflows. Explicit transaction: failure rolls back; replay tests confirm rollback. Do not restore owner cleanup or anonymous access as recovery. Keep historical migration files unchanged.

Eventual order: fresh gate → exact training cleanup → this migration → accepted client. Old client training reads fail to its existing unavailable-training fallback after retirement; ordinary Admin/Developer workflows remain available. New client against old schema may expose controls whose RPCs reject lower-role edits, so migrate before client rollout. No release is authorized in this pass.

## Retained Planning

Timeline only; no Calendar. Projected/Production/Combined segmented sources, original default, normalized chronological order and Combined interleaving, active Rework effective dates, deterministic phases, complete pagination, cached Production loading, move/resize, accessible date editing, pan/zoom/Today/Fit and continuous noninteractive Today marker retained. The HIGH PRIORITY contextual-warnings backlog is preserved for Timeline; no warnings implemented.

## Validation

Focused Level 3 for authorization and retirement; reused unchanged Level 2 Planning model/loading/interaction evidence. Local disposable replay uses the prior full schema capture plus released migrations and freshly captured Storage policy composition; it first proves equality with the exact hosted authorization guard.

- PASS: five active-role ordinary edits, stage/deposit, Updates, file upload/finalize/removal, projected window + stale version, separate conversion/scheduling/deletion.
- PASS: 35 normal Production operation pairs unchanged; Member Requested delivery remains permitted.
- PASS: anonymous/inactive denial, service-role direct read/write, removed training objects/RPCs, guarded conversion retry.
- PASS: capability/function/table-grant drift and nonempty registry refusal, transactional rollback; all business-row digests unchanged after migration/probes.
- PASS: exact cleanup algorithm on synthetic equivalents, refusing changed Bid/new dependency; eight example fixtures preserved.
- PASS: Production build, TypeScript and targeted ESLint. No broad unrelated suites.
- PASS: nine focused headless checks (five active roles, anonymous route denial, module badge light/dark/desktop/narrow, segmented mode switching, UUID-only TEST identity and Admin destructive contrast/keyboard/native-prompt cancellation). All traffic mocked; no visible browser or hosted mutation. Final single-test rerun corrected test assumptions about the default Active filter and keyboard versus programmatic focus.
- PASS: runtime badge registry matches exactly the eight immutable manifest UUIDs.
- PASS: reviewed headless light/dark screenshots; destructive button text ≥4.5:1 and border ≥3:1 in normal/hover/focus states. Native confirmation cancellation sends no write.
- PASS: git diff --check.

The remaining Admin deletion controls use scoped semantic text/background/border colors and explicit keyboard focus; the obsolete Personal TEST card is gone. Confirmation is the existing browser-native typed prompt (browser/OS styled), not a new custom destructive modal.

## Complete uncommitted boundary

34 paths; nothing staged. The unrelated Messaging discovery note is one additional untracked path and remains byte-identical (SHA-256 `a77706eaec0cb91df8a39d4d7ad987ecdd67272b5d1b0fa4919c04e27a010f77`).

```text
 M docs/project-memory/2026-09-24-intake-personal-training-review.md
 M docs/project-memory/OPEN_QUESTIONS.md
 D scripts/fixtures/intake-personal-training.sql
 M scripts/verify-intake-access.mts
 M scripts/verify-intake-view-access.mjs
 M src/app/client-layout-shell.tsx
 D src/components/UnderDevelopmentBadge.module.css
 D src/components/UnderDevelopmentBadge.tsx
 M src/lib/rbac.ts
 M src/modules/planning/data.ts
 M src/modules/pre-production/BidPlanningCard.tsx
 M src/modules/pre-production/BidWorkspace.tsx
 M src/modules/pre-production/IntakePlanning.tsx
 M src/modules/pre-production/queries.ts
 D src/modules/pre-production/training.ts
 M src/modules/production/jobs.ts
 M tests/e2e/intake-planning.spec.ts
?? docs/project-memory/2026-09-25-intake-demo-rename-proposal.md
?? docs/project-memory/2026-09-25-intake-early-access-review.md
?? scripts/fixtures/intake-early-access/cleanup-retired-training.sql
?? scripts/fixtures/intake-early-access/contract.sql
?? scripts/fixtures/intake-early-access/matrix.sql
?? scripts/fixtures/intake-early-access/normal-production.sql
?? scripts/verify-intake-early-access.mjs
?? scripts/verify-intake-planning-loading.ts
?? scripts/verify-intake-planning-model.ts
?? src/lib/complete-rows.ts
?? src/modules/pre-production/BidWorkspace.module.css
?? src/modules/pre-production/CuratedDemoBadge.module.css
?? src/modules/pre-production/CuratedDemoBadge.tsx
?? src/modules/pre-production/IntakePlanningTimeline.tsx
?? src/modules/pre-production/curated-demo.ts
?? src/modules/pre-production/planning-model.ts
?? supabase/migrations/20260925180000_intake_early_access_editing.sql
```

## Review/release prerequisites

Localhost review is next. The exact eight-record cosmetic rename map still needs Chris’s approval. Hosted schema retirement is not applied and cannot proceed before separate guarded cleanup of the remaining training Bid. Re-read current guards/digests at release; refuse drift rather than overriding it. Financial-field separation remains future Product work, not a blocker to the explicitly approved current read/edit matrix.
