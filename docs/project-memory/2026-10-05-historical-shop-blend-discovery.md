# Historical shop Blend and Pour Sheet discovery

October 5, 2026. Investigation only. Released Sample Generator V1 at `4c81212f8ef25e494ca43adea66a062888fe969e` remains frozen. Historical discrepancies below are evidence to reconcile, not instructions to change current profiles or formulation math.

**Recovered four credible completed Production documents: three Blend Sheets and one Slab Pour Layout, across three jobs.** The sources support a separate aggregate staging scale, often 1,000 lb, with percentages carried from the Sample. They also show a 500-lb Blend convention and separate adjusted Batch counts. A universal “one Blend = 1,000 lb = N complete Batches” rule would misrepresent this corpus.

## Agawam source added October 5

**Updated inventory: five completed Production documents across four jobs: four Blend Sheets and one Pour Layout.** The initial discovery counts below are retained as the earlier search boundary. Agawam is an additional original PDF supplied directly by Chris, not another archived rendering.

Source P5: `/Users/chrisngo/Downloads/26-0529 Agawam MAT QTY BLEND 092226-1,2,3.pdf`, one page, visually inspected. Printed title **MATERIAL QUANTITY & BLEND SHEET**. Printed date **August 20, 2026**, Job **26-0529 AGAWAM HS**, WO **092226-1,2,3**, Plate **T26-267-A**. Preserve the printed date separately from the September-looking WO/filename; no revised date is inferred. No second version recovered. High confidence in printed values; ADJ semantics remain unresolved. Exact source hash, text, rows and arithmetic are in [Agawam evidence](evidence/2026-10-05-shop-blend-discovery/agawam-source.json).

The matching Sample is **page 10** of `/Users/chrisngo/my stuff/Jobs/2026 Sample Plate Formulations.pdf`, dated July 14, 2026, with the same Job and Plate. This is a strong exact-identity match. All ten materials, sizes, Marble type, Arim vendor, row order and percentages carry through, including the source spelling “Persain Cream.” Key Resin and Café Au Lait #KR-300-450 also carry through.

| Chip material, each shown in sizes 0 and 1 | Percentage per size | Bags per Blend per size | Total bags required per size | Need to order per size |
|---|---:|---:|---:|---:|
| New Pure White | 17.5% | 3.5 | 42 | 60 |
| Persain Cream | 2.5% | 0.5 | 6 | 15 |
| Georgia White | 15% | 3 | 36 | 60 |
| Canadian Blue Grey (Glacier Grey) | 10% | 2 | 24 | 30 |
| Raven Black | 5% | 1 | 12 | 20 |
| Total across all ten rows | 100% | 20 | 240 | 370 |

Printed scale: **12 Chip Blends**, **12,000 lb required**, **60 adjusted Batches**, **180 lb/Batch**, **1,200 ADJ**, **300 gal A / 60 gal B**. Filler is named **ATF-20**, but its quantity and unit are **blank**. The dash and Bags on the next row belong to CEMENT N/A, not Filler. Do not fill the missing quantity with an inferred 60 bags.

Arithmetic independently checked:

- `12 × 20 = 240 bags`; `12,000 / 240 = 50 lb/bag` (implied by this sheet; matching Sample explicitly labels 50-lb bags).
- `20 × 50 = 1,000 lb/Blend`; each row is `percentage × 20 bags`, then `× 12 Blends`.
- `60 × 180 + 1,200 = 12,000 lb`. ADJ is 11.1111% of the 10,800-lb Batch-chip subtotal, or 10% of final staged pounds. Neither percentage is an established operational allowance rule.
- `60 × 5 = 300 gal A`; `60 × 1 = 60 gal B`. Binder remains tied to the stated 60 Batches, not `12,000 / 180 = 66.6667` chip-equivalent Batches.
- Printed Batch/Blend count ratio is `60 / 12 = 5`; chip-only equivalence is `1,000 / 180 = 5.5556`. These differ because ADJ is separate. Do not infer a universal five-Batches-per-Blend rule.
- Order total is 370 bags versus 240 required, with stock blank. This is not evidence for a universal stock subtraction or rounding rule.

The Sample's `50# Bags / 1000 lbs` column is **identical** to Production's Bags / Blend column. This is the clearest direct transformation recovered so far. The Sample's separate 200-lb Batch reference column is not carried through: Production prints 180 lb/Batch. The Sample Working quantities total 64 oz chips, 18 oz Filler and 15/3 oz binder; the Production sheet establishes 300/60 gallons, not a reverse-scaling of the convenient Working measurements. Both show a 5:1 binder ratio.

This source strengthens the case for a chip-only 1,000-lb staging Blend with fractional bags, but does not negate the Big Springs 500-lb example. It also strengthens the unresolved ADJ/binder distinction. It contains no super-sack capacity or bag-plus-remainder instruction. Next operational question: **what accounts for Agawam's extra 1,200 lb chips, and how are those chips consumed while binder is planned for 60 Batches?** Also confirm the omitted Filler requirement and whether this sheet intentionally consolidates three WOs; the WO field lists three identifiers but provides no allocation per WO.

## ADJ validation and Pool Mix correlation October 5

**Current clarification:** Gio says ADJ is a normal field on every shop Blend Sheet. The recovered corpus supports this: **four of four completed Blend Sheets have a nonzero ADJ**; none has a zero/blank ADJ or lacks the field. The separate Pour Layout is not a Blend Sheet and is excluded from this denominator. ADJ presence is not evidence of a Pool Mix edge case.

Reinspected the preserved complete PDF text for TAMU, Big Springs and Forest and the original Agawam PDF extraction. TAMU and Agawam also have visually inspected pages. Big Springs and Forest remain archived text evidence, not newly inspected original PDFs. Independent arithmetic and source pointers are recorded in [ADJ correlation evidence](evidence/2026-10-05-shop-blend-discovery/adj-correlation.json).

| Job / matched plate | Printed ADJD BATCHES × chip lb/Batch | Unadjusted chips | ADJ | Final chips | Blend count × implied lb/Blend | ADJ / unadjusted | Adjusted factor | A / B gallons |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| TAMU / T25-203-B | 33 × 150 | 4,950 lb | 50 lb | 5,000 lb | 5 × 1,000 | 1.010101% | 1.010101 | 165 / 33 |
| Big Springs / T25-125-A | 2 × 180 | 360 lb | 40 lb | 400 lb | 0.8 × 500 | 11.111111% | 1.111111 | 10 / 2 |
| Forest / T26-273-A | 8 × 200 | 1,600 lb | 400 lb | 2,000 lb | 2 × 1,000 | 25% | 1.25 | 40 / 8 |
| Agawam / T26-267-A | 60 × 180 | 10,800 lb | 1,200 lb | 12,000 lb | 12 × 1,000 | 11.111111% | 1.111111 | 300 / 60 |

Every row obeys `printed Batch count × printed chip lb/Batch + ADJ = final Blend pounds`. The Batch count itself is labeled **ADJD BATCHES**. There is no recovered earlier pre-adjustment Batch count, so “original Batch count” here means the printed count before applying the separate chip-pound ADJ, not a reconstructed planning history.

### Whole Blend rounding test

| Job | ADJ needed for next whole 1,000 lb | Printed ADJ | Match? |
|---|---:|---:|---|
| TAMU | 50 lb | 50 lb | Yes |
| Big Springs | 640 lb | 40 lb | No |
| Forest | 400 lb | 400 lb | Yes |
| Agawam | 200 lb | 1,200 lb | No |

**Universal round-up to the next whole 1,000-lb Blend is contradicted.** Agawam chooses a final 12,000 lb rather than the minimum next 11,000 lb. Big Springs finishes at 400 lb and 0.8 of its implied 500-lb Blend; even rounding to a whole 500-lb Blend would require 140 lb ADJ, not 40 lb. Three final totals happen to be whole 1,000-lb multiples; that is not a general rule.

All four can be described as `ADJ = selected final target − Batch chip subtotal`. That is an arithmetic identity, not proof that the target is authored first. No native formulas, editable-cell protections, input colors, or revision sequences were recovered for these four Blend Sheets. **Independent ADJ entry versus a calculated residual remains undetermined.** A separately labeled field is not proof it is manually authored.

### Waste and geometry hypothesis

**PLAUSIBLE BUT UNPROVEN.** Positive adjustments could represent an aggregate allowance or staging overage, but the sheets say only ADJ, not waste, loss, extra, contingency or yield. Rates vary from 1.01% to 25%; there is no common allowance rate. There is insufficient comparable geometry/process evidence to establish a correlation.

| Job | System and recoverable product context | Limits on a waste inference |
|---|---|---|
| TAMU | SW on Blend and Sherwin on matched Sample; the Sample is 4:1 while Blend totals are 5:1. No matched Production geometry calculation recovered. | February weekly tracker matches job 25-0317/plate and refers to pending Sample approval, but provides no basis for the later 50-lb ADJ. Its KEY notation also differs from the later SW sheet. |
| Big Springs | KEY, Big Springs Brown B; associated WO 081726-1 Pour Layout contains slab pours at 5/8 → 1/2 inch and 1-1/4 → 1 inch finished thickness. Related drawing text identifies flat base/plinth work. | Geometry shows a fabrication-loss opportunity, not an equation for 40 lb ADJ. Layout covers two plates, and the Blend's printed job 25-1205 differs from layout/tracker 25-1202. Do not allocate all layout quantities to this one recipe. |
| Forest | KEY / Granite Brown 07022026; tracker matches job 25-1004 and estimate Q25-0930-1.0. No matched estimating workbook or detailed geometry recovered. | No documented cause for 25% ADJ. Zero cement/additive rows do not identify the precast product geometry. |
| Agawam | Key Resin / Café Au Lait KR-300-450; three WOs listed, no Production geometry or per-WO quantity breakdown on the sheet. | The Sample's 6-inch finished plates and 1-SF Working Pour are Sample geometry, not evidence of Production loss. No explanation for 1,200 lb ADJ is printed. |

The St Ignacio calculation workbook has an actual **Waste Factor** formula `(I23/I16)-1` comparing rough versus finished volume, approximately 44.6759% in that example. It is a different job/example and cannot be joined to any of these ADJ values. Its existence makes geometry-based allowances conceivable but does not establish the meaning or direction of ADJ. No matching estimating/calculation source for these four jobs was found in the locally inspected workbook corpus. Matching tracker rows and associated drawing extracts were checked; no new hosted search was performed.

### Binder and percentages

All four binder totals equal **printed Batch count × 5 gal A / 1 gal B**. None includes the extra chip ADJ as additional binder Batches. This is consistent with aggregate staging being separate from binder planning, but does not prove the adjusted chips are waste rather than reserved stock, later pours, or another allowance. Do not promote those possibilities to facts. TAMU's historical ratio conflict remains unresolved.

For every matched recipe, final required bags apply the same authored percentages to **all final adjusted chip pounds**, not just the unadjusted subtotal. Equivalently, the ADJ increases the same chip composition proportionally; no row is identified as a separate “ADJ material.” Sample percentages remain 10/30/20/20/20 (TAMU), 5/5/15/70/5 (Big Springs), 20/40/40 (Forest), and 17.5/17.5/2.5/2.5/15/15/10/10/5/5 (Agawam).

### Agawam Pool Mix check and classification

Neither the original Agawam Blend Sheet nor matched Sample compendium page 10 contains **Pool Mix** or a Pool Mix alias established by the evidence. There is therefore **no recoverable Pool Mix material name, percentage or historical Formula Role in Agawam**. This is “not recorded,” not a claim about an unobserved manufacturing substitution. None of its ten carried rows is identified as Pool Mix; all are named Marble chip rows totaling 100%. Printed tables establish their chip treatment, not a modern stored Formula Role enum.

**ATF-20** appears separately as FILLER in both documents. The Sample explicitly shows **18 oz ATF-20 Filler**, with a right-hand 50.00 reference; Production names ATF-20 but leaves its quantity/unit blank. ATF-20 is not one of the ten chip rows and has no chip percentage. No source equates it with Pool Mix.

Prior Pool Mix investigation was recovered from `/Users/chrisngo/.codex/sessions/2026/09/29/rollout-2026-09-29T14-30-15-01a0eea5-7357-7d81-9277-df6b2c862f62.jsonl`, summary line 88 and saved-draft forensics line 155. It reported the roughly 90% case **not reproduced** and recipe identity/basis unresolved. Its 90/10 case was synthetic, not an identified historical Agawam recipe. The only recovered Gio draft was 40/30/20/5/5 with ATF-20 and no Pool Mix or Job/Plate link. Those are September findings, not a fresh hosted-state claim. Repository `public/vendor_master.csv` independently names Arim “Pool Mix” and T&M “Pool Mix” as filler; neither name occurs in Agawam. Catalog classification alone does not establish formulation use.

No mathematical evidence ties the 1,200-lb ADJ to Pool Mix. `10,800 / 12,000 = 90%` is a ratio of subtotal to final pounds, **not 90% of a named Pool Mix component**. Also, `60 × (200 − 180) = 1,200` matches the difference between the Sample's old 200-lb reference heading and Production's 180-lb heading. That coincidence suggests another possible reconciliation question, but establishes neither authoring direction nor a historical rule. The source allocates the full 12,000 lb among the ten marble rows; inventing a separate Pool Mix allocation would contradict that printed allocation unless additional evidence establishes a substitution.

**Revised classification: ordinary named-marble Blend staging evidence with unresolved ADJ provenance and missing Production Filler quantity; not an established high-Pool-Mix edge case.** Agawam is representative for percentage/material carry-through, fractional bag notation and the 1,000-lb staging example. It is not yet an authoritative general ADJ/waste/binder-planning formula. Remove ADJ's presence as an edge-case indicator; do not remove the uncertainty about its meaning.

Minimum remaining question for Gio/Anthony: **“On Agawam, what determines the extra 1,200 lb: do you enter an allowance, or choose 12 Blends and let ADJ calculate the difference—and why does binder remain at 60 Batches?”** The separate missing Filler quantity still needs confirmation before using this exact sheet as a complete mixing instruction.

Documentation-only update. All application/migration changes already present in the workspace belong to other work and were left untouched. No Sample/Production generator, PDFs, database, hosted data, permissions or release state was changed in this investigation.

## Focused ADJ / Production overage reconstruction — October 5

**Current result: four unique completed Blend Sheets; no additional completed example recovered in the expanded local search. Recommend direct ADJ pounds for V1 as a provisional Product choice, not as a recovered historical input-cell contract.** Variable amounts and convenient final totals are established. Manual authorship, waste purpose and the sequence of allowance versus rounding remain unproven.

Expanded the existing local PDF/workbook/neighboring-job search using ADJ, ADJD BATCHES, bags/Blend, bag normalization, Batch/Blend counts and named-job clues. The corpus remains 12 workbook files / 10 unique byte hashes, the Sample compendium, recovered archived Production attachments, and the supplied Agawam original. Repeated copies, templates, Samples, tracker rows and unavailable external sheet names were not counted as completed Blend Sheets. No cloud/network-share or hosted search was performed. This bounds the conclusion to accessible evidence.

The St Ignacio workbook's additional `ADJUSTMENT` hits are cost rows, not chip overage: on `3" Epoxy Slab`, `K68=G16` (352 sf), `M68=0`, `N68=M68*K68`; inbound shipping row 83 has `K83=G57` (0 sf), `M83=0.02`. They add no matched ADJ example. Its external link to `\\SMG8310\pm\Anthony\1 - PRIMARY FILES\13 -Retail Precast Jobs\1- IN PROGRESS\UT HSCH -SA\UTHSCH-SA.xlsx` names `Blend Sheet Calcs`, but the workbook is unavailable and no Blend formulas survive in the link cache. This remains a retrieval lead, not formula evidence. The native completed Blend input cells, protections and calculation direction are unknown for all four jobs.

### Complete comparable dataset

“Subtotal” below is **printed ADJD BATCHES × printed chip lb/Batch** before the separate ADJ. It is not a recovered earlier, unadjusted planning Batch count. Dates are printed dates, not inferred WO dates. Systems are historical sheet labels, not current managed-profile assignments.

| Job / plate | Date / system | Printed Batches × lb | Subtotal + ADJ = final lb | ADJ % | Blends × lb/Blend | Required 50-lb bags | A/B gal |
|---|---|---:|---:|---:|---:|---:|---:|
| 25-0317 TAMU / T25-203-B | 2026-05-18 / SW | 33 × 150 | 4,950 + 50 = 5,000 | 1.0101% | 5 × 1,000 | 100 | 165/33 |
| 25-1205 Big Springs / T25-125-A | 2026-08-17 / KEY | 2 × 180 | 360 + 40 = 400 | 11.1111% | 0.8 × 500 | 8 | 10/2 |
| 25-1004 Forest / T26-273-A | 2026-08-18 / KEY | 8 × 200 | 1,600 + 400 = 2,000 | 25% | 2 × 1,000 | 40 | 40/8 |
| 26-0529 Agawam / T26-267-A | 2026-08-20 / Key Resin | 60 × 180 | 10,800 + 1,200 = 12,000 | 11.1111% | 12 × 1,000 | 240 | 300/60 |

All four have nonzero ADJ; none explains it with a waste/overage note. Full row-level bags, system/color, product context, source pointers and machine-checked comparisons: [overage reconstruction evidence](evidence/2026-10-05-shop-blend-discovery/overage-reconstruction.json). Original text and provenance remain in the linked source inventory and Agawam evidence above.

### Rule comparisons and rounding

- **Fixed percentage: contradicted.** Rates are 1.0101%, 11.1111%, 25%, 11.1111%; a universal 10% does not fit.
- **Fixed pounds per Batch: contradicted.** Respectively 1.5152, 20, 50, 20 lb.
- **Fixed pounds per Blend: contradicted.** Respectively 10, 50, 200, 100 lb.
- **Minimum residual to a standard Blend: contradicted as a universal rule.** Big Springs is 0.8 of a 500-lb Blend; Agawam skips the next 11,000-lb target to reach 12,000.
- **Variable allowance: consistent with all observations.** That establishes variability, not manual authorship or cause. Job-specific formulas or selected final targets could produce the same outputs. No other general rule was recovered.

| Final-total property | TAMU 5,000 | Big Springs 400 | Forest 2,000 | Agawam 12,000 |
|---|---|---|---|---|
| Multiple of 100 lb | Yes | Yes | Yes | Yes |
| Multiple of 500 lb | Yes | No | Yes | Yes |
| Multiple of 1,000 lb | Yes | No | Yes | Yes |
| Whole / even 50-lb bag total | 100 / Yes | 8 / Yes | 40 / Yes | 240 / Yes |
| Whole or half nominal Blend count | 5 / Yes | 0.8 / No | 2 / Yes | 12 / Yes |

The greatest common divisor of these final weights is 200 lb, but four examples do not establish a 200-lb shop convention. All being multiples of 100 lb and having even 50-lb bag totals are the **same arithmetic observation**, not independent corroboration. No documented sack capacity explains either pattern.

| Minimum added lb to reach a multiple at or above subtotal | TAMU | Big Springs | Forest | Agawam | Matches actual ADJ |
|---|---:|---:|---:|---:|---:|
| 50 lb | 0 | 40 | 0 | 0 | 1/4 |
| 100 lb | 50 | 40 | 0 | 0 | 2/4 |
| 500 lb | 50 | 140 | 400 | 200 | 2/4 |
| 1,000 lb | 50 | 640 | 400 | 200 | 2/4 |
| Actual ADJ | 50 | 40 | 400 | 1,200 | — |

Thus **convenient adjusted targets are observed; automatic minimum rounding is not established**. Intentional target selection is plausible, but cannot be proved from final totals. A positive allowance followed by optional rounding is also plausible; the sources expose only one ADJ and cannot separate two amounts or two historical steps.

### Bags, product geometry and binder

Total bags per nominal Blend are **20 / 10 / 20 / 20**. Big Springs and Agawam include fractional per-material bags per Blend. Big Springs also has fractional final material requirements `0.4/0.4/1.2/5.6/0.4`, despite an eight-bag grand total. TAMU, Forest and Agawam have whole final material bag counts. This distinguishes aggregate-total convenience from individual material convenience: **do not round every material to whole bags**. Need-to-order figures remain separate purchasing data, not a mixing rule.

**Waste/product-type hypothesis: PLAUSIBLE BUT UNPROVEN.** The strongest matched evidence is Big Springs's associated rough-to-finished slab thicknesses and flat base/plinth work, but the layout spans two plates and prints a different Job number. It cannot allocate loss to this recipe or explain 40 lb. TAMU, Forest and Agawam lack matched Production geometry calculations. Forest's higher rate cannot responsibly be attributed to fabrication complexity. Run size alone is not monotonic with rate (2 and 60 Batches share 11.11%; 8 has 25%; 33 has 1.01%). There is no source-backed product-specific rate and no basis for statistical inference. The unrelated St Ignacio volume waste formula demonstrates that geometry calculations existed, not that these sheets used them for ADJ.

Existing binder checks remain unchanged: each example uses printed Batches × 5/1 gallons; ADJ does not increase those totals. No contradictory source appeared. The historical TAMU ratio discrepancy remains historical evidence, not permission to change released formulation behavior.

### Smallest safe V1 recommendation — not implementation authorization

| Option | Recommendation and evidence limit |
|---|---|
| A — direct ADJ lb | **Preferred provisional V1.** One operator-owned quantity using the historical label; display Batch chip subtotal + ADJ = adjusted chip requirement immediately. It reproduces every example without inventing a rate. Confirm ownership with Anthony before treating it as recovered workflow. |
| B — waste/overage % | Do not make this the authoritative V1 input or provide a default percentage. A read-only equivalent percentage may explain the entered pounds; it does not establish that ADJ means waste. |
| C — desired target / Blend target | Numerically valid alternative, but no source proves target-first authoring. Prefer it only if the workbook/operator confirms that workflow. Do not independently author both ADJ and final target. |
| D — optional rounding assistance | Reasonable future convenience, not required for minimum V1. If approved, preview an operator-selected target increment and the resulting ADJ, applying it only on explicit acceptance. No automatic rounding, universal increment, inferred sack capacity, or per-material whole-bag rounding. The four totals support evaluating such help, not a canonical default. |
| E — geometry formula | No recovered general ADJ formula supports this now. |

Do not add separate “waste” and “rounding” inputs based on this corpus. Keep binder on its independently established Batch basis. For Agawam, the proposed display can faithfully show `60 × 180 = 10,800 lb; ADJ +1,200 lb; adjusted chips 12,000 lb; 12 × 1,000-lb Blends` without asserting why Anthony chose 1,200.

Future scope only: **Proposal product/geometry mix → suggested Production allowance → operator-reviewed ADJ → Blend requirement**. Suggestions must preserve operator authority and must not silently redefine captured formulation or binder requirements. No percentage range is established by this investigation.

Only remaining ADJ operational questions: **Does Anthony author ADJ pounds or a final target/Blend count, and how was Agawam's 1,200 lb chosen (including whether waste and rounding are distinguishable)? What does that extra chip staging cover while binder remains planned for 60 Batches?** An original editable completed Blend workbook or a walkthrough of that example can resolve these. Other historical source discrepancies remain documented above and are not new ADJ design assumptions.

Documentation-only verification: recomputed all four subtotal/ADJ/final equations, per-material bag sums, nominal Blend totals, binder totals and 50/100/500/1,000-lb minimum-roundup comparisons; checked evidence JSON and report links. No application tests/build were needed. Only this report and the new overage evidence were changed in this follow-up; unrelated concurrent workspace edits were untouched. No implementation, migration, PDF change, hosted mutation, commit, push or deployment.

## Initial discovery scope and counting

Searched local Tenarten work/source directories, Desktop, Downloads, Documents/Codex, repository references and generated artifacts, the earlier Sample source location, attachment filenames, and relevant archived Codex analysis. Inspected workbook sheet names and all populated cells in 12 local workbook files (10 unique byte hashes), external-link sheet names, all 83 pages of the Sample compendium by text extraction, and recovered historical PDF text/images from archives. Listed the September 24 OneDrive ZIP: its 14 members are bid-document material, with no Blend/Pour/workbook filename lead. No connected cloud-drive contents or hosted database/storage were queried. Unindexed personal images were not subjected to blanket OCR.

Original PDFs for the four recovered Production records are no longer present at their old `/tmp/sample-formula-forensics` paths. Evidence survives as archived extraction output; TAMU additionally has an archived page rendering, inspected visually. Original PDF bytes could not be hashed. Repeated archive outputs were counted once by original attachment identity, filename, and content. Local workbook copies were deduplicated by SHA-256. This is a bounded local discovery, not a claim that the company has only four historical Production documents.

| Measure | Finding |
|---|---|
| Completed recipe/Blend documents | 3, one each for TAMU, Big Springs, Forest Theater |
| Completed related Pour Layout | 1, Big Springs; geometry/layout, not another recipe |
| Distinct Production jobs represented | 3; Big Springs job-number discrepancy noted below |
| Standalone blank Blend/Pour recipe templates | 0 recovered |
| Adjacent blank shop-report workbooks | 2: Material Usage Report and SLABS; excluded from completed-document count |
| Completed Production document date range | May 18–August 18, 2026; Pour drawing dated August 16 with August 17 WO/filename |
| Format families | Closely related tabular Blend Sheet family; separate dimensioned Slab Pour Layout family |
| Sample comparison | At least 83 populated Sample pages in one PDF alone, December 18, 2025–August 10, 2026; 83 distinct extracted page texts; all contain a 1,000-lb bag column |
| Sample projects | 44 exact project-label strings, including TBD and aliases; these are not 44 verified distinct jobs |

**The available evidence does not support “more Production sheets than Sample sheets.”** There are three recovered Blend examples versus at least 83 populated Sample examples. The Sample pages themselves already contain Production-scale reference columns; those do not become 83 additional standalone Production documents.

## Source inventory and exact locations

The durable [source inventory](evidence/2026-10-05-shop-blend-discovery/source-inventory.json) includes source hashes where bytes exist, duplicate paths, sheet names, selected cell addresses/formulas/cached values, each Sample page's project/formula/date, original attachment storage keys, and recovered PDF text. Storage keys are historical locators, not proof of current hosted availability.

### Completed Production documents

All four are one-page PDFs. No second completed version of any of these four was recovered.

| ID | Original filename and historical local path | Date / project / terminology | Availability and confidence |
|---|---|---|---|
| P1 | `TAMU WO 051826 MAT QTY BLEND SHEET.pdf`; `/tmp/sample-formula-forensics/03-TAMU_WO_051826_MAT_QTY_BLEND_SHEET.pdf` | May 18, 2026; TAMU – TEXARK., job 25-0317, plate T25-203-B. “CHIP BLEND,” “BAGS / BLEND,” “ADJD BATCHES,” “CHIP BLENDS” | Completed real example. Archived text plus [unaltered recovered page image](evidence/2026-10-05-shop-blend-discovery/tamu-blend-source.png). High confidence in printed content; recipe correctness unresolved. |
| P2 | `Big Springs Blend Sheet 081726-1.pdf`; `/tmp/sample-formula-forensics/07-Big_Springs_Blend_Sheet_081726-1.pdf` | August 17, 2026; Big Springs, printed job 25-1205, WO 081726-1, plate T25-125-A. Same Blend terminology; additional CEMENT rows | Completed real example. Full archived text; no recovered visual or native formulas. Medium-high confidence in quantities, lower confidence in spatial interpretation. |
| P3 | `Mat QTY & Blend Sheet.pdf`; `/tmp/sample-formula-forensics/09-Mat_QTY_Blend_Sheet.pdf` | August 18, 2026; FOREST THEATER, job 25-1004, WO 081826-1, plate T26-273-A. Same Blend terminology; water/AKKRO-7T/PLASTOL rows | Completed real example. Full archived text; no recovered visual/native formulas. Medium-high confidence. |
| P4 | `SLAB POUR 081726.pdf`; `/tmp/sample-formula-forensics/additional-work-orders/09-SLAB_POUR_081726.pdf` | Drawing August 16, 2026; Big Springs, printed job 25-1202, WO 081726-1, revision 1.1.0. “SLAB POUR LAYOUT,” “Pour @,” “Finish @” | Completed layout, archived text. High confidence that this is a Production layout; not a Blend formulation. Job differs from P2; do not silently unify those numbers. |

Recovery locations:

- P1–P3 complete text: `/Users/chrisngo/.codex/archived_sessions/rollout-2026-09-08T11-26-16-01a081d7-761c-7643-b41d-0cbc373cddb7.jsonl`, line 9820.
- P4 and Big Springs Sample text: same archive, line 9955.
- P1 image: `/Users/chrisngo/.codex/archived_sessions/rollout-2026-09-17T14-11-27-01a0b0c7-ee6b-75c1-9e81-aad6bbfbb857.jsonl`, line 578, following the image request at line 575.
- Attachment metadata/keys: `/Users/chrisngo/.codex/archived_sessions/rollout-2026-08-31T13-14-08-01a05907-58f9-72d0-9143-95997e48e1ea.jsonl`, line 2871. These are local archive reads, not new hosted reads.

### Supporting sources, excluded from the four-document count

| Exact path | Relevant worksheet/page | Date, status and evidentiary use |
|---|---|---|
| `/Users/chrisngo/my stuff/Jobs/2026 Sample Plate Formulations.pdf` | All 83 pages; especially 1, 11, 13, 18, 78, 82 | Populated Sample family, December 2025–August 2026. Batch/1,000-lb reference columns, percentages and Working quantities. Not completed Production orders. |
| `/Users/chrisngo/Desktop/Q26-0901-1.0 St Ignacio HS CALCS.xlsx` | `3" Epoxy Slab`, C24:M54; externalLink1 | September 2026 workbook metadata. Populated estimate/calculation example, blank header identity on this calculation tab. Strong formula evidence for 20 × 50-lb bag conversion; not proof this exact mix was produced for St Ignacio. |
| `/Users/chrisngo/Downloads/cbe1920e-266a-4400-acc1-bc5bb1c2601c.xlsx` | `Q26-0901-2.0 QUOTE`, `Q26-0901-2.0 CALCS` | September 1, 2026 metadata. Populated quote revision; no additional shop Blend Sheet. The `(1).xlsx` copy is byte-identical and excluded. |
| `/Users/chrisngo/Desktop/East montgomery PO Calcs.xlsx` | `PO #0422-002 TM`, `PO #0422-001 TM`, rows 15–21 | July 15, 2026 printed PO date. Completed purchasing example, East Montgomery job 26-0422; pairs plausibly with compendium p11. Not a Blend Sheet. |
| `/Users/chrisngo/work/tenarten/production planning workbooks/Material Usage Report  - Copy - Copy.xlsx` | `Material Report (Epoxy)` | Blank report, “Revisoin 09 JAN 23”; last modified March 6, 2025, by Marcos in metadata. Batch count drives resin/hardener/filler; chip blends entered separately. Strong workflow/template evidence. |
| `/Users/chrisngo/work/tenarten/production planning workbooks/SLABS  - Copy.xlsx` | `MANPOWER 8-5-25`, `PRODUCTION` | August 2025 sheet/metadata context; unfilled job reporting template. “DRUMS OF CHIPS BLENDED” is PREP; “FORMS POURED” is POUR; “Mixes” also appears without a definition. |
| `/Users/chrisngo/work/tenarten/production planning workbooks/Copy of 2026 Weekly Project Update 02.09.26.xlsx` | Five weekly tabs, January 19–February 16, 2026 | Populated multi-job status tracker. BLEND SHEET, resin PO, chips PO and filler PO are separate workflow columns. Desktop copy is byte-identical; not five Blend Sheets. |
| `/Users/chrisngo/work/tenarten/production planning workbooks/Inventory - Copy.xlsx` | `Inventory Location List ` rows 89–90; `Warehouse Layout `; `Sheet1` | Populated inventory, last modified March 2026. Air Products / Mixed Chips and Newark TT21224 explicitly say “Super Sack”; no sack weights. Sheet1 has Bora Bora D20-257-F formulation and “in stock” bag notes, not bags required. |
| `/Users/chrisngo/Downloads/Blank Color Plate MANUAL TEMPLATE.xlsx` | `10.07.25` | October 2025, blank Sample template; no formulas; not a Production template. |
| `/Users/chrisngo/work/tenarten/inventory/combined_vendor_catalog_v2_more_complete.xlsx` | Vendor tabs | Catalog context only; package variety includes 1/5/10/25/50-lb bags. Not an operational Blend rule. |

A strong missing-source lead survives in the St Ignacio workbook's external links:

`\\SMG8310\pm\Anthony\1 - PRIMARY FILES\13 -Retail Precast Jobs\1- IN PROGRESS\UT HSCH -SA\UTHSCH-SA.xlsx`

It names `Blend Sheet Calcs`, `WO 110123-3`, `WO 110123-2`, `23-763-B`, and `23-763-A`. The link contains only one cached cell overall; the Blend sheet's contents were not recovered. No local copy or mounted network volume was found. **Do not count these sheet names as additional completed examples.**

## Strongest examples and arithmetic

| Printed field | TAMU P1 | Big Springs P2 | Forest P3 |
|---|---:|---:|---:|
| Aggregate percentages | 10 / 30 / 20 / 20 / 20 | 5 / 5 / 15 / 70 / 5 | 20 / 40 / 40 |
| Bags per Blend, by row | 2 / 6 / 4 / 4 / 4 | 0.5 / 0.5 / 1.5 / 7 / 0.5 | 4 / 8 / 8 |
| Total bags per Blend | 20 | 10 | 20 |
| Number of Chip Blends | 5 | 0.8 | 2 |
| Bags required, by row | 10 / 30 / 20 / 20 / 20 | 0.4 / 0.4 / 1.2 / 5.6 / 0.4 | 8 / 16 / 16 |
| Total bags required | 100 | 8 | 40 |
| Lbs required | 5,000 | 400 | 2,000 |
| Implied lb per bag | 50 | 50 | 50 |
| Implied lb per Blend | 1,000 | **500** | 1,000 |
| Adjusted Batches | 33 | 2 | 8 |
| Lbs per Batch | 150 | 180 | 200 |
| ADJ | 50 | 40 | 400 |
| Resin A / B | 165 / 33 gal | 10 / 2 gal | 40 / 8 gal |
| Filler | 33 bags ATF-20 | 2 bags ATF-20 | 8 bags ATF-20 |

All three reconcile arithmetically as `adjusted Batches × lb/Batch + ADJ = lb required`:

- TAMU: `33 × 150 + 50 = 5,000`; `5 × 20 × 50 = 5,000`.
- Big Springs: `2 × 180 + 40 = 400`; `0.8 × 10 × 50 = 400`.
- Forest: `8 × 200 + 400 = 2,000`; `2 × 20 × 50 = 2,000`.

These are independent checks of printed numbers, **not recovered spreadsheet formulas for ADJ**. Its cause/sign/ownership is unknown. In particular, do not label it automatically as waste, Filler, rounding, or purchasing allowance. Forest's 400-lb adjustment numerically equals eight 50-lb filler bags, but that coincidence does not establish inclusion of Filler in CHIP BLEND.

Resin A, B and Filler instead reconcile to the stated Batch count in all three: `5 gal A + 1 gal B + 1 bag Filler` per stated Batch. They do not increase proportionally with ADJ. For example, scaling Forest's 2,000 lb at 200 lb/Batch would suggest 10 Batches, but its sheet explicitly shows 8 and 40/8 gallons. Reproducing a naive `chip total / Batch chips` binder scale would disagree with the document.

## Sample to Production transformation

| Element | What the matched documents establish |
|---|---|
| Formula identity | TAMU T25-203-B and Forest T26-273-A match exactly. Big Springs Sample prints TT25-125-A versus Production T25-125-A; filename, project, matrix and five-row composition strongly associate them, but the typo remains visible. |
| Percentages | Unchanged in all three matched pairs. No evidence that scaling to bags changes the authored percentages. |
| Material, size, type, order | Forest retains CC Rose / Red Cedar / Canadian Chocolate, size 1, Marble, KCI and order. Big Springs retains the five named marble/size rows, CCQ and order. TAMU retains the five color/size/type rows and order, but shortens RC50 Clear Glass to SKU RC50 + Clear. |
| Vendor | Not invariant: TAMU's first two RC50 rows change ARIM in Sample to ENVR in Production. Sources do not establish whether this was a deliberate sourcing substitution or error. |
| Scale | Percentages become bags per nominal Blend; multiplying by Blend count gives total bags required. Mass is implied through package weight. Separate Batch count controls binder/Filler totals in these examples. |
| Sample amounts | Working ounces are not the input from which Production binder should be reverse-scaled. Historical header totals, Batch columns and Sample amounts sometimes conflict. |
| Purchasing | IN STOCK and NEED TO ORDER accompany required bags, but do not consistently derive from them. TAMU order figures 15/50/35/35/30 exceed requirements 10/30/20/20/20 with stock blank; Big Springs shows 5 to order on each row. No universal rounding/stock subtraction rule is established. |

Matching source locations:

- TAMU Sample: historical `/tmp/sample-formula-forensics/02-Color_Plate_T25-203-B_Amazing_Gray_.pdf`; archived text at line 9820 above and [recovered visual](evidence/2026-10-05-shop-blend-discovery/tamu-sample-source.png). January 9, 2026. It shows 16/4 ounces binder (4:1), SF-20 Filler, ARIM RC50. Production shows 165/33 gal (5:1), ATF-20, ENVR. This exact match exposes unresolved history, not permission to change Sherwin's accepted 4:1 behavior.
- Forest Sample: historical `/tmp/sample-formula-forensics/08-Color_Plate_T26-273-A.pdf`; same archive line 9820 and [recovered visual](evidence/2026-10-05-shop-blend-discovery/forest-sample-source.png). August 18, 2026. Percentages 20/40/40 and Working quantities 6.4/12.8/12.8 oz remain separate from Production bags 4/8/8 per Blend. Resin color Granite Brown 07022026 carries through; 7.5/1.5 Working binder agrees in ratio with 40/8 Production gallons.
- Big Springs Sample: historical `/tmp/sample-formula-forensics/additional-work-orders/10-T25-125-A.pdf`, text at archive line 9955; March 13, 2025. Percentages match. Its printed 180-lb heading conflicts with component weights 9/9/30/140/10 summing to 198 lb and normalized bag column 0.91/0.91/3.03/14.14/1.01. Preserve percentages as observed; do not reuse those inconsistent weights as authoritative mathematics.
- East Montgomery ancillary pair: compendium p11 T26-266-A and PO workbook share job 26-0422, 90/10 Beige Blend / FW-M MOP, size 1, T&M and resin #14580 Sandy Ridge. Purchase quantities are 90/10 **50-lb bags** and 100/20 gal binder. This confirms material identity and purchasing scale, not a 5-Blend pour plan or the cause of the purchasing totals.

## Meanings supported by the sources

**Batch:** a mixing/formulation basis with pounds per Batch and binder/Filler requirements. Historical printed chip bases vary: 150, 180 and 200 lb. “ADJD BATCHES” can differ from total-chip-weight divided by nominal Batch chips because ADJ is separate. It is not a universal 180-lb term.

**Blend:** a chip composition and staging quantity distinct from a complete binder-containing Batch. “BAGS / BLEND” and “CHIP BLENDS” are explicit. Big Springs proves fractional Blend counts and a smaller implied nominal Blend. Documents support grouping/scaling; they do not establish a full persistent Blend entity, lot lifecycle or depletion contract.

**Pour:** the physical casting/layout operation. P4 describes 17 pieces poured at 5/8 inch and finished at 1/2 inch, and two at 1-1/4 inch finished at 1 inch, with plate references and dimensions. This is separate from bag composition. The SLABS template independently places chip blending under PREP and forms poured under POUR.

**Mix / super sack:** “Chip Mix,” “Chip Blend,” “Mixes,” “Drums of Chips Blended,” “Super Sack,” and “Big Sack” all occur. No source defines them as interchangeable units. Inventory directly establishes stored mixed chips in super sacks, but no sack capacity, Blend count per sack, or guaranteed 1,000-lb fill.

**1,000 lb:** directly labeled in the Sample/estimating `50# Bags / 1000 lbs` columns. In the St Ignacio workbook, `K34=G34*$M$30`, `L34=K34/$K$46*20`, and `M34=$M$31*G34/50`; 90/10 becomes 18/2 bags on the 1,000-lb basis. TAMU and Forest independently imply exactly 1,000 lb per Blend. Big Springs implies 500. Convenient bag arithmetic is supported; a capacity-driven reason is not established. Gio's super-sack/convenience explanation is current operational testimony, distinct from the documents.

**What Blend mass includes:** the recovered tables allocate 100% across chip aggregate rows, with binder and Filler listed outside that table. Best-supported reading is chip aggregates only. Their physical order of addition and whether Filler is ever preloaded into a sack are not shown.

**Bags and rounding:** documents use whole and decimal bags; Big Springs has 0.5 bag per Blend and 0.4/1.2/5.6 bags required. No “bags + remainder pounds” notation was recovered. The 50-lb package is explicit in the Sample/estimate and East Montgomery PO; it is implied by totals in P1–P3. Future catalog-driven equivalents must not assume 50 lb for every product. No universal whole-bag rounding rule is supported, and order quantities must not be mistaken for mixing instructions.

**Filler / binder:** separate components, not aggregate percentages. The blank Material Usage Report reinforces this: `AC24=AF14*5` gallons Resin, `AC26=AF14*1` gallons Hardener, `AC28=AF14*1` bag Filler; it has additional Filler lines and separately entered Chip Blend 1/2/3 pounds. AF14 is blank, so zero caches are template outputs, not completed zero-usage records.

**Multiple Batches per Blend:** operationally supported, without an invariant conversion. Printed ratios are TAMU `33/5=6.6`, Big Springs `2/0.8=2.5`, Forest `8/2=4`. Chip-only mathematical equivalents would be `1000/150=6.6667`, `500/180=2.7778`, and `1000/200=5`. The differences track separate ADJ pounds. Neither set is an authorized universal rule.

## Shop information priority

These priorities are inferred from the historical layouts; they are not a new approved UX specification.

| Classification | Fields |
|---|---|
| Essential shop instruction | Plate/formulation identity; unambiguous chip identity, size, type and vendor/SKU where available; authored percentages; bags per Blend; Blend count; total chip pounds and required bags; adjusted Batch count and clearly defined adjustment; Resin A color/system and gallons; Resin B gallons; Filler identity and bags; Job/WO to avoid applying the right recipe to the wrong work. |
| Useful context | Project name, date/revision, notes, finish/sealer when relevant; in-stock/need-to-order as separate purchasing context; pour/finished dimensions and count on the related Pour Layout. |
| Editor/provenance only | Captured profile revision, snapshot IDs, exact oz projections, density derivation, internal calculation version. Traceability remains valuable but is not the prominent shop instruction evidenced here. |
| Not historically established | Universal 1,000-lb Blend; sack capacity; one sack per Blend; bag-plus-remainder preference; generalized order-rounding; automatic binder changes for ADJ; universal Blend-to-Batch conversion; Blend inventory depletion/lot lifecycle. |

## Comparison with released TenOps

Inspected released source at the frozen SHA and existing local review PDFs, without generating or modifying documents. Working artifact: `/private/tmp/tenops-sample-delete-review/output/pdf/gio/MTT-working-review.pdf`, visually inspected one page (V9). Production artifact: `/private/tmp/tenops-sample-delete-review/output/pdf/filler-override/MTT-modified-Production-Batch-review.pdf`, first-page table inspected as an earlier review example; released `production-batch-pdf.ts` and `sample-production-batch.mjs` inspected directly for current semantics. These are review fixtures, not historical shop sources or new Production smoke evidence.

- **Reuse:** canonical resolved formulation; operator percentages; material/catalog/package snapshots; formula/plate and project identity; issued-versus-working distinction; binder units in US gallons; authoritative per-Batch quantities; Filler overrides and missing-basis/readiness checks; semantic component order. `packageEquivalent` already uses captured package weight and retains the exact equivalent, displaying approximately rounded two-decimal counts when necessary. Its displayed rounding is not an operational mixing rule.
- **Working Sample:** compact shop quantities, resin color, identity, pour/finished distinction and notes fit its accepted Sample purpose. Leave V1 unchanged.
- **Current Production output:** accurately labels itself ONE BATCH and shows Batch pounds, binder gallons and package equivalents. This is useful provenance, but it does not represent the recovered multi-Blend staging workflow.
- **Future presentation to reconsider:** “Production Batch Blend Sheet” conflates distinct scales if offered as Marcos's full Blend instruction. Current per-Batch package decimals cannot stand in for bags per Blend/total required; profile-revision/density/fl-oz detail currently takes space needed for operational staging quantities. Missing concepts are Blend target/count, total chips, adjusted Batches/ADJ ownership, and separate requirements versus purchasing. Do not merely relabel its current numbers.
- Existing Production `blend-sheet-parser.ts` delegates to common labeled identity extraction. It is not a recovered recipe or Blend calculation engine.
- Admin-only UI/API access remains unchanged. No access expansion or Production-document redesign was performed.

## Unresolved facts and next Product step

Resolve only these operational facts before a Product Acceptance Contract:

1. Is Big Springs's 500-lb nominal Blend intentional, and who selects Blend target and partial Blend count?
2. What exactly is ADJ, how is it calculated, and why do binder/Filler stay on adjusted Batch count rather than all staged chip pounds? Use Forest's 400-lb difference as the concrete case.
3. How does the shop dispense a staged Blend into actual mixing Batches, handle remainders, and track unused chips? Does a sack contain one Blend, multiple Blends or a variable fill? Is Filler ever included physically?
4. What are the approved bag measuring and purchase-rounding conventions, particularly for non-50-lb packages and fractions? Should actual measured weights accompany fractional bags?
5. Reconcile TAMU's 4:1 Sample versus 5:1 Production binder, SF-20 versus ATF-20 and ARIM versus ENVR. Resolve Big Springs's printed job/plate discrepancies. These are historical-record questions, not new global profile rules.
6. Who confirms the approved formulation revision used for a Production instruction, and how are legitimate supplier substitutions authorized?

Recommended next step: a short Gio/Marcos walkthrough of the three recovered examples, concentrating on Big Springs and Forest. Obtain the original editable Blend workbook (the UTHSCH-SA external-link path is a concrete retrieval lead) and confirm the fields above. Then write the downstream Production Acceptance Contract, keeping the released Sample formulation frozen. Do not design from a presumed universal 1,000-lb constant or reverse-scale convenient Sample quantities.

## Durable boundary and verification

Added this report plus `evidence/2026-10-05-shop-blend-discovery/source-inventory.json` and three recovered source PNGs. The JSON includes the complete selected archived text so absent temporary PDFs do not erase the evidence. No historical source was edited. No application code, migration, profile, permissions, database, deployed artifact or Git ref changed; no commit/push/deployment occurred. The four pre-existing untracked root documents were preserved.

Documentation-only verification: inspected recovered TAMU Production and TAMU/Forest Sample images; reconciled the three Blend tables arithmetically; inspected source cell formulas/caches and hashes; checked report links/evidence and changed-file boundary. No application build or broad suite was run.
