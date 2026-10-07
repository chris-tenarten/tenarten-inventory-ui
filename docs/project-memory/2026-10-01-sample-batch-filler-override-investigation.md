# Batch-first filler/chip overrides — investigation, not implementation authority

**October 1, 2026. The common MTT displacement/yield rule remains unconfirmed. All doubled-MTT arithmetic below is conditional, not an approved recipe. No application or migration changes were made.**

Chris now requires individual formulations to support legitimate Batch overrides, downstream of a managed profile baseline and upstream of both Production and Working Sample projections. This requirement does not authorize restoring Sample-side fixed-pool adjustment. The [accepted Batch-first baseline](2026-10-01-sample-batch-first-authority.md) remains unchanged. Candidate examined: `674347b589e350cbe4dac07ede64654465a6c29a`.

## Recovered source evidence

Source: `/Users/chrisngo/my stuff/Jobs/2026 Sample Plate Formulations.pdf`, SHA-256 `e761f2cf92d5cd9ac2d616464d23ff7505bbe82615b578fd0fc125c1cd10432b`. All 83 pages were text-extracted; pages 43, 45 and 78 were visually inspected. Page numbers here are one-based PDF pages.

The strongest evidence is an actual before/after pair, **Key Resin**, Clinton Middle School project 26-0126, requested by Anthony:

| Captured value | Page 45: T26-240-A, March 23 | Page 43: T26-240-B, April 15, “INCREASED FILLER” |
| --- | ---: | ---: |
| Working geometry | 6 × 12 × 3/8 inch | Same |
| Volume | 1/64 CFT | Same |
| Chips | 32 oz | 28 oz |
| SF-20 filler | 9 oz | 13 oz |
| Part A / B | 7.5 / 1.5 fl oz | Same |
| Chip loading | 128 lb/CFT | 112 lb/CFT |
| Chip rate at 3/8 inch | 4 lb/SF | 3.5 lb/SF |
| Upper Batch chip table | 200 lb | 200 lb |

The same 30/45/25 Canadian New Royal Green blend, matrix and geometry remain. Added filler is 4 oz; chips fall 4 oz; dry mass remains **41 oz**. Loading follows `32/16 ÷ (1/64) = 128` versus `28/16 ÷ (1/64) = 112`. Binder quantities and 5:1 ratio remain unchanged. Page 21, T26-257-A, independently labels the same 28/13/7.5/1.5 pattern “INCREASED FILLER.”

This supports **equal-mass chip/filler substitution at unchanged geometry and binder for this Key Resin formulation**. It is not an MTT doubled-filler Batch record. Flattened sheets do not establish which input drove the calculation.

The unchanged upper 200-lb table cannot safely be called the resolved modified Batch. An unlabeled right-hand reference column changes chips/filler from 88.88/25.00 to 77.77/36.11, preserving its printed dry sum of 113.88; A/B remain 2.50/0.50. Its dry quantities imply approximately 44.444 times the Working masses, while A implies 42.667 times the Working volume. It therefore does **not** supply a uniformly scaled, exact complete Batch recipe. Do not reverse-scale convenient Sample values to invent one.

Applicability limitation: page 78, MTT Coca-Cola T26-219-A, Anthony, January 29, records 12 × 12 × 3/4 inch, chips 128 oz, filler 72 oz, binder 30/6, and loading 128 lb/CFT. Normalizing solely for comparison to half that volume gives 64/36/15/3. Higher filler here does not imply reduced chip loading. This is not a matched before/after pair and does not disprove Anthony's coordinated MTT case; it prevents treating all high-filler formulations as one universal substitution rule.

## Conditional common MTT example — requires operational confirmation

Assumptions requiring confirmation together: added filler replaces chips **1:1 by mass**; resolved Batch volume/coverage stays at the baseline; A/B remain 5/1 US gal. Conserving dry mass alone does not prove physical yield: packing, constituent densities and binder also matter.

| Quantity | Profile baseline | Conditional doubled-filler formulation |
| --- | ---: | ---: |
| Chips, 100% of authored blend | 180 lb | `180 − (100 − 50) = 130 lb` |
| Filler | 50 lb | 100 lb |
| Dry mass | 230 lb | 230 lb |
| A / B | 5 / 1 US gal | 5 / 1 US gal |
| A:B | 5:1 | 5:1 |
| Resolved Batch volume | `180/128 = 45/32 CFT` | 45/32 CFT, **only under preserved-yield rule** |
| Coverage at captured 3/8 inch | 45 SF | 45 SF, same qualification |
| Current chip loading | 128 lb/CFT | `130/(45/32) = 832/9 ≈ 92.4444 lb/CFT` |
| Current chip rate | 4 lb/SF | `130/45 = 26/9 ≈ 2.8889 lb/SF` |

180 lb and 128 lb/CFT remain captured **baseline** references; current formulation chips become 130 lb. The derived 92.4444 value describes current chip mass per resolved Batch volume, not a changed physical particle density or whole-mixture density. Never overwrite the managed baseline to represent it.

A 1-SF, 3/8-inch Working Pour is `1/32 CFT`. Its fraction must use the **resolved current Batch volume**: `(1/32)/(45/32) = 1/45` in this conditional case.

| Component | Exact Working projection |
| --- | ---: |
| Chips | `130 × 16/45 = 416/9 ≈ 46.2222 oz` |
| Filler | `100 × 16/45 = 320/9 ≈ 35.5556 oz` |
| A | `5 × 128/45 = 128/9 ≈ 14.2222 fl oz` |
| B | `1 × 128/45 ≈ 2.8444 fl oz` |
| Dry mass | `736/9 ≈ 81.7778 oz` |

Unchanged authored 40/30/20/5/5 partitions 130 lb into **52/39/26/6.5/6.5 lb**, projected to **18.4889/13.8667/9.2444/2.3111/2.3111 oz** (display rounding only; exact fractions sum to 416/9).

Architecture trap: V5 currently derives Batch volume from chip target/loading in `supabase/functions/_shared/sample-batch-first.mjs`. Setting only target to 130 while keeping loading 128 instead derives **32.5 SF**, fraction **2/65**, chips still **64 oz**, filler **49.2308 oz**, A **19.6923 fl oz**, B **3.9385 fl oz**. That is a different yield rule, not the conditional preserved-yield recipe. A future resolver must explicitly capture yield policy, not accidentally inherit this result.

## Shop quantities

35.5556 oz → 36 oz filler is a plausible shop instruction, **not yet confirmed for this modified recipe**. Neither chip rounding nor automatic reuse of baseline 15/3 fl oz is established for the modified formulation. Retain exact projections and separately capture approved practical measurements. Do not invent universal ceiling/nearest rounding or rebalance chips after shop rounding.

Doubling rounded baseline shop filler 18 → 36 within an 82-oz shop pool gives 46 oz chips. Scaling those numbers up produces 129.375/101.25 lb, not the conditional canonical 130/100 lb. The old MTT 80-oz pool with 16 → 32 gives 48 oz chips and reverse-scaled 135/90 lb. Neither establishes the new Batch recipe. Never subtract binder fluid ounces from dry mass ounces.

## Proposed contract, pending rule confirmation

1. **Profile:** versioned baseline quantities, loading/reference thickness and supported override rules. Rules explicitly name conservation basis/units, chip displacement, yield policy and binder policy. No cross-profile inference from Key Resin to MTT.
2. **Individual formulation:** explicit Batch filler override, selected supported rule, reason/actor and captured profile revision. No global profile mutation or Admin requirement merely to formulate one Sample. Where the rule derives chips, do not permit independently contradictory chip inputs.
3. **Resolved Batch:** server-validated quantities for all components, binder ratio, volume/yield basis, reference thickness, derived current chip loading/rate, rule version and per-value provenance. Distinguish baseline, authored override and dependent derived changes. Missing authority remains explicit; do not silently use an 80-oz pool. The existing captured-profile contract must not be bypassed by treating arbitrary client edits to profile JSON as legitimate overrides.
4. **UI:** explicit “Modify Batch formulation” with baseline/current comparison and “Restore profile defaults.” Show “Profile default,” “Current formulation Batch quantity,” and “Modified/override.” Preview dependent chips, yield and binder effects before applying. Keep CHIP BLEND treatment and authored percentages; its 100% quantity reflects the resolved current chips, while baseline 180 remains identified as baseline. Working shop edits continue to leave Batch unchanged.
5. **Snapshots/history:** capture baseline revision, override inputs, versioned rule, resolved complete Batch, yield semantics, exact projections, shop instructions and catalog/package metadata. Working saves, duplicates, issued versions and history retain that capture. Later managed-profile changes never reinterpret it. Adopting a new profile revision is explicit. Legacy records replay their existing version; no backfill of hypothetical MTT rules.
6. **Documents:** Production Batch Blend Sheet reads the resolved current Batch directly, including override provenance and package equivalents from captured package data. Working Sample Sheet scales that same Batch using its resolved volume and then presents approved shop quantities. Both use one captured formulation. Missing required rule authority must not result in an apparently authoritative modified recipe.

## Legacy business logic assessment

Commit `f800eeab9e4f5173421e38b11efc940638dd3bf8` introduced `previewIncreasedFillerAdjustment` in `src/modules/samples/formulation.ts`: chips = profile-derived Working dry pool − requested Working filler; effective chip loading = chips/16/Working volume. The accompanying reactivity test specifically verifies **32 + 9 → 28 + 13**, loading 112, matching the Key Resin pair. Its dry pool was profile-specific, not universally 80 oz: the generic half-size case used 41 oz, ordinary MTT used 80 oz at the representative full volume, and high-filler MTT used a different pool.

The mass-conservation identity is reusable **only if the relevant Batch rule is confirmed**, re-expressed at Batch scale. Unit conversions and percentage allocation can be reused. The Sample-side helper, profile pool inference and effective-density mutation remain legacy-only; do not call them to resolve a new Batch override.

The historical corpus verifier derives effective loading from recorded chip mass and volume and supplies recorded filler/binder. It proves replay consistency, not an independently recovered operational displacement rule. Earlier Sample-side acceptance instructions are implementation history, not stronger authority than the source or Chris's current Batch-first direction.

## Only unresolved operational facts

- Does common MTT specifically replace each added pound of filler with one pound of chips (50 → 100 filler means 180 → 130 chips), or use another displacement relationship?
- Does that modified MTT Batch retain 45-SF coverage at 3/8 inch and 5/1-gal binder, or change yield and/or binder? The Key Resin Working pair supports an analogy, not proof of this complete MTT Batch rule.
- What practical chip, filler and A/B measurements are approved for the modified Working Sample? Is 36 oz filler and continued 15/3 fl oz intended, and how are chips measured?

An authoritative modified Batch record or explicit operational confirmation can settle these. The 51.x anecdote is closed and was not pursued. Ownership, Batch-first direction and individual override permission are already decided.

## Validation and scope

Tier 3 subject, read-only investigation. Exact rational arithmetic checks passed for the source pair, conditional MTT conservation/volume/yield/fraction/components, aggregate reconciliation and unchanged-loading counterexample. Source visuals and candidate resolver were inspected; no new behavior was implemented or browser-tested. No application builds or broad suites were necessary. No hosted access/mutation, migration application, push, deployment or release. Accepted candidate remained clean and unchanged. This report is uncommitted investigation memory, not a release artifact or fixture seed.
