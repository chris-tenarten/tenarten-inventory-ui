# Production Blend Sheet V1 — local candidate

Authorized Product contract: Chris's October 5 two-part Production Blend Sheet V1 implementation authorization. Canonical base: `4c81212f8ef25e494ca43adea66a062888fe969e`. Local implementation only; no hosted migration, business-data mutation, push, deployment or release.

## Product behavior

Admin-only **Plan Production Blend** replaces the one-Batch editor action. A saved Sample is required; a new unsaved Sample is prompted to save first. Choose the current saved formulation or an issued Sample, then create a plan. Production does not author another recipe. Aggregate identities, percentages, sizes, vendors, package captures and source order are copied from the selected saved source.

- **Batch Count**: positive decimal input. Captured resolved chips/Batch (including formulation Filler override) × count = **Calculated Quantity**.
- **Planned Quantity**: positive operator input. Exact helper: **Adjust the planned amount as needed for production.** It is independent of Batch Count; edits never automatically round it.
- **Adjustment**: Planned − Calculated, signed; never an authored waste percentage.
- **Blend Size**: positive pounds, defaults to 1,000 for a new plan; saved plans retain their value. **Blends** = Planned / Blend Size without whole-Blend rounding.
- Aggregate **lb / Blend** = Blend Size × captured percentage / 100; total pounds use Planned Quantity. **Bags / Blend** uses captured package mass and selected catalog identity. Invalid/missing package metadata yields **Unavailable**, while authoritative pounds remain available. Captured non-50-lb mass conversions are supported; no material is rounded to a whole bag.
- Binder follows Batch Count and captured authoritative gallon quantities/ratio, independently of Planned Quantity. Missing Production binder authority yields **Unavailable** and does not block safe aggregate planning. Working Sample shop overrides are not promoted to Batch authority.
- Filler identity is retained; Production quantity is deliberately unavailable in V1. This does not change canonical Sample Batch Filler or its formulation override.
- Below-calculated Planned Quantity can be saved and rendered as a warned Working plan; issuing requires correction. Zero/negative/nonfinite/invalid-type inputs fail. A named aggregate composition totaling 100% is required. Legacy sources without canonical Batch authority are rejected honestly.

## Capture and lifecycle contract

One additive `production_blend_plans` table contains the source Sample UUID, optional issued Sample document UUID, complete source snapshot, three planning inputs, complete resolved model, contract version, working/issued status, revision, creator and creation/update/issue timestamps. The model captures profile identity/revision, resolved chip basis, Calculated/Planned/Adjustment, Blend Size/count, row identity/order/percentages/package snapshots/per-Blend and total quantities, binder Batch and Production quantities, and Filler identity.

The Edge handler fetches the source itself; client-submitted formulation/model data is not trusted. A new working-source capture rejects a changed source timestamp rather than silently adopting it. After the first save, the plan uses its captured source, including packages; create a new plan to use a different formulation. Input changes are local/deterministic until save/generate/issue. Save uses an optimistic revision check. Issued plans are immutable at the API and database trigger and render directly from their captured model. Later profile/catalog/Sample edits do not reinterpret them. The existing one-Batch API/model remains available for compatibility; existing Sample captures are not backfilled or rewritten.

Source UUIDs are immutable provenance rather than foreign keys with deletion side effects. Source deletion leaves the self-contained Production record intact and does not change the existing Sample cleanup contract. Production records can still be fetched by plan ID; a standalone orphan-plan library/cleanup workflow is not added in V1.

Authenticated table reads use active-Admin RLS; client writes are revoked. A service-only persistence RPC rechecks the actor's active Admin role. The Edge entry retains the operational capability gate and the downstream handler checks active Admin status for every plan action. No Inventory/Storage/catalog/profile writes or per-keystroke network operations were added.

## Migration

Apply after the accepted Sample sequence ending in `20261002120000_sample_normal_resin_profiles.sql`:

1. `20261005150000_production_blend_plans.sql`

SHA-256: `93313021bd1156c20acf0b05431d69b870a6024130aaae72dfcf070d99f6e48c`.

Validated locally in fresh disposable PostgreSQL using the existing Sample schema bootstrap plus the released Sample migration sequence. No fixture inserts occur in the migration. Historical fixtures are explicit verifier inputs; disposable review rows are created only by the opt-in local review script. No local database dump or row export is a release artifact.

## Historical golden results

| Source | Calculated lb | Planned lb | Adjustment lb | Blend Size lb | Blends | Bags / Blend | A/B gal |
|---|---:|---:|---:|---:|---:|---|---:|
| TAMU | 4,950 | 5,000 | +50 | 1,000 | 5 | 2/6/4/4/4 | 165/33 |
| Big Springs | 360 | 400 | +40 | 500 | 0.8 | 0.5/0.5/1.5/7/0.5 | 10/2 |
| Forest | 1,600 | 2,000 | +400 | 1,000 | 2 | 4/8/8 | 40/8 |
| Agawam | 10,800 | 12,000 | +1,200 | 1,000 | 12 | 3.5/3.5/0.5/0.5/3/3/2/2/1/1 | 300/60 |

Historical fixture captures deliberately supply the printed historical basis: Forest's 200 lb and TAMU's historical Production 5:1 are not changes to current managed profiles. Agawam's ten rows carry through unchanged and total 240 required 50-lb bags. There is no Pool Mix association or inferred reason for ADJ.

## PDF and validation

Title: **PRODUCTION BLEND SHEET**. Prominent Blend Count, Blend Size and Batch Count; material/size/vendor with bold Bags / Blend and secondary pounds; Filler identity followed by Part A / Part B totals in US gallons. Working sheets say NOT ISSUED. Source identity repeats on continuation pages. No Sample density/Working fraction/shop-rounding derivation is printed.

Tier 3 / Testing Level 3 focused gates passed:

- `verify-production-blend.mjs`: all four golden cases + current MTT; alternate/missing packages, fractional bags/Blends, changed Planned/Blend Size, binder isolation, Filler override, 4:1 binder, invalid inputs, invalid percentages and legacy fallback.
- `verify-production-blend-lifecycle.mts`: fresh migration, real PostgreSQL RPC persistence, active-Admin API gate, RLS and service-only write grants, stale revision rejection, below-calculated issue rejection, captured package/profile history, immutable issue/update/delete, source-deletion retention and issued Sample source.
- `verify-production-blend-pdf.mts`: five normal PDFs each one page; 45-row overflow fixture four pages; measured text bounds and unique row/pagination checks. All five normal pages and a continuation page visually inspected.
- `verify-production-blend-browser.mjs`: actual exported TenOps shell against disposable PostgreSQL, planning input/percentage/package/binder behavior, save/reopen, warning, working/issued PDFs, issued read-only, new plan, desktop/mobile. Mobile recipe uses horizontal scrolling to keep columns readable.
- `verify-production-blend-integration.mjs`: actual Edge dispatch, unchanged Working Sample PDF, New Sample opens its normal unsaved draft, non-Admin UI hidden and API denied.
- Adjacent unchanged Sample regressions: `verify-sample-gio.mts`, `verify-sample-filler-override.mts`, existing `verify-production-batch-handler.mjs` passed. Sample formulations, catalog implementation, Working Sample renderer and permissions were not changed.
- TypeScript, targeted UI ESLint, diff whitespace check and webpack Production build passed. Local adapter is a disposable backend, not hosted Supabase validation; real database persistence and permissions are tested separately from browser role fixtures.

## Review environment and artifacts

Chris explicitly chose to keep active root-workspace PID 66930 on port 3000 and authorized an alternate port. Actual candidate application: **http://localhost:4309/samples**. It is the built TenOps shell with a separate disposable PostgreSQL database and local backend; no hosted forwarding. Agawam-like and current MTT records are available. Agawam-like review plate uses the unchanged current valid format `T26-267A`; historical golden PDF retains `T26-267-A`. No fabricated canonical Job is created for these standalone review Samples.

Generated artifacts (not committed): `output/pdf/production-blend/` under `/private/tmp/tenops-production-blend-v1`, including `TAMU.pdf`, `Big Springs.pdf`, `Forest.pdf`, `Agawam.pdf`, `Current MTT.pdf`, `Agawam-UI-working.pdf`, `Agawam-UI-issued.pdf`, `unchanged-Working-Sample.pdf`, rendered PNGs and editor captures. Review launcher: `REVIEW_PORT=4309 npx tsx scripts/start-production-blend-review.mts`, after building with the same local Supabase URL. Optional `REVIEW_CATALOG_PATH` supplies an existing local representative catalog fixture; it never queries hosted catalogs.

## Exact candidate file boundary

- `src/modules/samples/ProductionBatchOutput.tsx`
- `supabase/functions/generate-sample-pdf/index.ts` (Production dispatcher import and branch only)
- `supabase/functions/_shared/production-blend.mjs`
- `supabase/functions/_shared/production-blend-handler.ts`
- `supabase/functions/_shared/production-blend-pdf.ts`
- `supabase/migrations/20261005150000_production_blend_plans.sql`
- `scripts/support/production-blend-fixtures.mts`
- `scripts/support/production-blend-database.mjs`
- `scripts/start-production-blend-review.mts`
- `scripts/verify-production-blend.mjs`
- `scripts/verify-production-blend-lifecycle.mts`
- `scripts/verify-production-blend-pdf.mts`
- `scripts/verify-production-blend-browser.mjs`
- `scripts/verify-production-blend-integration.mjs`
- `docs/project-memory/2026-10-05-production-blend-v1.md`

Isolated branch: `feature/production-blend-v1`. Root-workspace unrelated dirty code, migrations and historical/Geometry documents remain untouched. Canonical `dev`/`main` are not promoted or pushed. The historical discovery report remains in the root workspace; its evidence was consulted, not staged into this implementation boundary.

## Deferred

Proposal/product geometry → suggested Batch Count/Planned Quantity → operator review; evidence-based product overage suggestions; Inventory reservation/lots/consumption; authoritative Filler staging quantities; Pool Mix/lightweight aggregate semantics; Copper Spark/density-aware conversions. No automatic waste or rounding rule. No release blocker found; manual acceptance is pending on the authorized alternate review port.
