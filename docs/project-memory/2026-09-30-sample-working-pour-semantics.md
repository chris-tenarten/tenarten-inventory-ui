# Sample size and Working Pour semantics

> **SUPERSEDED FOR PRODUCT BEHAVIOR — October 1, 2026.** Retain this report as historical evidence; the body records the assumptions and decisions at its original date. Consult the [current Batch-first authority and final reconciliation](2026-10-01-sample-batch-first-authority.md) first. Common MTT now uses canonical Batch **180 lb chips / 50 lb filler / 5 US gal A / 1 US gal B**; its representative shop Sample filler is **18 oz**. References below to 16-oz MTT filler, a fixed 80-oz dry pool, Sample-first authority, Production reverse-scaled from Sample constants, or coordinated filler→chip/density substitution describe superseded/legacy behavior, not the new workflow. Original source quantities and findings are not rewritten.

The subsequent [final Batch and Working Pour contract](2026-09-30-sample-batch-working-pour-contract.md) governs V1 design. Chris chose to retain all three geometry/metadata concepts, clarify their presentation, and configure 180 lb as the common MTT Batch chip basis. The field-meaning question below is therefore not a blocker for V1.

The material calculator intentionally uses Working Pour geometry independently of finished pieces. The representative one-6x6 header is not wired to either the structured finished-piece inputs or the pour. That separation is observable in source, persistence and PDF output. It does not establish an operational rule that every one-piece request needs a 1-SF pour.

The strongest conclusion is **intentional pour-driven calculation with an unresolved and confusing document-header contract**. There is no evidence of a missing multiplier inside the volume engine. There is also no recovered Product rule defining the header quantity as pieces to deliver, pour count, retained Samples, or another distinct quantity. Do not invent one to explain away the mismatch.

## Current Product direction

Chris explicitly directed this follow-up on September 30: existing historical formulation profiles remain authoritative, including 16-oz MTT filler; the Anthony 51.x recollection is non-blocking. Initial Batch mode should expose production-scale provenance for the same captured formulation. It must not replace validated Sample constants with approximate handwritten Batch amounts.

This supersedes any implication in the [initial reconstruction](2026-09-30-sample-batch-formulation-reconstruction.md) that recovering 51.x or adopting 180/50/5/1 is required before the Batch/Sample model can progress. It does not authorize implementation, migration or release.

## Three separate sets of fields

| Fields | Current role | Effect on calculated material quantities |
| --- | --- | --- |
| `sampleSize`, `sampleQuantity` / `sample_size`, `sample_quantity` | Free-text document headers, recent-value suggestions, persisted independently | None |
| `finishedPlateWidth`, `finishedPlateLength`, `finishedPlateQuantity` | Structured intended finished pieces; calculates displayed finished area | None when pour stays unchanged |
| `width`, `length`, `dimensionUnit`, `thicknessIn` | Actual production/Working Pour dimensions; thickness also appears with finished pieces | Determines pour volume and ordinary profile component quantities |

“Working Pour” here refers to the UI's existing “Production Pour”; it is Sample mixing geometry, not a canonical Production Job or a production Batch count.

The header controls in [SampleWorkspace](../../src/modules/samples/SampleWorkspace.tsx) call the generic field patcher (line 220) for `sampleSize` and `sampleQuantity` (lines 830–846). That patcher changes only the selected top-level field. The formulation editor passes a separate formulation object. No parser or synchronization path translates header text into finished or pour geometry.

[New local Samples](../../src/modules/samples/types.ts) start with blank header size/quantity but populated formulation defaults. The [save/map functions](../../src/modules/samples/queries.ts) preserve both sets independently. The original September 1 generator migration already had free-text header fields; the September 17 [geometry-default migration](../../supabase/migrations/20260917_002_sample_draft_library_identity.sql) added structured defaults of four 6x6 pieces and a 12x12 pour at 3/8. The current density-profile SQL retains independent header and geometry storage. This explains how the duplicate concepts accumulated; it is not evidence of an approved distinction between “requested” and “manufactured” quantity.

The [calculator](../../src/modules/samples/formulation.ts) computes:

`finishedArea = finishedWidth x finishedLength x finishedQuantity / 144`

`pourArea = pourWidth x pourLength / 144` for inch dimensions

`pourVolume = pourArea x thickness / 12`.

Only pourVolume feeds ordinary profile-default materials. The [UI](../../src/modules/samples/SampleFormulationConfigurator.tsx) explicitly displays structured finished pieces, production pour dimensions, and “Total area” from **finishedArea**, while the [PDF summary](../../supabase/functions/_shared/sample-work-order-pdf-model.mjs) prints “Area” from **pourArea**. Identical-looking area labels can therefore refer to different values.

## Evidence that the separation is deliberate

The [guided tutorial](../../src/modules/samples/SampleFormulationTutorial.tsx), introduced by commit `24d69fe` on September 21, states:

> Finished Pieces and Production Pour are related operationally, but they are separate inputs in TenOps.

It also explicitly says changing Finished Pieces alone does not change material requirements when the pour remains unchanged. Its standard example is four 6x6 pieces from a 12x12x3/8 pour. The [tutorial verifier](../../scripts/verify-sample-formulation-tutorial.mts) asserts that production pour, not finished-piece area, calculates material quantities. This is strong evidence of deliberate implemented design, although repository copy is not proof that an operator intended a particular saved pour.

No minimum mix volume, automatic standard-pour selection based on requested count, cutting allowance, spare-piece policy, or automatic packing/yield rule was found in the inspected calculation, validation and defaults paths. A default 12x12 footprint is configurable, not a demonstrated mandatory minimum.

## Historical formulation evidence

Source: `/Users/chrisngo/my stuff/Jobs/2026 Sample Plate Formulations.pdf`. Prior inspection rendered pages 1, 2, 19 and 26. This follow-up parsed the FIN. PCS block on all 83 pages and visually inspected page 48. The parse compares printed area with nominal piece dimensions times count; it does not reconstruct missing spreadsheet formulas or prove cutting yield.

All 83 pages yielded a parseable finished-piece block: 35 show four pieces, 45 show two, two show three, and one shows six. **None shows one piece.** On 78 pages the printed SF equals nominal finished area. Five disagree: pages 30, 33, 48, 53 and 56. These are source inconsistencies or potentially separate working footprints, not established allowance policies.

| Page | Finished-piece annotation | Pour and quantities | Finding |
| --- | --- | --- | --- |
| 1 | Four 6x6 at 3/8 | 12x12; 1 SF; 64 oz chips | Standard example aligns pieces and pour. |
| 26 | Two 6x6 at 3/8 | 6x12; .5 SF; 32 oz chips; Sherwin filler/resin/hardener 8/8/2 | Historical pour is resized; no universal 1-SF rule. |
| 19 | Two 6x6 at 3/4 | 6x12; .5 SF; 64 oz chips; MTT 16/15/3 | Same pour volume as 1 SF at 3/8, preserving the MTT profile quantities. |
| 48 | Two 6x6 at 3/8 | Visually confirmed 12x12; printed 1 SF and .031 CFT; 64/18/15/3 | Historical example of a working footprint larger than annotated finished area. Could be intended surplus or stale annotation; reason is not stated. |
| 82 | Six 6x6 at 3/8 | 12x18; 1.5 SF; 96/24/24/6 | Larger count is accompanied by a larger pour in the source. |

Page 48, T26-238-A, is Terroxy and requested by Anthony. It directly defeats an assertion that finished-piece area always equals the historical calculation footprint. It does not prove that one requested piece always uses four pieces' worth of material. Conversely, pages 26 and 82 establish that historical calculations were not universally frozen to 1 SF.

The other four mismatches from text extraction are: pages 30/33 show two 12x6 pieces but .5 SF; p53 shows two 12x12 pieces but 1 SF; p56 shows two 6x6 pieces but 25 SF. Do not derive a standard scaling rule from these anomalies.

## Saved Sample and representative PDF

The previously captured September 29 read-only result `/tmp/tenops-gio-sample-forensics/scoped.json` contains a September 17 saved V1 Sample with:

- Header: size `6x6`, quantity `1`.
- Structured finished pieces: width `6`, length `6`, quantity `4`, finished area `1` SF.
- Pour: width `12`, length `12`, thickness `.375`, area `1` SF, volume `.03125` CFT.
- Chip loading `128`, target `4` lb / `64` oz; no working versions or issued documents in the captured result.

This is raw persisted evidence of the three-way distinction, not just a report summary. Its captured date is September 29; no new hosted query was performed and present hosted state is not claimed. The legacy binder-unit problem remains separate from this geometry finding.

The September 30 `/Users/chrisngo/Downloads/Sample-Working.pdf` independently shows header one-6x6, MTT profile, Area 1 SF and 64/16/15/3. The PDF alone does not expose its structured finished quantity or establish that it is the same saved record. Do not transfer the older record's count of four into the September 30 document as a verified fact.

The current PDF model copies header size/count verbatim and renders pour area in the formulation summary. It omits the structured finished count and explicit pour width/length. Thus it can present quantities correctly calculated for a 1-SF pour while looking like a one-piece recipe. Current output validation checks formulation readiness and percentages but does not reconcile header quantity, structured quantity, or nominal finished area versus pour area.

## Focused current behavior replay

At the unchanged MTT profile, the local calculator and PDF model produced:

| Edit | Header quantity | Structured finished count | Pour area SF | Chips / filler oz | Resin / hardener fl oz |
| --- | ---: | ---: | ---: | --- | --- |
| New defaults | blank | 4 | 1 | 64 / 16 | 15 / 3 |
| Header set to one 6x6 | 1 | 4 | 1 | 64 / 16 | 15 / 3 |
| Header changed to eight 6x6 | 8 | 4 | 1 | 64 / 16 | 15 / 3 |
| Structured count changed to one | blank | 1 | 1 | 64 / 16 | 15 / 3 |
| Pour changed to 6x6, structured count one | blank | 1 | .25 | 16 / 4 | 3.75 / .75 |

All five pass the current Working PDF readiness validator. The eight-piece header case proves there is no current automatic adequacy check; it is not proof that an operator should pour this amount for eight pieces. The PDF model preserves the one-piece header with “Area 1 SF.” Tests did not save, issue, generate a hosted PDF or mutate records.

The first temporary assertion incorrectly searched for any “12” to detect dimensions and matched density 128; corrected it to inspect the explicit dimension/Production Pour labels. Final replay passed. The existing tutorial verifier also passed. Previous unchanged historical-parity/reactivity results were reused rather than rerun.

## Recommendation for the initial Batch and Sample model

Preserve the current Working Pour as the quantity driver. The initial Batch projection should use the same captured profile quantities and units. For example, projecting the ordinary MTT 1-SF pour's 64/16/15/3 to a **180-lb chip reference scale** gives 180 lb chips, 45 lb filler, 5.2734375 gal resin and 1.0546875 gal hardener. That is an exact projection of MTT, not a claim that Anthony executes a 180/50/5/1 Batch. Do not round these into a different recipe or label an arbitrary display basis a historically verified production standard.

A versioned reference basis and its source can be captured when established. Unknown production provenance should remain visible; the existing volumetric profile already provides a mathematically sufficient scaling basis. No 51.x answer is needed for this step. Preserve overrides and historical calculation-version semantics instead of silently applying current defaults to every captured record.

For geometry, the smallest proposed clarification is to expose **Working Pour 12x12 x 3/8, 1 SF** directly beside the working quantities in both UI and PDF, and separately identify intended finished pieces. This explains what Marcos is mixing. It preserves the calculator and does not require automatic resizing.

The remaining Product decision is narrower than a calculator redesign: **are the free-text header Sample Size/Quantity and structured Finished Pieces intended to describe the same output?** If yes, use one authoritative definition for future authoring and PDF display, with an explicit reconciliation of existing mismatches. If they mean requested delivery versus planned production, give them those distinct approved names and preserve both. The available evidence does not authorize choosing that meaning or silently synchronizing historical data.

An optional future action to size the pour from desired pieces would require an explicit packing/allowance rule and an operator-visible before/after calculation. It must not multiply an already-sized pour by finished quantity. No such feature is necessary for the first projection-only Batch mode.

## Boundary and verification

Inspected unchanged dev HEAD `af334e42076311501fbab464180fa6d799cbcc4b`. This remains a Tier 3 calculation-contract investigation, with documentation-only changes and focused local semantic checks; no full Testing Level 3 release gate claimed. Source, SQL definitions, Git history, saved evidence and original PDF were inspected. No browser execution, fresh hosted read, code changes, migration, data mutation, commit, push or deployment occurred. Evidence is saved in [geometry results](evidence/2026-09-30-sample-working-pour-semantics.json). All pre-existing unrelated work was preserved.
