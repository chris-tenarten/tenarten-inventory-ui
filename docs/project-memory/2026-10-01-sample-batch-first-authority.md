# Sample formulation — current Batch-first Product authority

**KEEP — canonical/current. Confirmed by Chris on October 1, 2026.** Read this decision before the September 30 discovery reports or initial Batch/Working Pour contract. It records the latest explicit Product direction and points to the final reconciliation; it does not authorize a release or claim hosted state.

## Authority and implementation evidence

Product flow: **canonical operational Batch → exact Working Pour projection → practical shop Sample quantities**. Production reads the canonical Batch directly. Practical Sample measurements must not be reverse-scaled into Production authority.

The final reconciliation and implementation evidence are already committed in accepted candidate `674347b589e350cbe4dac07ede64654465a6c29a`:

- `docs/project-memory/2026-09-30-full-formulation-batch-reconciliation.md`
- `docs/project-memory/evidence/2026-09-30-full-formulation-reconciliation.json`

They are not yet present on this root workspace's `dev` branch. Read their immutable candidate versions rather than treating an older root document as current:

```sh
git show 674347b589e350cbe4dac07ede64654465a6c29a:docs/project-memory/2026-09-30-full-formulation-batch-reconciliation.md
git show 674347b589e350cbe4dac07ede64654465a6c29a:docs/project-memory/evidence/2026-09-30-full-formulation-reconciliation.json
```

The candidate's formulation version is `sample-formulation-v5-batch-first`. Reinspect the actual checkout and captured contract before implementation work. Candidate test results describe that candidate and test environment, not deployed Production. Chris's newer explicit decisions take precedence over all written records.

## Common MTT baseline

| Input / derived value | Authority |
| --- | --- |
| Batch chips | 180 lb = 100% of the operator-authored chip blend |
| Batch filler | 50 lb / one 50-lb bag |
| Batch Part A | 5 US gal |
| Batch Part B | 1 US gal; captured 5:1 A:B relationship |
| Chip loading | 128 lb/CFT |
| Batch reference thickness | 3/8 inch |
| Batch coverage | **Derived:** 180 ÷ 128 ÷ (0.375 ÷ 12) = 45 SF |
| Chip rate | **Derived:** 180 ÷ 45 = 4 lb/SF |

These are profile/capture-specific. Other profiles and missing historical captures must not inherit MTT values. Operator-authored percentages partition the chip blend; filler is outside its 100%. No percentage permutation is a profile default merely because it is an acceptance fixture.

For the representative 1-SF Working Pour at 3/8 inch, the Batch fraction is 1/45:

| Component | Exact Working projection | Representative shop measurement |
| --- | ---: | ---: |
| Chips | 64 oz | 64 oz |
| Filler | 800/45 oz ≈ 17.7778 oz | **18 oz, not 16 oz** |
| Part A | 640/45 fl oz ≈ 14.2222 fl oz | 15 fl oz |
| Part B | 128/45 fl oz ≈ 2.8444 fl oz | 3 fl oz |

The shop measurements are explicit representative instructions, not a universal rounding algorithm. Exact dry quantity is 64 + 800/45 ≈ 81.7778 oz; representative shop dry quantity is 82 oz. **A fixed 80-oz dry pool is not a new-model invariant.**

Working Pour is downstream of captured Batch authority and actual pour geometry. Finished Plates and free-text Sample Size/Quantity do not independently scale that pour. Shop filler edits do not substitute away chips, change canonical loading or alter Batch quantities. Coordinated filler → chip/density substitution remains **legacy behavior**, not the normal V5 workflow.

Historical captures, formulas and source sheets remain evidence of what they actually contained. Preserve their versioned replay and issued history; do not backfill them to pretend they always used the new baseline. Historical Sample quantities can be convenient shop measurements rather than canonical Production inputs. The one-off 51.x filler illustration is neither canonical nor an unresolved blocker.

## Historical records and operational review

The September 30 [reconstruction](2026-09-30-sample-batch-formulation-reconstruction.md), [Working Pour investigation](2026-09-30-sample-working-pour-semantics.md), and [initial Batch/Working Pour contract](2026-09-30-sample-batch-working-pour-contract.md) are retained as **historical evidence, superseded for Product behavior**. Their original claims, calculations and chronology are preserved under prominent notices. Titles such as “final” or “current” inside those bodies refer to their original stage, not today's authority.

For local deletion repair and its verification, consult the dated [Admin Delete review report](2026-10-01-sample-admin-delete-local-review.md) and its linked JSON. September 30 localhost/catalog test records are historical runs, not proof that the same temporary records, catalog snapshot or processes still exist. The October 1 report explicitly records that the old catalog snapshot was not recovered.

Preserve the manual-review convention in [AGENTS.md](../../AGENTS.md): Chris reviews the actual TenOps application at **http://localhost:3000** with a safe local data source. Internal validation ports are not the primary manual-review route.

**Disposable localhost Samples, their material rows, versions, issued documents and generated review PDFs must never be migrated, seeded or copied into hosted Production or included as Production release data.** Test definitions and evidence identifiers are not executable Production seeds. Profile configuration migrations are a separate reviewed boundary. No hosted mutation, migration application, push, deployment or release is authorized by this document.
