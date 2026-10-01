# Sample Batch formulation reconstruction

> **SUPERSEDED FOR PRODUCT BEHAVIOR — October 1, 2026.** Retain this report as historical evidence; the body records the assumptions and decisions at its original date. Consult the [current Batch-first authority and final reconciliation](2026-10-01-sample-batch-first-authority.md) first. Common MTT now uses canonical Batch **180 lb chips / 50 lb filler / 5 US gal A / 1 US gal B**; its representative shop Sample filler is **18 oz**. References below to 16-oz MTT filler, a fixed 80-oz dry pool, Sample-first authority, Production reverse-scaled from Sample constants, or coordinated filler→chip/density substitution describe superseded/legacy behavior, not the new workflow. Original source quantities and findings are not rewritten.

The subsequent [final Batch and Working Pour contract](2026-09-30-sample-batch-working-pour-contract.md) governs V1 design. It records Chris's explicit common-MTT target of 180 lb, retains the existing profile quantities, and resolves the earlier design questions without authorizing implementation.

September 30, 2026. Discovery only. **Chris's subsequent decision:** preserve historical profile quantities, including MTT's 16-oz filler, as authoritative unless stronger exact evidence supersedes them. The unresolved 51.x recollection is non-blocking. Initial Batch mode exposes a production-scale projection and provenance of the same captured formulation; it does not replace historical constants with handwritten approximations. See the [follow-up geometry investigation](2026-09-30-sample-working-pour-semantics.md).

The chip calculation can remain. A Batch view can share the existing formulation and geometry engine. The comparisons below document why Anthony's approximate 180/50/5/1 must not silently replace current profile quantities. Reconciliation is required only before changing those quantities or claiming that approximation as an exact canonical execution recipe, not before developing the initial Batch/Sample model.

The most consequential finding is in the original source itself: the same sheet can show a 200-lb chip Batch column, a 180-lb reference total, 50-lb filler, 5/1-gallon binder, and Sample quantities 64/18 weight oz plus 15/3 fluid oz. These do not all scale by one factor. Current TenOps reproduces the historical Sample quantities for its selected profile; that does not prove exact equivalence to the Batch references.

## Scope and evidence

Inspected dev at `af334e42076311501fbab464180fa6d799cbcc4b`. Local main and cached origin/dev and origin/main resolve to the same commit; no fetch or release performed. Three pre-existing untracked geometry investigation files were preserved. Only this report and its arithmetic evidence were added. No application code, migration, hosted data, commit, push, or deployment changed. Pool Mix and the released PDF row-order fix remain outside scope.

This is Tier 3 subject matter because a later implementation would change calculation and snapshot contracts. This pass used source inspection, original-document visual checks, and focused local calculation verification, not a full Testing Level 3 release gate. Application builds, broad suites, browser and hosted verification were not needed or claimed for this documentation-only investigation.

Evidence in precedence order:

1. **Original source:** `/Users/chrisngo/my stuff/Jobs/2026 Sample Plate Formulations.pdf`, 83 pages. All pages text-extracted and searched; pages 1, 2, 19 and 26 rendered and visually inspected. Other page references below are text extraction. Original spreadsheet formulas behind this PDF were not available. Its adjacent right-hand reference column lacks a clear independent heading; values there are reported as reference values, not silently promoted into canonical fields.
2. **New notes:** the two user handoffs in `.codex/attachments/df55f547-af4e-49f7-aef5-bd2c8dc993ce/Pasted text.txt` and `9b65ef36-7395-40c8-86c1-079edf0aa08d/Pasted text.txt`. No identifiable copies of the two handwritten photos were found in attachments or the scoped reference search. Their 180/50/5/1, 45 SF, 51.x and 1.75 CF descriptions remain transcriptions, not independently verified handwriting. The second handoff ends mid-sentence in item 20 after “Batch reference”; all supplied requirements are addressed here.
3. **Profile definitions:** [density-profile migration](../../supabase/migrations/20260918_004_sample_formula_density_profiles.sql), [managed-profile migration](../../supabase/migrations/20260923160000_sample_operational_profiles.sql), and [profile decision record](2026-09-22-po-allocations-sample-profiles.md). These establish repository seeds and provenance, not today's hosted values. Prior September 29 read-only findings in `/tmp/tenops-pool-mix-investigation/report.md` corroborate the seeds at that date only.
4. **Current implementation:** [calculator](../../src/modules/samples/formulation.ts), [profile capture](../../src/modules/samples/operational-profile-model.ts), [geometry UI](../../src/modules/samples/SampleFormulationConfigurator.tsx), and [PDF model](../../supabase/functions/_shared/sample-work-order-pdf-model.mjs).
5. **Fixtures:** historical-parity, reactivity, ratio-normalization and V4 corpus verifiers under `scripts/`. The corpus verifier's external CSV at `/tmp/tenops-sample-v4-contract/v4-equation-validation.csv` was unavailable, so its 58-case claim was not rerun. Its filler and resin fixture values are supplied manually and chip density is reconstructed from recorded chip mass: it is not independent proof of profile-rate derivation.
6. **Representative artifact:** `/Users/chrisngo/Downloads/Sample-Working.pdf`, both pages extracted, first page visually inspected. It explicitly identifies **MTT 5:1**, 1 SF calculation area, 64/16/15/3, while the header says one 6x6 Sample and the resin supplier says Key. This is a captured profile/material-context mismatch to resolve, not proof of a global filler defect or of Key compatibility with MTT defaults.

The available `Blank Color Plate MANUAL TEMPLATE.xlsx` was inspected read-only. Its sole sheet `10.07.25` has labels and blank manual entry cells, with no formulation calculations. It cannot establish a Batch formula. Prior saved-Sample unit findings were read from `/tmp/tenops-gio-sample-forensics/report.md`; no new historical data or private communications were queried.

## What the original sheets establish

| Source page | Directly observed facts | Implication |
| --- | --- | --- |
| 1, T26-271-A, Key Resin, requested by Anthony | 40/30/20/5/5; Batch column 80/60/40/10/10 = 200 lb; density 128; 4 lb/SF at 3/8; 12x12 pour; four 6x6 pieces; Sample chips 64 oz; filler 18 oz; resin 15 and hardener 3 ounces with gallon equivalents. Right reference totals 177.76, 50, 5, 1. | Exact original counterpart of the representative chip blend. Supports 64/18/15/3 for this historical Key context, not 64/16/15/3. |
| 2, T26-270-F | 200-lb Batch column; Sample 64/18/15/3; right chip references 27/90/45/18 = 180, followed by 50/5/1. | 180 appears in the original source, but coexists with a conflicting labeled 200-lb basis. Supplier header says Sherwin yet the Sample ratio is 5:1. Supplier name alone is insufficient to select a formula. |
| 19, T26-259-A, MTT, requested by Anthony | 6x12 at 3/4; 128 lb/CFT; 64/16/15/3; 200-lb heading; right references 177.76/44.44/5/1. | Direct non-Pool-Mix evidence for MTT's 16-oz filler family, at the same volume as 1 SF at 3/8. |
| 26, T26-252-A, Sherwin, requested by Anthony | Ordinary named chips, ATF-20; 6x12 at 3/8; 32/8/8/2; 150-lb heading and five-gallon batch label. | Direct non-Pool-Mix evidence for 4:1 and 16/4 fl oz at a full SF. |
| 49, MTT | Same-volume 64/16/15/3 and 177.76/44.44/5/1. | Repeated MTT pattern. |
| 82, Sherwin | 12x18 at 3/8; six 6x6 pieces; 96/24/24/6. | Historical 1.5x scale of ordinary Sherwin quantities. |
| 74 and 78 | Different densities/filler loadings: Sherwin 100 lb/CFT with 72 oz filler at 1 SF x 3/4; MTT 128 oz chips with 72 oz filler at that volume. | Profiles vary beyond ratio alone. These are evidence of variation, not the common formula definition. |

The source's 200/150 Batch columns, right reference values, rounded gallon displays and occasional `#REF!` artifacts must be retained as conflicts. Their original cell formulas and intended operational roles cannot be recovered from a flattened PDF.

## Provenance of the important values

| Value | Classification and finding |
| --- | --- |
| 180 lb | Proposed canonical input for Anthony's **typical** Batch, supported by the new transcription and original p2 right reference total. Not a current calculator constant and not proved universal. |
| 45 SF | Derived value if 180 lb and effective chip loading 128 lb/CFT at 3/8 govern the same yield. Transcription associates it with the Batch; no explicit matching coverage rule was recovered from the original PDF/code. |
| 3/8 inch | Historical reference thickness and current geometry input/default. Other thicknesses are supported. |
| 128 lb/CFT | Explicit historical input, retained as profile-specific default **effective chip loading per pour volume**. It is not established as total mixed-material density or intrinsic chip density. |
| 4 lb/SF | Derived `128 x .375 / 12`, explicitly displayed historically. |
| 64 oz | Derived `1 SF x 4 lb/SF x 16`, explicitly displayed historically and currently. |
| 51.x lb filler | Unresolved. No exact value, expression, denominator or originating cell found. Do not invent a percentage to fit this verbal range. |
| 50 lb filler | Original p1/p2 reference value and new operational-rounding transcription. Bag size, rounding increment, application order and universality remain unresolved. |
| 16 oz filler | Historical MTT Sample constant (p19/p49); current MTT rate 512 oz/CFT x 1/32 CFT. Its 25% relationship to chips holds at density 128, but the code does not compute filler as 25% of chips. |
| 18 oz filler | Historical Key/ordinary 5:1 Sample constant; generic profile rate 576 oz/CFT x 1/32. At a 180-lb chip scale this implies **50.625 lb**, not 51.x. |
| 5 gal A, 1 gal B | Original right reference values, corroborated by new typical-Batch transcription. Operational reference inputs pending exact yield/rounding reconciliation. |
| 15 fl oz resin | Historical Sample quantity; profile rate 480 fl oz/CFT x 1/32. No current 5-gallon Batch constant feeds it. |
| 3 fl oz hardener | Derived 15/5 in current code, matching historical Sample output. |
| 5:1 | Historical volumetric proportion, profile/system-specific default and supported manual override. |
| 4:1 | Historical ordinary Sherwin proportion, separate profile default and supported manual override. Does not alone determine absolute A/B demand. |

## Chip equivalence and its limits

`V_batch = 180 / 128 = 1.40625 CFT`; `coverage = 1.40625 / (.375/12) = 45 SF`.

For 1 SF at 3/8, `s = (1 x .375/12) / 1.40625 = 1/45`. Therefore `180 x s x 16 = 64 oz`. The blend yields 72/54/36/9/9 lb at the proposed Batch basis and 25.6/19.2/12.8/3.2/3.2 oz at Sample scale. Percentages apply to the chip portion: this is supported by the historical separate chip total and additive filler/binder rows as well as the new transcription.

**Classification: conditional exact mathematical equivalence for chips, with historical support for the Sample end.** The current implementation is geometry-first and does not contain a recovered 180-to-45 derivation. It is not possible to claim that 180/45 was the historical origin of the code's 4 lb/SF rate. The observed provenance is explicit historical 128, thickness and Sample geometry. At 200 lb with the same loading, 50 SF would also yield 4 lb/SF; Sample arithmetic alone cannot choose the canonical Batch size.

## Filler and binder reconciliation

At the proposed 180-lb chip basis, current profiles project as follows. These are mathematical equivalents of current rates, **not newly approved Batch recipes**.

| Basis | Chips lb | Filler lb | A gal | B gal |
| --- | ---: | ---: | ---: | ---: |
| Current MTT | 180 | 45 | 5.2734375 | 1.0546875 |
| Current generic 5:1 | 180 | 50.625 | 5.2734375 | 1.0546875 |
| Current ordinary Sherwin | 180 | 45 | 5.625 | 1.40625 |
| Anthony's transcribed typical operational Batch | 180 | 50 | 5 | 1 |

MTT's 45 is 10% below operational 50. Generic 50.625 is 1.25% above 50 but does not explain 51.x. Classify current MTT filler as **historically supported, genuinely different from the transcribed typical Batch; insufficient evidence to declare it incorrect**. Generic filler is numerically approximately equivalent to nominal 50, with no recovered operational rounding rule.

Binder ratio matches, but absolute binder quantity does not. Current 15/3 exceeds the exact 5/1-gallon projection at 1/45 by 5.46875%. No source proves that this is an intentional allowance or rounding policy. Scaling 15 fl oz to 5 gal instead gives factor `640/15 = 42.6666667`, hence 170.6666667 lb chips and 48 lb filler for the generic 18-oz family. The filler reference 50 divided by 18/16 gives factor 44.4444444. The p1 177.76-lb chip reference implies 44.44. These different factors demonstrate inconsistency; they do not establish which cell is wrong.

At density 128, `230/128 = 1.796875 CFT`. That does not prove the ~1.75 CF note is an approximation, because 128 is used as chip loading in the Sample model. `230/1.75 = 131.428571 lb/CFT` is only the density that would make those two figures agree, not an evidenced alternative. The original p19 project numbers 7.13 CFT / 4.01 batches imply approximately 1.778 CFT/batch, but rounded project metadata also cannot settle the handwritten note. Finished mixture yield, chip-loading reference volume and loose ingredient volume must not be conflated. Filler density, packing, binder displacement and exact interpretation of 1.75 remain unknown.

## What switching a system actually does

Current corrected V4, for ordinary calculated rows and geometric weight-per-area mode:

`V = production area x thickness/12`

`chips_oz = V x effective_chip_density x 16`

`filler_oz = V x captured_filler_rate`

`A_fl_oz = V x captured_resin_rate`; `B_fl_oz = A_fl_oz x hardener_parts/resin_parts`.

MTT has rates 128 lb/CFT, 512 filler oz/CFT, 480 resin fl oz/CFT and 5:1. Ordinary Sherwin has 128, 512, 512 and 4:1. Repository seeds deliberately leave Key Resin and Terroxy rates unknown and Cement ratio/rates unknown. Source p1 is a historical Key example, not permission to fill every Key product's missing defaults automatically.

| Operation at 1 SF x 3/8 | A fl oz | B fl oz | Total fl oz | Model supported |
| --- | ---: | ---: | ---: | --- |
| Current MTT 5:1 | 15 | 3 | 18 | Profile-specific rate |
| Change ratio only to 4:1 | 15 | 3.75 | 18.75 | Model A, A fixed |
| Apply ordinary Sherwin profile, no manual overrides | 16 | 4 | 20 | System-specific rates plus ratio |
| Hypothetical fixed-total 18 at 4:1 | 14.4 | 3.6 | 18 | Model B, not supported by recovered ordinary examples |

Historical examples support system-dependent quantities, compatible with Model C conceptually. They do not recover a fully consistent canonical A/B Batch definition for every supplier. Current storage implements a resin rate plus ratio, rather than two independently stored Batch components. Manual density/ratio are preserved on profile application; manual row quantities are exceptions to automatic scaling. Thus a bare ratio switch and a system/profile switch must remain distinct operations. Part A as resin and Part B as hardener is the supported correspondence between the note and historical row labels; no supplier-specific technical sheet was independently inspected.

Dry scaling is lb to weight oz (16 per lb). Binder scaling is US gal to fl oz (128 per gal). Historical liquid rows say “ounces” but show gallon equivalents and consistent 15/3 or 16/4 proportions. Current V3/V4 explicitly treats these as volume. No binder density or gallons-to-pounds conversion is needed or justified. The separate saved V1 record with lb binder units and a current fl-oz presentation mismatch is a legacy compatibility issue; it must not be used to infer common liquid recipe amounts.

## Scale proof and geometry

The following conditional projection uses transcribed operational 180 lb chips, 50 lb filler, 5 gal A and 1 gal B, with 128 effective chip loading. It does **not** claim to reproduce unresolved 51.x filler. Each row uses actual pour geometry, with no cutting allowance.

| Pour geometry | Batch fraction | Chips oz | Filler oz | A fl oz | B fl oz |
| --- | ---: | ---: | ---: | ---: | ---: |
| 12x12 x 3/8 | 1/45 | 64 | 17.777778 | 14.222222 | 2.844444 |
| 6x6 x 3/8 | 1/180 | 16 | 4.444444 | 3.555556 | .711111 |
| 24x12 x 3/8 | 2/45 | 128 | 35.555556 | 28.444444 | 5.688889 |
| Three 6x6 plates in an 18x6 pour x 3/8 | 1/60 | 48 | 13.333333 | 10.666667 | 2.133333 |
| 12x12 x 1/2 | 4/135 | 85.333333 | 23.703704 | 18.962963 | 3.792593 |

Current MTT results for these same rows are respectively chips/filler/A/B: **64/16/15/3**, **16/4/3.75/.75**, **128/32/30/6**, **48/12/11.25/2.25**, and **85.333333/21.333333/20/4**. A direct replay of the current calculator verified these results and blend splits. See [arithmetic evidence](evidence/2026-09-30-sample-batch-reconstruction.json).

With fixed rates, `Q_i = k_i V`; multiplying area, thickness or actual pour count by a factor multiplies every calculated component by that factor before display rounding. Historical p19 versus p26/p82 supports volume and size variation; current formula execution proves the code's linearity. This is not proof that every real binder system has an unlimited linear operating range.

**Finished plate quantity currently does not resize the pour.** `finishedPlateWidth x finishedPlateLength x finishedPlateQuantity / 144` produces a separate finished-area display. The operative volume uses `length`, `width` and thickness. Changing count from four to one alone leaves 64/16/15/3 unchanged. The representative PDF really has a 1-SF calculation area despite its one-6x6 header. One 6x6 pour would produce 16 oz chips. Do not multiply current pour geometry by finished count, which would double-count a pour already sized for several pieces. Any future automatic pour sizing/allowance is a separate explicit Product decision.

Manual component quantities, manual weight-per-SF/total chip weight, explicit density adjustments, and operational bag rounding fall outside a single fixed linear profile. Current filler/resin continue to follow pour volume when chip mass is manually overridden. A canonical projection must preserve these as explicit deviations or an approved formulation revision, rather than silently pretending one scale still explains every value. No operational batch-rounding algorithm was recovered; rounding individual Sample quantities to whole bags would clearly be a different rule.

## Minimum architecture recommendation

Keep one captured, versioned formulation. Extend the existing managed operational profile definition with an **approved, system-specific Batch basis**, then capture that basis and provenance into the existing working/issued snapshot flow. Supplier identity alone is too broad: historical Sherwin-labeled records span different behaviors, and the cement transcription describes approximately 200 lb chips plus 100 lb cement with no evidenced epoxy A/B contract.

The existing geometry equations, chip percentage allocation, dry/liquid unit separation, material catalog selection, roles, profile capture and immutable issued history can remain. A view toggle alone can be added without separate recipes once one internally consistent basis is chosen. It cannot resolve conflicting source constants merely by relabeling them.

Recommended ownership and input discipline:

| Concept | Owner and minimum representation |
| --- | --- |
| Chip Batch basis | Versioned formulation-system profile input, in lb. Do not impose 180 globally. |
| Blend percentages and material identities | The captured formulation; percentages sum to its chip portion. |
| Yield/loading | Profile input. Choose effective chip loading OR independently authoritative Batch yield as the governing value; derive the other from chip basis. Preserve independent observed yield as evidence, not a second contradictory driver. |
| Filler | Profile rule or exact amount, once recovered. If rule-derived, do not also allow its result as an independent input. Record nominal operational amount separately only if confirmed as a distinct execution policy. |
| A/B | Profile-specific volume definition. A plus ratio can derive B; two canonical supplier quantities can instead derive ratio. Do not maintain all three as independent inputs. Existing A-rate-plus-ratio represents current behavior adequately until evidence requires more. |
| Reference thickness and coverage | Reference thickness is display context; coverage derives from yield/thickness. Store 45 as source evidence if necessary, not an independent calculation input when 180, 128 and 3/8 govern. |
| Expected dry | Current diagnostic profile rate has independent historical meaning and supports explicit adjustments. Keep compatibility; for a new canonical recipe derive chip plus filler totals unless Product establishes an independent target constraint. |

For an approved chip basis `C_b` and loading `d`, set `V_b=C_b/d` and project with `s=V_sample/V_b`. Existing filler/resin rates can be derived from approved Batch amounts for the current engine: `filler_rate=16 F_b/V_b`, `resin_rate=128 A_b/V_b`, and ratio `A_b/B_b`. Avoid two editable sources of truth. If instead preserving existing rates, derive the Batch display amounts shown above; label them calculated equivalents, not Anthony's verified operational recipe.

Changing density alone currently changes chips without changing filler or binder at fixed geometry. In a canonical formulation this is a recipe change, not simply scaling the same recipe. Retain explicit override provenance and preview the consequences; do not silently redefine the Batch for old snapshots. No migration of old versions or wholesale profile correction follows from this investigation.

Proposed **Batch / Sample** toggle: Batch shows chip basis, each chip percentage and lb quantity, filler lb, A/B gal, and captured profile/system revision. Sample shows actual pour geometry and finished-piece context, fraction of Batch, and the same formulation's oz/fl-oz quantities. Overrides and any approved operational rounding should be visible in the affected view. Toggling changes presentation only.

The Working Sample PDF should prioritize Marcos's executable quantities: a compact captured formulation-basis line, actual production pour area/thickness, finished size/count as separate context, then chip/filler weight oz and resin/hardener fl oz. A secondary Batch reference can show lb/gal and scale factor once verified. Do not print “Standard Batch 180 lb” for historical captures lacking that provenance. Preserve the released row order and issued historical documents. A Key material paired with an MTT captured profile needs explicit context review, not automatic supplier-based substitution.

## Narrow unresolved questions

The evidence supports preserving the calculation machinery now. Before approving changed canonical constants, obtain only the following missing facts:

1. What is the exact expression and unrounded result behind **51.x lb filler**, and why is 50 used in practice? Is that policy specific to this system, and does Sample scaling use the calculated or operational amount?
2. For the same typical Batch, are **180 lb, 45 SF at 3/8, 5 gal A and 1 gal B** exact execution/yield inputs, or rounded references? If exact, should the historical 15/3 Sample become 14.222222/2.844444, or is there a documented Sample allowance? Also identify what the ~1.75 CF note measures.
3. Which exact formulation system governs this Key-resin example, and which approved system quantities change for the 4:1 case? Existing MTT and Sherwin Sample evidence suffices to prove their current behavior; it does not establish universal supplier Batch recipes.

These are deferred questions for any future correction to operational constants, not blockers for initial Batch/Sample projection. In particular, Chris deprioritized reproducing 51.x. The original worksheets or handwritten photos could answer some without further questioning. No new rule is inferred from Pool Mix or from the second cement example.

## Verification outcome

Passed against current source using `node --import tsx`: `scripts/verify-sample-historical-parity.mts`, `scripts/verify-sample-formulation-reactivity.mts`, and `scripts/verify-sample-ratio-normalization.mts`. A separate in-memory current-calculator replay asserted five geometries, ordinary profile switching, ratio-only switching, unchanged quantities on finished-count-only change, and generic versus MTT filler. Source-document hashes and numeric results are preserved in the accompanying evidence JSON.

Repository SQL was inspected for matching density/rate/ratio formulas, but no database lifecycle or hosted behavior was executed. Future implementation requires focused Testing Level 3 coverage for client/SQL parity, unit conversion, profile revision capture, overrides, working versions, immutable issuance and PDFs. This report does not authorize that implementation or establish the missing operational constants.
