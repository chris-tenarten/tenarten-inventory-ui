# Sample Generator — Gio local review candidate

Current Product direction: October 2, 2026 follow-up to released `48a312e8b08ba3bb67bb28295d13fd9ab94b7705`. Local implementation only; no hosted migration, business-data mutation, push, deployment or release.

- Production Batch generation is active-Admin-only in the UI and Edge action boundary. Member, inactive and unauthenticated requests are denied; normal Working Sample permissions are unchanged.
- MTT, Key Resin and Terroxy share the accepted complete normal 5:1 defaults (180/50 lb, 5/1 US gal, captured reference/yield and shop instructions). Existing configured profile-specific values and confirmed component authority are preserved. Actual configured vendor names are captured with profile identity. Sherwin retains released 150/50 and its supported 4:1 Sample contract; unresolved Production binder quantities remain unavailable. Cement remains incomplete.
- The primary Resin System selector remains in place. Profile-derived supplier and binder-row vendors update on explicit application; differing manual vendor text is retained. Generic binder descriptions update to vendor defaults; authored descriptions survive. Resin/Hardener material fields are plain text. Aggregate/Filler catalog behavior is unchanged.
- Resin Color/# and the Resin-row description synchronize when blank/generic or previously aligned. Conflicting authored values remain visible, with explicit choices to use either value in both fields before saving. No profile mutation or feedback into calculations occurs.
- New Batch-first Working Sheets and new issues use `sample-work-order-pdf-v9-compact`. Minimal, representative and historical-high-count cases (1/5/8 aggregates) fit one page at readable sizes; 45-row stress safely paginates. Historical source sheets repeat up to eight aggregates in their Batch and Working tables. Legacy issued layout versions retain their existing renderer. Rows remain aggregates → Filler → Resin → Hardener.
- Released Filler substitution, percentages, binder quantities, preserved Batch yield, package capture, version/issue history and zero Inventory mutation remain intact.

## Migration

After the released Sample sequence through `20261001160000_sample_four_to_one_baseline_correction.sql`, apply `20261002120000_sample_normal_resin_profiles.sql` when separately authorized. SHA-256: `a38d99fe3b323a8f709e0b491343ed09c8e0eb5315be1f76c2c8462df53be868`. Validated on a fresh disposable database and applied to the localhost review database only. No historical Sample backfill.

## Focused Tier 3 validation

Passed: handler authentication/Admin rejection and immutable source selection; pure profile/vendor/synchronization cases; profile migration and released lifecycle checks including version restore, immutable issues and later profile changes; preserved 5:1/4:1 Filler rules; PDF page counts and visual review; actual localhost profile/vendor/text/catalog/save/reopen checks; Admin/member UI and local denial; TypeScript, targeted ESLint, diff check and webpack Production build. Local catalog entries are explicitly disposable review data, not a claim of a full hosted catalog mirror. No fixture rows are Production seeds.

Review: `http://localhost:3000/samples`. Library contains MTT, Key Resin, Terroxy and Sherwin “Gio review” drafts. Cement is selectable for incomplete-profile preview but cannot be applied without required inputs. Local generated PDFs and browser screenshots are under ignored `output/pdf/gio/`.

## Exact implementation boundary

- `src/modules/samples/ProductionBatchOutput.tsx`
- `src/modules/samples/SampleWorkspace.tsx`
- `src/modules/samples/formulation.ts`
- `src/modules/samples/operational-profile-model.ts`
- `src/modules/samples/resin-identity.ts`
- `supabase/functions/generate-sample-pdf/index.ts`
- `supabase/functions/_shared/sample-working-compact-pdf.ts`
- `supabase/migrations/20261002120000_sample_normal_resin_profiles.sql`
- `scripts/verify-production-batch-handler.mjs`
- `scripts/verify-sample-gio.mts`
- `scripts/verify-sample-gio-lifecycle.mjs`
- `scripts/verify-sample-gio-browser.mjs`

This document is the separate documentation boundary. Root's three Geometry duplicates and prior unique filler investigation are preserved untouched and excluded.

## Backlog — not implemented

Production Batch/Blend Sheet V2: investigate what the commonly described 1000-lb Blend includes, whether filler/binder are included, its planning/purchasing/staging/mixing meaning, relationship to canonical Batch, and bag rounding. Do not infer `1000 / Batch weight` Batches. Future aggregate presentation should emphasize catalog-driven bag quantities; binder presentation should emphasize gallons. Preserve package/Inventory architecture without Inventory mutation. Pool Mix and binder-changing edge cases remain separate.
