# Batch first Sample formulation reconciliation and candidate

September 30, 2026. Canonical implementation base: `a5f5bb9cc3ab9ad7e3a6b520a6cfb5476671ce79`. Worktree: `/private/tmp/tenops-sample-batch-v1`, branch `feature/sample-batch-working-pour-v1`. Local candidate only; no push, hosted migration/data change, cleanup, deployment or release.

## Final authority decision

**Model A, Batch-first, is the settled Product architecture.** Chris's latest operational clarification establishes the common MTT canonical shop Batch as **180 lb chips, 50 lb filler, 5 US gal Part A and 1 US gal Part B, 5:1**. That current decision supersedes the earlier unresolved-charge gate and historical Sample defaults. The 51.x example is not a canonical requirement, hidden formula or remaining question.

The implemented flow is **canonical operational Batch → exact Working projection → practical shop preparation**. Production reads the Batch directly. An exact projection means exact relative to that approved operational Batch; it does not claim a separate theoretical material-demand calculation. The data contract can preserve a separately described shop Batch charge, without making a shop Working quantity upstream.

## Reconciliation and results

| Component | Canonical MTT Batch | Exact 1/45 Working projection | Representative shop instruction |
| --- | --- | --- | --- |
| Chips | 180 lb, partitioned by operator percentages | 64 oz | 64 oz |
| Filler | 50 lb, one operational bag | 800/45 = 17.777777… oz | 18 oz, confirmed by Anthony |
| Part A | 5 US gal | 640/45 = 14.222222… fl oz | 15 fl oz, captured historical representative instruction |
| Part B | Part A/5 = 1 US gal | 128/45 = 2.844444… fl oz | Shop A/5 = 3 fl oz |

The 18 and 15/3 instructions are scoped to the representative Working volume, 1/32 CFT. They are explicit instructions, not a universal ceiling or binder rounding algorithm. At other Working volumes, MTT defaults to the exact proportional quantities unless an operator authors a shop override. Changing geometry or profile resets manual shop overrides to the applicable captured instruction/exact projection; historical snapshots retain previous overrides. Profile changes to canonical charges/loading or ratio clear old shop instructions in the profile editor for future selections.

The accepted provenance is unchanged: `180/128 = 1.40625 CFT`; `0.375/12 = 0.03125 ft`; `1.40625/0.03125 = 45 SF`; `180/45 = 4 lb/SF`; `1 SF × 4 × 16 = 64 oz`. Working fraction is `Working volume / captured Batch reference volume`, hence 1/45 at the representative geometry. Area alone is insufficient when thickness differs. Finished Plate size/count never independently multiplies the pour.

Operator-authored blends remain independent of profiles. Verified Batch weights: 40/30/20/5/5 → 72/54/36/9/9 lb; 50/25/25 → 90/45/45; 30/40/30 → 54/72/54. No permutation is a default. Drafts may remain incomplete; output/issue reconciliation gates remain.

## Source reconciliation

The original 83-page PDF is `/Users/chrisngo/my stuff/Jobs/2026 Sample Plate Formulations.pdf`, SHA-256 `e761f2cf92d5cd9ac2d616464d23ff7505bbe82615b578fd0fc125c1cd10432b`. It was extracted in full during investigation; pages 1, 2, 19, 26, 49 and 82 were compared and pages 19/2 visually inspected.

Source facts: MTT p19 and p49 contain 64/16/15/3 at 1/32 CFT, a 200-lb upper chip table and adjacent 177.76/44.44/5/1 references. P1/p2 contain the separate 18-oz filler family. Sherwin p26 and p82 support 4:1 shop recipes at different volumes. The flattened PDF does not expose original spreadsheet formulas. These columns did not justify uniform reverse scaling. Anthony subsequently confirmed historical shop rounding, corrected common MTT shop filler to 18, and Chris established the operational Batch baseline above. Current operational authority supersedes inference from the older sheets; it does not rewrite their history.

The old adjustment originated in September 18 commit `f800eeab9e4f5173421e38b11efc940638dd3bf8`, before Batch work and the later Pool Mix investigation. Its conserved dry mass and unchanged binder were implemented assumptions, not recovered normal Batch rules. Existing tests proved that implementation, not operational authority. Pool Mix remains out of scope.

## Versioned data and calculation contract

New calculation version: `sample-formulation-v5-batch-first`. Captured profile `batchContract.version = 1` contains component exact canonical quantity, dimensional unit, confirmed/unresolved authority, provenance, optional shop Batch charge/package description, and optional shop Working instruction with reference volume and scope. Part B uses the captured resin-ratio rule. Managed profiles, Drafts, working versions and issues carry the resolved contract; later live profile/catalog edits do not reinterpret them.

Canonical loading comes from the captured profile. Ordinary shop editing cannot change it, the Batch chip target, percentages, reference yield or Working fraction. The UI calls it **Batch reference chip loading** and makes it read-only in normal Sample settings. Canonical profile editing retains its existing administrator/developer authority. Server saves accept Batch authority only from the same captured profile, a matching managed revision, or that Sample's trusted historical capture; an invented Draft contract is rejected.

Exact component quantities and shop quantities are computed separately. Existing manual row quantities become explicitly downstream shop overrides under V5. Binder preparation preserves the captured ratio. Server persistence derives the shop quantities and dry total; original row storage precision remains four decimals, while exact projection is reproducible from captured inputs rather than rounded row values.

New UI terms are **Exact projected dry quantity** and **Shop preparation dry quantity**. Representative MTT totals are 81.777777… oz exact and 82 oz shop. Changing shop filler to 64 oz produces 128 oz shop dry preparation while chips remain 64 oz and loading 128. The old 80-oz invariant and coordinated substitution control are absent from V5. Legacy versions retain their original dispatch and captures, including 16/80, density adjustments and 15/3.

## Documents and profile availability

Production Batch Blend Sheet uses canonical Batch components directly, independently of Working dimensions and shop overrides. It preserves captured catalog identity, package equivalents, Working versus Issued sources, semantic ordering and zero Inventory mutation. Package equivalents remain canonical Batch mass divided by captured package mass; unknown/ambiguous packages remain unavailable. Source issues remain immutable.

Working Sample PDF version `sample-work-order-pdf-v8-batch-first` shows concise exact-projection provenance and prominent **SHOP PREPARATION QUANTITIES**. Rows remain all aggregates → Filler → Resin → Hardener across pagination. Legacy PDF dispatch remains unchanged.

Sherwin remains Sample-capable with its captured historical shop-volume rates and 4:1 relationship. With its Batch basis/components unresolved, exact Batch projections are unavailable, the chip loading is identified as historical shop support, and complete Production output is disabled. Missing authority never falls back to reverse scaling. Additional unconfigured component roles likewise cannot acquire Production authority from a shop quantity.

Legacy captures can still render their Working Sample sheets; complete authoritative Production generation is unavailable from legacy Sample-first captures. No backfill, silent conversion or rewriting of historical 16/80 captures occurred. Existing stored issued artifacts remain untouched.

## Migrations and release boundary

Apply after the existing Sample foundation/profile migrations, in this order:

1. `20260930170000_sample_batch_chip_basis.sql` — existing candidate migration, unchanged.
2. `20260930220000_sample_batch_reference_thickness.sql` — existing candidate migration, unchanged.
3. `20261001010000_sample_batch_first_authority.sql` — new profile contract, operational MTT authority, V5 normalization/save/create/issue dispatch, component authority and shop separation.
4. `20261001013000_sample_batch_first_history.sql` — final capture integrity: trusted historical profile restore and shop dry totals.

The new files were prepared and validated only on disposable local PostgreSQL. No earlier migration was superseded or consolidated. Exact final hashes and changed-file boundary are recorded in the accompanying evidence JSON. No hosted schema/data state is claimed verified by this task.

## Validation and review

Tier 3 / Testing Level 3, focused on the affected formulation, persistence, documents and catalog boundaries:

- New calculation gate: accepted chip chain; three blends; 0.5/1/2 SF and another thickness; exact/shop separation; shop filler isolation; canonical Production independence from geometry; missing authority and legacy fallback; representative PDFs.
- Disposable migration/lifecycle gates: complete relevant migration chain; new Sample; save/version/issue/restore; immutable issue after Draft/profile/package changes; legacy preservation; aggregate reconciliation; forged-authority rejection; shop dry total and captured package behavior.
- Actual TenOps localhost UI: New Sample, Batch-first opening, 18/82 MTT shop baseline, unchanged chips/loading after shop filler edit, real catalog Blanco Mexicano/Blue/ATF/Resin selection, independent aggregate selections, view switching, formal issue, issued Production PDF, Sherwin 4:1 Working PDF with Production unavailable, desktop/390/320-pixel layouts.
- Production model/package regression; endpoint authentication/source/read-only regression; legacy Sample calculations and PDF replay; full paginated catalog regression; material autofill; Production PDF source status, semantic ordering, bounded text and 19-page overflow stress. Generated PDFs were rendered and visually inspected.
- TypeScript, targeted ESLint, diff checks and Production build. One Turbopack run stalled; the task-owned process was stopped and the webpack Production build passed. PDF.js emitted its existing standard-font-data warnings; rendered output was inspected.

Actual manual review: `http://localhost:3000/samples`. Representative MTT route: `http://localhost:3000/samples?open=2199209e-27b9-4a21-8b9b-475674101f60`. The environment uses the existing disposable database and full read-only catalog snapshot. It was refreshed to the actual candidate app and renderers; no hosted forwarding is used.

Review artifacts, relative to candidate worktree:

- `output/pdf/batch-first/MTT-Working-Sample-review.pdf`
- `output/pdf/batch-first/MTT-Production-Batch-review.pdf`
- `output/pdf/batch-first/MTT-Production-Batch-issued-review.pdf`
- `output/pdf/batch-first/Sherwin-Working-Sample-review.pdf`

No common MTT operational quantity remains blocked. Other profiles still require their own authoritative complete Batch contracts before Production output. There is no universal shop rounding algorithm; new instructions outside the captured cases require explicit authority. Pool Mix, Inventory consumption, allocation/reservation, multi-Batch planning and unrelated generator work remain excluded.

## Final migration hashes

- `20260930170000_sample_batch_chip_basis.sql` — `0fee212f36875a876c5888262e906f43bd3d0e07425d49a98882a51b5a3214a9`
- `20260930220000_sample_batch_reference_thickness.sql` — `ed4bca4337b17dddc741852039353ab15607f6e579ca06d2fad68d180030925c`
- `20261001010000_sample_batch_first_authority.sql` — `2b97dc567be6e3c270ab3c81c82fcc87eac36c90c746582b5cad134bfa8b4435`
- `20261001013000_sample_batch_first_history.sql` — `acb2278ab115b30136487a4d781112b610d41ad772f8fc62b96aeabbc00a471b`
