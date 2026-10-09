# Sample geometry: independent arithmetic and validation visibility

Local review against `ed7db7ff5e9039432badbf7d38fb5b9d95853e6f` plus accepted ContextHelp polish. Tier 2 focused review and validation-presentation correction. No release authority.

## Result

PASS: independent arithmetic and combined multi-input browser flow. No geometry/material arithmetic or stale-state defect found. Existing Batch-first engine and snapshot/PDF/persistence contracts unchanged.

The arithmetic reference ledger was calculated separately using Python rational fractions, then compared with the implementation. No tested implementation function supplied expected footprints/fractions. Basis was the captured fixture contract: 180 lb chips, 128 lb/CFT, 50 lb Filler, 5/1 US gal binder, shared 3/8-inch thickness. `scripts/verify-sample-pour-integrity.mts` records all expected arrangements, footprints and rational Batch fractions; each case checks area, finished/pour CFT, chips, exact Filler/A/B and exact dry quantity.

| Case | Expected footprint (in) | Expected CFT | Expected Batch fraction | Chips oz | Actual |
|---|---|---:|---|---:|---|
| A four 6×6 | 12×12 | .03125 | 1/45 | 64 | Match |
| B six 6×6 | 18×12 | .046875 | 1/30 | 96 | Match |
| C four 8×8 | 16×16 | .0555555556 | 16/405 | 113.777778 | Match |
| D eight 8×8 | 32×16 | .1111111111 | 32/405 | 227.555556 | Match |
| E four 4×8 | 8×16 | .0277777778 | 8/405 | 56.888889 | Match |
| F seven 6×6 | 6×42 | .0546875 | 7/180 | 112 | Match |
| G uniform rotation | 8×16 | .0277777778 | 8/405 | 56.888889 | Match |
| H locked width 12 | 12×64 | .1666666667 | 16/135 | 341.333333 | Match |
| I locked length 20 | 12×20 | .0520833333 | 1/27 | 106.666667 | Match |
| J maxima 12×12 | 12×12 | .03125 | 1/45 | 64 | Match |
| K 1-inch outer edges | 14×14 | .0425347222 | 49/1620 | 87.111111 | Match |
| L .25-inch separation | 12.25×12.25 | .0325656467 | 2401/103680 | 66.694444 | Match |
| M combined allowances | 14.25×14.25 | .0440673828 | 361/11520 | 90.25 | Match |
| P first multi-edit calculation | 12×64.875 | .1689453125 | 173/1440 | 346 | Match |
| Q recalculated constraints | 17.25×33.75 | .1263427734 | 23/256 | 258.75 | Match |

N inches/feet round trip preserved size; O impossible constraints returned no alternatives; R Apply preserved finished specs/profile/manual quantities. Ranking tests from the foundation remain applicable; this pass did not alter ranking.

Exact Q quantities: chips 258.75 oz, Filler 71.875 oz, A 57.5 fl oz, B 11.5 fl oz, dry 330.625 oz. Manual shop Filler 22 oz remained 22 through edits/Apply/units; it was not confused with exact Filler.

## Confirmed visibility issues and narrow corrections

- Chip Blend previously displayed its Batch target near the editor but not a live over/under reconciliation explanation there. It now shows `100% / 100%`, `120% / 100%` plus `Blend exceeds 100% by 20%. Reduce aggregate percentages.`, or `85% / 100%` plus `Blend is 15% short of 100%.` Presentation consumes the existing calculator reconciliation flag, retaining tolerance, precision and temporary blank editing.
- Sample action controls are sticky beneath the existing shell. A compact attention summary appears only when relevant issues exist. Items scroll/focus their responsible control/section. Existing operation errors now appear by actions rather than only above the long workspace.
- Invalid geometry values receive field-adjacent messages and accessible invalid-state descriptions. Values remain authored. This is feedback, not a new persistence/issuance contract: legacy save/output gates remain as implemented. The existing output validator does not uniformly hard-block every nonpositive/fractional finished-geometry case; this broader lifecycle rule was not invented here. Blank Working Pour values already cause incomplete preparation, and the existing blocking path is preserved.
- Missing new-draft Resin System, Prepared By and existing preparation/binder issues are surfaced near their sections. Missing aggregate identity is explicitly a Production requirement, not a new Sample-save requirement. Existing profile incomplete/missing-basis controls remain authoritative.
- Production Batch/ADJ/Blend Size errors remain inline, gain accessible descriptions and sticky-summary links. Invalid Batch Count no longer misleadingly blames ADJ as a second error. Generation gating/arithmetic is unchanged. Missing Batch/material authority is linked to its existing explanation.
- Planner no-fit messages list actual active locks/maxima/arrangement/allowances. Invalid allowance/limit messages identify the field. Invalid requested-planning results are errors; stale suggestions and insufficient physical volume remain warnings; unsupported independent thickness remains informational/unavailable.

## Evidence and scope

- `verify-sample-pour-integrity.mts`: independent A–R ledger and presentation helpers passed.
- `verify-sample-pour-integrity-browser.mjs`: one combined actual-UI flow passed 100/120/85/decimal totals; percentage blank/select-all/Backspace/Delete/replacement/wheel/no redistribution; sticky summary visible while scrolled to Production and click-to-focus; invalid geometry; new draft missing profile; Production Batch Count/ADJ/Blend Size errors and correction; no write on blocked Sample generation; multi-edit P/Q expected results; invalidation after count, both finished dimensions, thickness, both pour dimensions, both locks, both maxima, arrangement, rotation, both allowances; no regeneration on revert; recalculated Apply; unchanged manual Filler; unavailable thicker-pour control. No save/issue RPC was emitted.
- TypeScript, targeted ESLint, whitespace diff check and local export build passed. A missing required test-fixture Prepared By argument and an allowance accessible-name locator were corrected during verification; neither required an application behavior correction.
- Existing ContextHelp polish is included in this local commit. The older focused browser assertion was updated to the new concise invalidation copy.
- No broad PDF, history, authorization, migration or Production Blend suites. No hosted checks or mutations. Cross-browser/mobile permutations beyond earlier candidate evidence were not rerun. The final planner error-color/alert-role adjustment received compile/lint/build verification; browser behavior evidence precedes that presentation-only adjustment.

Mathematically verified is not shop-validated. Actual molds, cutting/edge allowances, grinding losses, measured yield and independently authored rough thickness remain shop/Product authority. Independent thickness remains deferred pending a reviewed persisted/captured/renderer contract; no migration.

Review remains `http://localhost:3011/samples?open=0e1adb4f-9402-44ee-aff9-e82ab3b3b367` on disposable local PostgreSQL. Material Readiness candidate `bae6d7b...` and port 3000 are preserved. No push, deployment or release.
