# Constraint-based Sample pour planning — local candidate

Continues accepted local foundation `2cfe7434b2b2695ac5a6264da6725c47d0b264d6`. Tier 2 bounded UI/local calculation refinement. No release authorization.

## Implemented

Suggest Working Pour opens temporary constraints without calculating. Calculate Suggestions explicitly computes up to three distinct uniform rectangular alternatives. Inputs changing invalidate results until another explicit calculation, including when changed values are subsequently reverted. Normal geometry summaries remain live.

Width/length adjustment defaults enabled; unchecked dimensions retain the current physical pour size. Optional maximum dimensions use inches. Arrangement may vary or use a fixed operator-authored column count; uniform rotation is independently permitted. Optional edge/separation allowances use explicit nonnegative amounts, zero by default. Allowances are not optimized or inferred from shop rules. Invalid/unsatisfiable constraints return an explanation with no fabricated result.

Alternatives rank by lowest theoretical volume, then shortest longest side. Outputs include dimensions, unchanged thickness, CFT, reference Batch fraction, projected chips, exact dry quantity when supported and volume above finished pieces. Apply changes only unsaved pour width/length. Finished specs, profile, percentages, Batch authority and manual shop instructions stay unchanged. No implicit Save/Generate or remote planning calls.

## Thickness boundary: deliberately deferred

`SampleFormulationState` has one `thicknessIn`. Both the Batch-first engine and SQL normalization (`20261001010000_sample_batch_first_authority.sql`) derive pour volume from it; `sample-work-order-pdf-model.mjs` uses the same captured value for geometry. A local-only pretend pour thickness would be lost or misinterpreted on save/capture/render.

Independent thickness therefore requires a separately reviewed persisted/captured contract, e.g. optional `workingPourThicknessIn` with an explicit legacy fallback to the existing shared thickness, SQL normalization/validation, and compatible versioned document handling. Historical captures must remain unchanged. Final field naming, fallback and renderer versioning require Product review before implementation; no migration was created.

Allow thicker Working Pour is visibly unavailable. Maximum/preferred thickness and thicker-pour exploration are deferred together. The planner never changes finished thickness and currently proposes zero thickness finishing allowance. Shop approval of molds/cutting/yield is not inferred from rectangular feasibility.

## Focused evidence

- `verify-sample-pour-planning.mts`: passed foundation tests plus locks in both dimensions, maximum limits, fixed columns/rotation constraints, invalid count/allowances, impossible layouts, volume ranking and preservation of finished specs/thickness/manual quantities on Apply.
- `verify-sample-pour-browser.mjs`: passed actual disposable TenOps UI, explicit calculation, no immediate suggestions, invalidation, impossible maximum width, locked width, deferred thicker-pour control, allowance recalculation, Apply/manual preservation, no implicit writes, unchanged saved record on reopen and desktop/mobile overflow checks. Percentage-input regression retained and passed.
- TypeScript (standalone and final build), targeted ESLint, webpack Production build and diff check passed. Batch-first engine, PDFs, persistence and schema unchanged.
- Broad PDF, auth, Production Blend, history and migration suites intentionally not rerun. Thicker-pour calculations cannot be verified until the independent thickness contract is approved.

## Review environment

`http://localhost:3011/samples?open=0e1adb4f-9402-44ee-aff9-e82ab3b3b367`

Actual exported application with disposable local PostgreSQL. Port 3000 remains with Material Readiness candidate `bae6d7b...`. No hosted mutation, migration, push or deployment. Temporary review files remain ignored and outside the committed boundary.
