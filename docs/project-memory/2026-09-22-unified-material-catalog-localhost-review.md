# Unified Regular + Specialty selection — localhost review

Date: 2026-09-22. Base: `5bdbb6e5f831f26565f124ed1ab9e4d88dc9d28a`.
Status: implementation on normal `dev`, uncommitted; awaiting Chris's localhost acceptance. No push, deployment, migration, hosted writes, branch creation, or worktree creation.

## Current Product refinement: discovery remains available

The latest Chris decision supersedes strict filtering of typed Sample queries below. Blank/cleared searches remain structurally role-only. Any nonblank query searches both complete Catalog sources, grouped as **Role-matching results** first and **Other Catalog matches** second. Secondary items carry **Not classified for [Role]. Compatibility is not established.** Source and Quote required labels remain.

Within each group, exact names rank above prefixes, then name substrings, then vendor/SKU/other-field matches; ties retain existing order. No fuzzy identity suppression. Broad `fi` can reveal Pacific records only in Other Catalog matches. `Recycled Clear Glass Filler` is discoverable and deliberately selectable as a secondary Filler result despite its glass classification. This never reclassifies the record or changes Formula Role.

Deliberate secondary selection uses the unchanged metadata-only autofill. A current-draft row cue records that it was selected outside structured eligibility and does not establish compatibility. **This cue is local UI state and is not persisted across reloads**; the existing saved Catalog snapshot format, persistence contract and V4 calculation semantics remain unchanged. No new provenance fields or migrations were introduced.

Refinement delta: `samples/catalog.ts` ranking/blank-only constraint, `CatalogSearchResults.tsx` optional group/note display (PO does not opt into grouping), `SampleWorkspace.tsx` deliberate selection and current-draft cue, the two focused verifier files, and this record.

Level 2 refinement validation passed: expanded deterministic discovery/ranking/blank-search tests and existing actual selection/patchRow preservation checks; **five focused headless tests** including desktop/narrow paging, eligible-first ranking, secondary Arim selection with unchanged Formula Role/quantity, clearing back to strict suggestions, and Resin/Hardener non-compatibility text; TypeScript; targeted ESLint; diff check; Production build (22 static pages). No visible browser control or hosted data access/mutation was needed for this refinement. Git remains uncommitted on normal dev at the stated base.

Review `/samples`: Filler → clear (only structured fillers) → `fi` (Pacific only under Other) → `Recycled Clear Glass Filler` (Other, selectable) → inspect unchanged Formula Role and selected-row cue → clear again. Repeat a secondary search under Resin/Hardener to inspect the explicit non-compatibility label.

## Intent and evidence

Separate commercial Catalogs remain separate. Both sources participate in Sample and valid PO material selectors. Inspected old reference `2e1139e27073eaaad02977a4442d38220a5995a9` read-only; no merge/cherry-pick. Current code still had 250/source and 30 combined result caps, and hid a failed source when the other succeeded. Exact-name authenticated browser failure has not been established.

Read-only hosted reconfirmation through the **current search implementation**, using a service role (not RLS proof):

| Search | Matches | Source |
| --- | ---: | --- |
| Plex-A-Bond | 1 | Specialty |
| Plex | 1 | Specialty |
| Klein | 218 | Specialty, including Plex-A-Bond |
| K-Poxy Acrylic Sealer | 1 | Specialty |
| K-Poxy Flexible Epoxy | 1 | Specialty |
| K-Poxy Epoxy Terrazzo Resin | 1 | Specialty |
| TTC2 | 1 | Specialty |
| XO | 1 | Specialty |

Plex-A-Bond: Klein & Co / KCI; Resin / chemical system; Polyacrylate additive; active and quote-required; no SKU, package, or maintained price. Resin filter returns it. Acrylic Sealer is currently Resin-classified/eligible without changes. TTC2/XO are fillers with 50 lb bags. No data corrections were made.

## Port decisions

Ported/reimplemented: complete ordered paging, explicit source errors, escaped search patterns, Specialty/quote labels, quote price protection, replacing stale selection metadata, and conservative commercial identity handling.

Not copied from the old candidate:

- Unbounded result DOM: shared 50-match pages with total count, Previous/Next, and one bounded list scroller. No virtualization dependency. Every result remains reachable.
- Cross-source fuzzy/twin suppression: there is no explicit identity link proving two offers interchangeable. Preserve both source IDs even for equal names/packages; do not normalize away SKU, vendor, package or commercial distinctions.
- Old selection fallback to previous price/metadata: missing selected metadata now clears for either source, including an unpriced Regular item. Current PO authored notes, quantity, material type and Job references survive.
- Old whole-editor/workspace versions: newer PDF caching, Sample V4, Tutorial, Working Sheet, Quantity UI and ratio code remain in place.

Search columns and PO classification rules are unchanged. No MOP alias expansion, Mother/Other matching change, composite KCI normalization change, or other eligibility expansion. These remain separate backlog concerns.

## Behavior

PO search requires two characters; Sample search permits blank/one-character input within its Formula Role. Search reads both sources ordered by ID, 250 requested rows/page, until exact counts reconcile. It handles a smaller server page cap, rejects missing count, interrupted/empty pages, changing counts and duplicate IDs instead of reporting partial results as complete. Active Specialty filtering remains. Terms include exact/partial name, vendor, SKU and existing size/canonical fields.

One failed source produces an inline actionable incomplete-search message; stale results are hidden and drafts remain usable. Changing the query retries the search.

PO quote-required selection clears the prior unit price, uses no historical PO price automatically, shows a quote notice and permits existing manual quotation entry. A priced Regular selection applies that selected offer's maintained/tier price. Catalog SKU, size, component/color, package, order unit, price basis and source identity are replaced/cleared from the selected record. Existing Chip order-unit convention remains Bag. Historical price suggestions remain the existing explicitly requested, separately labeled path.

Sample selection writes only supported material/Catalog metadata. Missing metadata clears stale size/type/vendor; quantity/provenance, component role and formulation authority are not changed. Selection does not change the calculation version, density, Chip Mix, Filler independence, resin/hardener ratio, Tutorial or Working Sheet logic.

## Validation — Level 2

Application behavior changed; no schema, auth policy, persistence contract, issuance, PDF or calculation semantics changed. Focused validation only:

- `node scripts/verify-unified-material-catalog.mjs`: actual search/mappers/pricing plus extracted current PO selection and Sample patchRow callbacks; >250 rows, smaller server caps, exact/partial/vendor/SKU, malformed punctuation, one-source failures, missing counts/interrupted pages, six products, all five PO types, distinct commercial offers, quote protection, stale metadata, switching back, V4 authority/provenance across four roles.
- `npx tsx scripts/verify-purchasing-catalog-pricing.mjs`: maintained/tier prices, units, vendor mappings. Updated prior duplicate-suppression assertion to preserve two distinct source records.
- `npx tsx scripts/verify-sample-material-autofill.mts` and `npx tsx scripts/verify-sample-formulation-reactivity.mts`: pass; corrected V4 math/reactivity unchanged.
- Focused headless `tests/e2e/unified-material-catalog.spec.ts`: PO selection/switching and failure; Sample complete 277-match fixture, all six products, paging and failure at 1440px/390px. Only 50 result options mount. Search plus five page transitions measured 492ms desktop / 456ms narrow in one local run (fixture timings, not a hosted performance SLA). All REST/auth are intercepted; incidental app-shell read-receipt requests are mocked. No hosted fixtures or residue.
- TypeScript, targeted ESLint and `git diff --check`: pass.
- `npm run build`: passed; optimized compilation, TypeScript and all 22 static pages completed.

One older verifier, `verify-sample-v4-contract.mjs`, fails because it expects the removed phrase “Profile default · oz within the dry-material pool”. Reproduced against unchanged HEAD via read-only Git source substitution. Left that unrelated stale verifier untouched; used the current autofill/reactivity checks plus actual patchRow preservation assertions.

Initial sandbox restrictions prevented Chromium/tsx worker startup and Turbopack port binding; those checks were rerun with the normal tool escalation. No visible Chrome/computer-use control was used.

## Auth and review gate

Service-role reads do **not** establish authenticated/RLS behavior. Headless fixture auth also does not. The repository's local Auth QA stack is a separate local Supabase environment; it cannot establish the currently installed hosted Catalog policies. Chris's real authenticated localhost session targets the configured hosted Supabase and can meaningfully verify read access without a deployment. No real-user credentials/session were accessed by automation.

Real-user acceptance remains pending. TenDev is warranted after localhost acceptance only if hosted-environment/session behavior still needs confirmation; no Preview or automatic deployment is part of this pass.

## Changed-file boundary

- `src/modules/purchasing/catalog.ts`
- `src/modules/purchasing/catalog-records.ts`
- `src/modules/purchasing/catalog-pricing.ts`
- `src/modules/purchasing/types.ts`
- `src/modules/purchasing/CatalogSearchResults.tsx` (new)
- `src/modules/purchasing/PurchaseOrderEditor.tsx`
- `src/modules/samples/SampleWorkspace.tsx`
- `src/modules/samples/material-autofill.ts`
- `src/modules/samples/catalog.ts` (new; role eligibility)
- `scripts/verify-unified-material-catalog.mjs` (new)
- `scripts/verify-purchasing-catalog-pricing.mjs`
- `tests/e2e/unified-material-catalog.spec.ts` (new)
- This record.

## Chris's localhost acceptance

1. `http://localhost:3000/purchasing`: New Purchase Order → Resin → Search Catalog. Search `Plex-A-Bond`, `Plex`, `Klein`; select Plex. Confirm Specialty / Quote required, blank SKU/package/price and Polyacrylate additive. Start from a priced catalog item first to verify stale metadata clears; return to a priced item to verify its maintained price returns. Keep an authored Description/quantity to verify preservation. Check the other three Resin products; use Filler for TTC2/XO. Existing five PO types and mixed lines remain available.
2. `http://localhost:3000/samples`: New Sample (or a disposable unsaved local draft) → material Color search. Choose the appropriate Formula Role, then search `Klein`; pagination includes all matches eligible for that role. Use Resin for Plex. Check each other acceptance product, correct metadata and unchanged formulation/quantities. Review desktop and narrow presentation. No saving/issuance is necessary for search acceptance.
3. Confirm the authenticated account can read both sources. No claim of actual authenticated hosted acceptance is made until this review.

Git refs stay at the base SHA; only the listed uncommitted boundary is intended. Existing isolated worktrees, Production and TenDev branding are untouched.

## Localhost correction — Sample role eligibility (2026-09-22)

Chris reproduced Filler search `fi` returning Pacific Abalone/Clear Glass. Root cause: Sample called `searchPurchasingCatalog(query)` without a material/role constraint, and its effect depended only on query and row index. `fi` matched the name **Pacific**; there was no Filler eligibility decision at all. Role changes did not rerun the search. Clearing previously stopped search at the two-character guard; it did not establish a role-constrained browse mode. Editing Color also retained the prior catalog link/snapshot and selection metadata.

The PO classifier separately includes product-name text in its legacy type filtering. Reusing that predicate for Sample would incorrectly treat the word Filler in a product name as eligibility. PO filtering is preserved unchanged; Sample now has its own structured-classification predicate.

Correction:

- Preserve raw category/material class/material type/component type on transient suggestions; no persistence/schema change.
- Sample role eligibility AND query, followed by the existing 50-row display paging. Blank and single-character searches also require the current role. Complete source loading/error handling stays shared.
- Structured hardener/Part B wins over broad resin/epoxy family, and is confined to Hardener. Explicit filler is confined to Filler. Resin/epoxy is Resin; aggregate/chip/marble/glass is Aggregate; Other recognizes explicit other/misc/pigment/colorant. Product names and user queries never determine eligibility.
- Search key includes current row, role and query. Old-key results remain hidden during refresh; stale requests are ignored. Selection rechecks current-role eligibility.
- Role changes clear a previous selected product and its catalog metadata while retaining the existing role-change calculation/provenance behavior. Color replacement/clearing unlinks catalog identity and drops the old snapshot (including SKU). Size/type/vendor/unit still owned by that selection clear; independently authored overrides and quantities/provenance are retained.

### Recycled Clear Glass Filler: read-only data finding

Three Regular Arim rows (#0/#1/#2):
`4e35440f-bc21-4d46-9368-f07209c9f8d4`,
`09ed2dc3-e406-4141-8fc1-f3c04bf298e9`,
`6e33598d-1f1a-4749-90e2-95dfb3b2e406`.

Full narrow row inspection confirms category `glass`, material_class `recycled_glass`, no separate Filler eligibility flag, and pricing notes only. Displayed classification was accurate; this was not a mapping defect. Name matching explained appearance in the unfiltered Sample search. The word Filler alone does not establish Formula Role eligibility. These rows remain Aggregate-eligible and are excluded from Sample Filler results. The name/classification discrepancy is a separate data-quality/semantic review item; whether their intended formulation use requires a classification correction is not established by these records alone. No hosted reclassification occurred.

Observed active Specialty hardeners: Morricite Grout Hardener (MTT) and Epoxy Hardener (Key Resin), each category resin / material_type epoxy / component_type hardener. This supports using component metadata to distinguish Hardener from the broad resin family.

### Correction validation

Level 2, application behavior only. Passed expanded unified deterministic verifier (including all six requested regressions, name-vs-classification, packaged metadata/SKU clearing and preserved authored overrides), four focused headless tests, existing Sample autofill and V4 reactivity checks, TypeScript, targeted ESLint, diff check and Production build (22 static pages). Headless fixture assertions are scoped to the Catalog listbox, excluding native Formula Role options. Broad Aggregate fixture has 270 eligible matches; search plus five page transitions measured 452ms desktop / 456ms narrow in this run. No unrelated full suites or visible browser control.

Review again at `/samples`: Filler → `fi` (no Pacific/Glass Filler), clear (only eligible fillers), switch to Resin/Hardener/Aggregate and repeat typed/cleared searches; select then clear/replace a product and inspect metadata. All changes remain uncommitted on normal dev, within this same Unified Catalog boundary.
