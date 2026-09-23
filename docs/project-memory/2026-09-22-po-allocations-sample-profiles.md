# PO allocations and managed Sample profiles — local review

Status: original implementation record, September 22, 2026. The [September 23 corrective gate](2026-09-23-po-sample-corrected-gate.md) supersedes migration naming, current Git state and release readiness below. Nothing has been pushed, hosted-migrated or released.

## Intake checkpoint and authority

The inspected 13-path Intake implementation was checkpointed on normal dev as `181ab83cf6478d2cda98779295c64fe8560378d0` (workspace clean immediately afterward). Its migration and TEST Bid tooling remain unapplied/unexecuted against hosted environments. Intake remains paused before manual/hosted acceptance.

Chris explicitly authorized this bounded PO/Sample implementation and local additive migrations. Chris approved the existing Job-reserved stock model with explicit partial receiving, and conservative profile seed defaults below. This does not authorize other Pre-Production lifecycle work, hosted writes or release. No additional Git infrastructure was created.

## PO model and operational behavior

`purchase_order_line_allocations` stores one quantity per line/canonical Job pair. Multiple Jobs and partial allocation are supported. Positive quantities and the aggregate line quantity cap are enforced transactionally. Quantities use the existing PO order unit: a Chip line ordered as 40 Bags is allocated in Bags, not inferred pounds. There is no new reservation-demand system.

Each line has a compact Allocate disclosure with allocated quantities, Job selectors and an explicit general-stock remainder. Document-level Job context is unchanged. Material/Catalog/package/unit identity changes clear stale allocations; quantity reductions must still satisfy the cap. Draft save/reopen uses an allocation-aware wrapper around the existing validated PO save path. Pricing and Catalog selection are unchanged.

New issued snapshots capture the allocation intent and canonical Job identity. Pending Receivals split into Job portions plus the unallocated stock portion. Receipt uses existing reserved Inventory lots; the general remainder follows existing available-stock behavior. Source issuance, line and Catalog provenance are retained. New issued portions cannot be reassigned or have their expected quantities edited away from the snapshot. Short deliveries use partial receiving and cancellation of the undelivered balance; cancellation does not remove stock already received.

Single receiving accepts an explicit positive quantity up to the remaining amount. A request UUID makes same-dialog retries idempotent, including concurrent identical requests. An uncertain result remains visible and asks the user to retry the same quantity in that dialog. Bulk receiving retains its all-remaining behavior. A receipt ledger supports latest-receipt undo through the existing stock-unchanged safety guard; later Inventory activity can prevent undo. It is not a general Inventory rollback mechanism.

Historical PO snapshots are not rewritten. Historical projection behavior delegates to the existing function. Allocation metadata remains internal: the supplier PDF model/output is unchanged. The model test proves allocation metadata does not change supplier PDF data; disposable issuance tests use a generated-document fixture, not a real hosted PDF/Storage operation.

## Managed Sample profiles

A separate `sample_operational_profiles` table contains managed names, ordering, active status, revision, description and legitimate V4 defaults. Existing forensic profile definitions and all historical captured Samples/versions/documents remain intact.

Initial vocabulary:

| Profile | Ratio | Initial rates |
| --- | --- | --- |
| MTT | 5:1 | Existing ordinary MTT: density 128, dry pool 2560, filler 512, resin 480 |
| Key Resin | 5:1 | Unknown until configured |
| Terroxy | 5:1 | Unknown until configured |
| Sherwin | 4:1 | Existing ordinary Sherwin: density 128, dry pool 2560, filler 512, resin 512 |
| Cement | Unknown | Unknown until configured |

Density is lb/CFT; dry/filler rates are oz/CFT; resin rate is fl oz/CFT. Managed ratios support the existing V4 4:1 and 5:1 contract, plus unknown. Other binder systems require a separately confirmed calculation contract; Cement is not assigned a guessed ratio.

Active Admin/Developer users can Add, Rename, Reorder, Deactivate, Reactivate and configure profiles, matching existing Sample-default management authority. Revision checks reject stale saves. The workspace-level Configure profiles path remains accessible even if no complete profile exists.

New Draft defaults use the first active complete managed profile in configured order. Selecting an incomplete profile shows missing inputs and an authorized Configure path; it does not apply a fallback or replace the current Draft. After configuration, applying it is explicit. If no active complete profile exists, new defaults fail clearly rather than fabricate quantities.

Applying a profile captures its ID, revision, name, rates and provenance into the existing formulation snapshot. Later vocabulary/default changes affect future applications only. Existing captured/inactive/historical selections remain labeled as captured. Manual ratio override remains respected; supplier fallback is not product compatibility. No historical Sherwin-to-Resuflor identity is inferred.

Corrected V4 dependencies are unchanged: geometry × effective density controls Chip Mix; ordinary Filler edits are independent; Adjust Formulation is explicit; Resin/Hardener remain volumetric. Unified Regular/Specialty Catalog, blank-role filtering, typed secondary matches and stale metadata behavior are unchanged.

## Local migrations and release preconditions

Created, not hosted-applied:

1. `supabase/migrations/20260923160000_sample_operational_profiles.sql`
2. `supabase/migrations/20260923160100_po_reservation_allocations.sql`
3. `supabase/migrations/20260923160200_partial_pending_receipts.sql`

Sample migration is independent; PO allocation migration precedes partial receipts. These do not depend on the paused Intake migration `20260922_001_intake_projected_planning.sql`.

Before any separately authorized hosted release, verify installed PO projection/receiving/undo function definitions and signatures, private wrapper grants, issuance trigger order, pgcrypto availability, quantity precision and existing constraints. Migration 003 deliberately aborts if its narrow installed projection conflict-key patch does not match. Verify management roles and RLS against the actual target. Coordinate migrations and client: the new client requires the new tables/RPCs. No Edge Function or supplier PDF template change is included.

Do not promote dev wholesale: dev includes the unreleased Intake checkpoint. A future approved generator-only release must explicitly exclude Intake through the normal selective promotion process. No release branch/worktree is created now.

## Focused Level 3 validation

Level 3 applies because this changes persistence, issuance snapshots, receiving/undo and management authorization. Passed:

- `node scripts/verify-po-reservation-allocations.mjs`: disposable PostgreSQL, real relevant PO/Inventory migration functions; unallocated/single/split/mixed-material save/reopen, caps and rollback, immutable issuance, historical integrity, partial/full receipts, over-receipt rejection, cancellation, guarded undo, Specialty provenance, snapshot reconciliation, concurrent same-request retry, pricing and authorization.
- `node scripts/verify-sample-mass-balance-migration.mjs`: disposable historical Sample migration chain and managed-profile fixtures; vocabulary/defaults, incomplete values, management lifecycle, inactive/member denial, stale revisions, captured save/version/restore/issuance, historical non-rewrite, forward operational-data guard.
- `npx tsx scripts/verify-generator-profile-allocation-models.mts`: incomplete profiles, corrected defaults/V4 dependencies, manual override, capture and Working Sheet model, mixed-material allocation validation, supplier PDF model invariance.
- Existing focused Sample calculation, reactivity, historical parity and V4 contract verifiers; Unified Catalog verifier; Pending Receivals and Inventory reservation workflow verifiers.
- Four headless mocked UI scenarios in `tests/e2e/generator-allocations-profiles.spec.ts`: managed defaults/incomplete configuration and explicit application; allocation cap UI; narrow profile manager; partial receipt uncertain-result retry retaining request identity. Three ran together, the final receipt scenario ran separately. No visible browser or hosted fixture mutations.
- Final TypeScript, targeted ESLint, `git diff --check`, and Production build passed.

The existing V4 verifier had a stale literal label assertion already inconsistent with baseline UI; it now checks the actual established copy. No calculation was changed for that assertion.

Limits: disposable SQL tests use minimal legacy Inventory/auth/document fixtures around actual functions; they are not hosted verification. Headless UI uses mocked REST/auth. Actual hosted PDF/Storage, installed RLS compatibility and real localhost-backend acceptance remain future gates, not claimed passes.

## Chris review

With a compatible disposable/local backend (or a separately authorized hosted migration later):

- `/purchasing`: open a Draft, expand a material line's Allocate control; split quantities across two canonical Jobs; inspect general remainder, over-allocation validation, save/reopen and identity-change clearing. Issue only disposable test POs on that backend; review immutable portions and confirm supplier PDF remains uncluttered.
- `/inventory`: Pending Receivals; receive part of a Job portion, inspect reserved lot/remaining balance, finish receipt, test safe undo and cancel an undelivered remainder. These are business writes: do not perform against hosted data during this pass.
- `/samples`: Configure profiles; inspect initial managed vocabulary, incomplete Key/Terroxy/Cement, ordering and activation. Open a Draft's formulation selector, choose incomplete Cement and inspect the warning without Draft mutation. Configure only confirmed test values in a disposable environment, then explicitly apply; inspect Filler independence, Adjust Formulation and captured versions.

Normal localhost connected to the old hosted schema cannot complete these new persistence flows until its backend has the migrations. No hosted migration is authorized here. This is the remaining manual acceptance dependency.

## Original implementation boundary

- `docs/project-memory/2026-09-22-po-allocations-sample-profiles.md`
- `scripts/fixtures/sample-operational-profiles.sql`
- `scripts/verify-generator-profile-allocation-models.mts`
- `scripts/verify-po-reservation-allocations.mjs`
- `scripts/verify-sample-mass-balance-migration.mjs`
- `scripts/verify-sample-v4-contract.mjs`
- `src/app/inventory/page.tsx`
- `src/modules/purchasing/LineAllocations.tsx`
- `src/modules/purchasing/PendingReceivalsReviewDialog.tsx`
- `src/modules/purchasing/PurchaseOrderEditor.tsx`
- `src/modules/purchasing/allocation-model.ts`
- `src/modules/purchasing/mutations.ts`
- `src/modules/purchasing/queries.ts`
- `src/modules/purchasing/types.ts`
- `src/modules/purchasing/validation.ts`
- `src/modules/samples/OperationalProfileManager.tsx`
- `src/modules/samples/OperationalProfilesSettings.tsx`
- `src/modules/samples/SampleFormulationConfigurator.tsx`
- `src/modules/samples/SampleWorkspace.tsx`
- `src/modules/samples/operational-profile-model.ts`
- `src/modules/samples/operational-profiles.ts`
- `src/modules/samples/queries.ts`
- `supabase/migrations/20260923160000_sample_operational_profiles.sql`
- `supabase/migrations/20260923160100_po_reservation_allocations.sql`
- `supabase/migrations/20260923160200_partial_pending_receipts.sql`
- `tests/e2e/generator-allocations-profiles.spec.ts`
- `tests/generator-contracts.config.ts`

Original implementation-stage local dev HEAD: `181ab83cf6478d2cda98779295c64fe8560378d0`. Locally recorded origin/dev, main and origin/main remain `5f3d6489343aa115f8d517c9def011ba27d15b67`; no fetch/push/release was performed. These paths were uncommitted at the original implementation checkpoint; see the corrective gate for the separated local freeze.
