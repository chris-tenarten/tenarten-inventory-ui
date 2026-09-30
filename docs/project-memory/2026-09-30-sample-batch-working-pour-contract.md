# Sample Batch and Working Pour contract

Status: local implementation authorized by Chris on September 30, 2026. The subsequent “Batch ↔ Working Pour V1 — Implementation Authorization” accepts this contract. Hosted migrations, hosted data changes, push and deployment remain unauthorized.

The common MTT formulation has **100% Batch chip weight = 180 lb**. This is now an explicit Product decision, not an inferred historical constant. One captured formulation has two quantity views: **Batch** and **Working Pour**. Existing geometry, component calculations and historical profile quantities remain authoritative. Batch projects that same formulation to its captured profile's chip target.

This contract supersedes unresolved design recommendations in the Batch reconstruction investigation and Working Pour investigation. Their source findings remain valid. In particular, 180 lb is approved for the common MTT basis; 51.x filler is not a prerequisite; three geometry/header concepts remain separate without another Product question about merging them.

## Operator-authored composition

Chris clarified that material selection, Formula Role and aggregate blend percentages are operator-authored. The 40/30/20/5/5 blend is only an acceptance fixture, never a profile default. Every supported composition totaling 100% maps to the profile chip target; 50/25/25 maps to 90/45/45 lb and 30/40/30 maps to 54/72/54 lb for MTT. Both quantity views derive weights from those same percentages. Incomplete/overfull drafts remain editable; existing issue reconciliation still requires 100%.

## Canonical input and ownership

Add one nullable column to `public.sample_operational_profiles`:

`batch_chip_target_lb numeric(14,6)`

Meaning: **Total chip weight represented by 100% of this formulation at full Batch scale.** Null means unknown or not configured. A configured value must be finite and greater than zero, within the column's representable range. Reject zero, negative, nonnumeric, NaN and infinity inputs. Unit is fixed to lb in V1; no separate unit column or unit selector is needed.

Add the corresponding optional/nullable decimal-string property `batchChipTargetLb` to the existing captured `SampleFormulationProfile` object. Missing and null both mean no captured basis. Normalize new captures consistently to a decimal string or null. Existing captured `id`, `version`, `name`, `evidence` and formulation `profileProvenance` identify its source and revision; no redundant basis-source table or additional Batch recipe object is required.

The common managed MTT profile gets target **180** through a reviewed, identity-guarded configuration change. No global constant, supplier-name inference, or automatic default for Sherwin, Key Resin, Terroxy, Cement or custom profiles is permitted. Existing forensic profile definitions and captured versions are not rewritten.

Do **not** store separate Batch filler, resin or hardener amounts, Batch coverage, Batch volume, 4 lb/SF, or the scale factor. Those derive from the captured formulation and target. Existing independent profile rates and dry-pool diagnostics remain unchanged. The new target must not become a required input for existing Working Pour eligibility or change which active complete profile is selected for new Samples.

## Projection mathematics

Use the existing corrected V4 calculator as the authority for Working Pour results. Do not replace its client or SQL component equations.

Let:

- `T` = captured Batch chip target in lb.
- `V` = actual Working Pour volume in CFT, derived using existing dimensions and thickness.
- `d` = effective captured chip loading in lb/CFT, including an existing explicit density adjustment.
- `C` = calculated Working Pour chip weight in lb, `V × d` for supported corrected V4.
- `s = C / T` = fraction of one Batch represented by this Working Pour.
- `k = T / C` = multiplier from Working Pour to Batch, when `C > 0`.

For calculated aggregate row percentage `p`, Batch weight is `T × p / 100` lb. Existing Working Pour weight is `16 × C × p / 100` oz. The percentage and material identity are shared inputs; neither quantity is an independent recipe input.

For an eligible non-chip row, derive Batch quantity from its effective Working Pour quantity using the same `k`:

- Filler: `working_weight_oz × k / 16` lb.
- Resin and hardener: `working_fl_oz × k / 128` US gal.

Use raw numeric inputs/unrounded calculations, not six-decimal display strings, as the basis for division. A read-only projection helper may recompute exact geometry from the same captured inputs to avoid display-rounding loss; it must be tested against existing Working Pour results and must not replace the working calculator or persistence outputs. No pounds/fluid-ounce conversion is allowed.

For ordinary profile-default rows this is equivalent to `V_batch = T/d`, filler `V_batch × filler_rate / 16`, resin `V_batch × resin_rate / 128`, and hardener from the captured ratio. These are equivalent expressions, not multiple sources of truth. Prefer this cancellation where it avoids divide-by-small-volume loss, but never use profile defaults in place of effective manual row values.

Reference coverage is `V_batch / (reference_thickness_in / 12)`. Show reference thickness explicitly; do not call 45 SF the coverage at every thickness. For MTT `180/128 = 1.40625 CFT`; at 3/8 this derives 45 SF, 4 lb chips/SF, and 64 oz for a 1-SF Working Pour. Store none of these derived values as editable inputs.

## Filler and binder preservation

The common MTT acceptance formulation retains density 128, filler rate 512 oz/CFT, resin rate 480 fl oz/CFT and 5:1 ratio. Its 1-SF × 3/8 Working Pour stays **64 oz chips, 16 oz filler, 15 fl oz resin, 3 fl oz hardener**.

At the approved 180-lb chip target, derived Batch quantities are:

| Component | Batch quantity | Working Pour quantity |
| --- | ---: | ---: |
| Chips | 180 lb | 64 oz |
| Filler | 45 lb | 16 oz |
| Resin / Part A | 5.2734375 gal | 15 fl oz |
| Hardener / Part B | 1.0546875 gal | 3 fl oz |

Label the non-chip section **“Projected from this formulation”**. These are formulation equivalents at the approved chip target, not whole-package dispensing instructions. Do not round them into 50 lb or 5/1 gal. Operational package rounding is outside V1.

Changing only the ratio to 4:1 retains 15 fl oz resin and yields 3.75 fl oz hardener for this pour. The corresponding Batch values are 5.2734375 and 1.318359375 gal. Applying an ordinary Sherwin profile still produces 16/4 fl oz at this pour, subject to existing override semantics; its Batch view is unavailable until that profile has its own configured target. Do not assign it 180 solely to provide a comparison.

## Validity and manual overrides

V1 full Batch projection is supported for corrected `sample-formulation-v4-density-profile` captures with a valid target, complete positive Working Pour/chip basis, and a reconciled calculated chip composition. Earlier calculation versions remain usable under their existing Working Pour behavior; they are not silently upgraded.

The following rules avoid hiding unsupported cases:

| State | Batch presentation and behavior |
| --- | --- |
| Missing target | Show “Batch basis not captured” for existing captures or “Batch chip target not configured” for a newly selected profile. Keep Working Pour fully usable. |
| Missing/zero Working Pour | Calculated chip rows may still show `percentage × T` as composition preview. Non-chip quantities and fraction-of-Batch show unavailable until the working basis is valid. Do not substitute an assumed 1-SF pour. |
| Percentages do not total 100% | Show actual percentage and calculated subtotal alongside the separate target; flag the incomplete composition. Never normalize percentages or force the subtotal to 180. No complete Batch claim. |
| Any aggregate quantity is manual | Preserve it and its provenance. Full Batch projection is unavailable with “Manual chip quantities: review in Working Pour.” Do not infer percentages or silently discard the row. Calculated rows may remain visible as incomplete composition preview. |
| Manual filler/resin/hardener, recognized compatible unit | Project the effective captured quantity with the same `k`, marked “From Working Pour override.” This is a view of the current captured recipe, not a new approved profile default. Geometry edits retain existing manual-quantity behavior, so the projected equivalent may change. |
| Unknown/incompatible non-chip unit or legacy ambiguous `oz` liquid override | Show that Batch row unavailable with its reason. Do not guess a mass/volume conversion or substitute the profile rate. Other valid rows may remain visible, but mark the Batch reference incomplete. |
| Other role | Preserve the role and ordering. Project recognized explicit mass/volume units if unambiguous; otherwise show its working value and “Batch projection unavailable.” No new roles or inferred classifications. |
| Density, ratio or coordinated-filler adjustment | Use the effective captured formulation, preserve existing provenance, and identify customized values. Do not restore default density or ratio merely to make a familiar Batch number. |

No Batch-only limitation makes an otherwise valid legacy Working PDF or issuance invalid. Existing output rules remain in effect; new target validation applies when the new field is supplied. This feature must not turn missing provenance into zero quantities.

## Editing and primary UI

Place a keyboard-accessible segmented control at the formulation section: **View quantities as: Batch | Working Pour**. Working Pour remains the initial view on opening a Sample, preserving Marcos's current workflow. The selected view is local component state, reset on switching records; it is not recipe data, a dirty-state trigger, a saved version, or a PDF-mode selector.

Switching views must not call a mutation, refetch data, change percentages, quantities, materials, geometry, provenance, or historical state. Composition edits in either view modify the same draft rows through existing permissions and handlers.

Batch view opens with prominent **“Batch chip target: 180 lb = 100%”**, followed by Material, % and Batch quantity. Percentage and material inputs retain their existing editing authority. Batch quantities are read-only. Footer shows actual blend percentage and quantity total; only a valid 100% blend displays a completed 180-lb total. Filler, resin and hardener follow as projected quantities, clearly separated from the 100% chip denominator.

The Batch target is read-only in ordinary Sample editing. A profile-management link remains available only to users already authorized to manage profiles. No second editor for 72 lb is placed beside its authoritative 40%. Existing manual quantity editing remains accessible in Working Pour, with the fallback behavior above; switching views never converts a manual row to calculated.

Working Pour view retains existing component controls and oz/fl-oz outputs. Rename the visible “Production Pour” concept consistently to **Working Pour**, including tutorial and readiness messages, without renaming internal fields solely for terminology. Display dimensions, thickness, **Working Pour area** and the material quantities together. Keep geometry controls discoverable without requiring operators to infer them from a generic “Area” label.

Keep **Finished Plates** as a separate group with structured dimensions/count and explicitly named **Finished plate area**. Copy: “Intended pieces from the pour. Changing these does not resize the Working Pour.” Thickness remains one shared field in existing state, not two independently editable thickness values.

Keep free-text **Sample Size / Quantity** under **Document metadata**, with helper text “Printed reference only; does not set Finished Plates or Working Pour.” Do not parse, merge, synchronize or reinterpret these fields as requested delivery quantity. They remain optional under existing rules. No equality constraint between header, finished area and pour area is added.

## Profile management and revision behavior

Extend the existing Admin/Developer profile editor with **Batch chip target (lb)** and the operational definition above. Blank is allowed and means unconfigured, not zero. This preserves current authorization; the feature introduces no new RBAC grants.

Saving a target uses the existing expected-revision check, increments profile revision once, and records updater/time through existing behavior. Explicit clearing sets null. For compatibility, an older caller that omits the new key must preserve the existing value on update; omission on insert means null. A target-only change must preserve all component rates and ratios.

Include the field in the existing operational-profile query and capture conversion. Applying a profile explicitly captures its target with its existing ID/revision/name/rates. Profile changes affect future captures only. A user editing a profile while a Sample is open does not automatically replace that Sample's captured target or component constants.

Preserve existing manual density, ratio and row-override rules on profile application. Existing explicit reapplication can change profile-default working quantities: preview the changed profile revision/rates/target and resulting quantities before the user applies it. This explicit action is distinct from changing the quantity view.

## Working Sample PDF

V1 prints only the Batch basis, not a second full Batch quantity table. Marcos's executable table remains Working Pour quantities regardless of the UI toggle.

Use compact, separately labeled blocks:

- **FINISHED OUTPUT:** `6 × 6 in · Qty 4`, from structured Finished Plates.
- **WORKING POUR:** `12 × 12 × 3/8 in · Area 1 SF`, from actual pour dimensions and thickness.
- **FORMULATION BASIS:** `MTT · Batch chip target 180 lb = 100%`, from the captured profile, never today's live profile.
- **WORKING POUR QUANTITIES:** aggregate rows in weight oz, then Filler in weight oz, Resin and Hardener in fl oz.

Retain free-text headers in a separate compact **Document metadata** block labeled “Sample size reference” and “Sample quantity reference”; omit blank reference values. If they say 6x6 / 1 while structured output says four pieces, both remain visible with distinct labels. Do not present the free-text values as FINISHED OUTPUT.

Preserve established order: all aggregates → Filler → existing Other/untyped rows when present → Resin → Hardener. Do not move existing Other rows to invent a new category or regress the released ordering/pagination fix. Repeated page headings and continuation tables retain unit clarity. Do not sum dry mass and binder volume into one total.

For missing captured basis, print “Batch basis not captured” rather than fetching or assuming 180. For unavailable structured output, print “Not recorded” or omit that unavailable detail clearly; never derive it from ambiguous free text. Preserve historical working quantities and unit semantics for legacy formats.

Introduce a new PDF document-format version for the clarified layout. Existing generated issued PDF bytes remain untouched. The renderer must dispatch on the issued document's captured `document_version`, with a tested legacy fallback for existing versions; currently the Edge Function calls the same renderer and prints a shared version constant, so merely bumping that constant is insufficient. Include `document_version` in the issued-document fetch and route retry/generation accordingly. Working previews can use the new layout with honest missing-basis fallback. This is bounded version handling, not a PDF redesign.

## Snapshots and backward compatibility

The minimum new snapshot value is `formulation_state.profile.batchChipTargetLb`. Existing state and issued snapshots already retain composition/material snapshots, percentages, profile identity/version/rates, geometry, component provenance and resulting working quantities. Preserve those. The new PDF document version governs layout; existing formulation calculation-version semantics remain unchanged.

Ensure draft save, reload, duplicate, working-version save/restore, issuance and immutable document retrieval all preserve the captured value exactly. Restore must use the saved value, including missing/null, and must never resolve it from the live profile. Batch numbers remain derived; there is no second persisted array of Batch row quantities.

Existing profile ID/version alone is **not sufficient to invent missing historical basis**: managed profile revisions currently update one mutable row, not a complete historical revision registry. No retroactive MTT-by-name lookup or new hardcoded ID/version mapping is allowed in V1.

An existing draft without a captured basis stays on its captured constants and shows the honest fallback. It can explicitly apply an eligible current profile revision through the reviewed application flow. Do not automatically attach 180 on open, save, toggle, restore, duplication or PDF generation. No separate basis-only adoption feature is needed in V1. Old calculation versions retain their existing upgrade/selection boundary; this work does not silently convert them.

Historical issued snapshots, hashes, rows and Storage objects must not be backfilled. Newly issued legacy-compatible records without a basis remain allowed under existing eligibility, with missing-basis presentation. A new Sample created with the configured common MTT profile captures 180 immediately and meets the full acceptance scenario.

## Migration and implementation boundary

Prepare one narrow forward migration after implementation authorization. Do not edit any existing migration.

1. Add nullable target and its constraint with no table-wide default.
2. Extend profile-save RPC for validated insert/update, explicit null clearing, omitted-key preservation and existing revision/permission behavior.
3. Extend corrected-V4 formulation validation to accept/preserve the optional captured target and reject invalid supplied values without requiring it for legacy captures. Do not alter chip/filler/resin/hardener SQL equations or old-version dispatch.
4. Review every active creation/capture path. Normal client defaults flow through operational profiles; historical `create_sample` uses forensic defaults. Preserve that legacy path's missing basis unless it explicitly captures a configured operational profile; never synthesize 180 there.
5. Update issuance's document-version selection for future new-format documents without changing existing issued records. Preserve old document renderer dispatch and retry behavior.

Provision MTT's 180 as a separately reviewable configuration step coordinated with the migration. Before execution, identify the exact hosted common-MTT UUID/revision and verify expected density 128, dry rate 2560, filler 512, resin 480, ratio 5:1. Guard against duplicates, renamed/unexpected records and concurrent changes. On a fresh database resolve the single known seed row and its expected values; on hosted data use reviewed identity, not a runtime name convention. Preserve all rates, increment revision, record this Product decision as provenance, and leave other targets null. A mismatch is a release/configuration prerequisite to resolve, not permission to overwrite customized rates. No hosted UUID is invented in this contract.

Client deployment requires the new selected column/RPC support, so apply and verify the additive backend before enabling the client feature. Coordinate issuance and Edge renderer so new document versions cannot be queued to an old renderer. An older client must not erase the new captured target on ordinary save; if it omits that field for the same captured profile ID/version, the save path preserves the existing target. Explicit profile replacement/restore follows that replacement's own capture, including null. Cover this mixed-client distinction in SQL tests rather than relying on object spread alone.

Likely changed surfaces: profile types/query/capture/editor; formulation types and read-only projection helper; workspace/configurator/tutorial; forward SQL validation/profile/issuance functions; shared PDF model and Edge renderer; focused verifiers and evidence. No changes to catalogs, Jobs, Bid lifecycle, Formula Roles or calculation constants.

## Performance and precision

Projection is local O(number of rows). Fetch the optional target with existing profile data, and use the captured copy thereafter. Toggling performs zero HTTP/RPC calls, zero saves and zero PDF generation. No separate Batch endpoint or per-row request is needed. Preserve current profile-load and preview-cache behavior; real captured-data edits invalidate previews through the existing mechanism, while toggle state does not.

Retain full calculation precision and round only for display. Show chip/filler lb and working oz with up to four decimal places, trimming zeros; show projected gallons with up to six, prefixing rounded values with an approximation mark where needed and exposing the unrounded computed value in accessible detail. Acceptance integers/fractions such as 72 lb and 25.6 oz must display exactly. Totals derive from raw component values, not a sum of rounded labels. A displayed subtotal discrepancy from rounding gets a concise rounding note rather than secretly changing the final row. Do not use formatted PDF strings as calculation input.

## Exact acceptance scenario

Capture a new common MTT revision with target 180, default density/rates above, no manual overrides, structured output four 6x6 plates, and Working Pour 12x12x3/8 inches.

| Material example | Composition | Batch lb | Working Pour oz |
| --- | ---: | ---: | ---: |
| Blanco #1 | 40% | 72 | 25.6 |
| Blanco #2 | 30% | 54 | 19.2 |
| MOP | 20% | 36 | 12.8 |
| True Grey #1 | 5% | 9 | 3.2 |
| True Grey #2 | 5% | 9 | 3.2 |
| TOTAL | 100% | 180 | 64 |

`C = 1 × (.375/12) × 128 = 4 lb`. Thus `s=4/180=1/45`, and for every row `Batch_lb × 16 / 45 = Working_oz`. In particular `72 × 16 / 45 = 25.6`. Both views use the exact same percentages and material rows. Filler/binder remain 16 oz / 15 fl oz / 3 fl oz, with Batch equivalents 45 lb / 5.2734375 gal / 1.0546875 gal.

Acceptance also requires:

1. Switching views repeatedly changes none of the captured draft data, dirty state, working values or issued history, and makes no network calls.
2. Changing header count to one leaves working quantities unchanged. Changing structured count to one does likewise. Both changes affect only their documented output/context. The PDF distinguishes them from the pour.
3. Changing the actual pour to 6x6x3/8 gives 16/4/3.75/.75 in working units with fraction 1/180; Batch profile-default quantities remain the same. A 24x12x3/8 pour doubles working values. A 12x12x1/2 pour gives chips 85.333333… oz, filler 21.333333… oz, resin 20 fl oz and hardener 4 fl oz, with unchanged profile-default Batch equivalents.
4. Ratio-only 4:1 and Sherwin profile switch produce the distinct supported working results described above. No target is inferred for Sherwin.
5. Changing an Admin-managed target on a test profile scales only future captured Batch projections, not Working Pour component quantities; existing captures and issued PDFs retain their prior target.
6. Invalid/missing basis, incomplete percentages, manual aggregate and unsupported units follow the explicit fallback matrix without fabricated quantities or changed Working Pour eligibility.
7. Long material names, many rows and continuation pages preserve ordering and show working units clearly. UI Batch selection never turns the Working PDF into a Batch work order.

## Validation and release gates

Future implementation is **Tier 3 / Testing Level 3** because the delta touches schema, profile persistence, captured formulation provenance, issuance and PDF interpretation. Test the changed contract and adjacent compatibility, not unrelated application modules.

- Extend repository calculation tests for the exact scenario, inch/foot geometry equivalence, thickness/quantity cases, ratio/profile distinction, manual overrides, invalid percentages/targets, zero/missing geometry, unambiguous unit conversions and rounding. Assert invariance of the existing Working Pour calculator outputs.
- Disposable database tests: nullable migration on populated old schema; no Sample/snapshot rewrites; active Admin/Developer editing and unchanged denial for unauthorized users; stale revision; omitted versus null keys; same-profile old-client save preservation; explicit replacement and restore; field round trips through draft/duplicate/version/issue; invalid target rejection; no alteration to component SQL values.
- Profile provisioning tests: exactly one approved MTT identity receives 180; mismatches abort rather than guess; all other profiles remain unconfigured; current rates unchanged.
- Focused browser checks: both views, composition edits, disabled/read-only derived quantities, accessible control, missing-basis fallback, profile reapplication preview, three distinct geometry/metadata groups, phone-width layout, no dirty/save/network changes on toggling.
- PDF model and rendered-page checks: new layout, legacy document-version dispatch, immutable existing documents, correct captured basis after profile edits, header/finished/pour disagreement, long labels/overflow, and released row ordering. Use existing Sample PDF verifiers as the base; inspect actual rendered outputs.
- TypeScript, targeted ESLint, `git diff --check`, Production build, and focused EM diff/evidence review. Before separately authorized release, narrowly verify hosted schema/functions/grants and exact profile provisioning; do not infer hosted readiness from migration files.

The original design pass inspected source and Git without implementation. Subsequent implementation evidence is recorded separately in the local candidate report.

## Non-goals and remaining questions

Exclude Pool Mix handling, 51.x filler reconstruction, global 180-lb assumptions, operational bag rounding, a replacement geometry engine, automatic Finished Plates-to-pour sizing, separate recipes, arbitrary new roles, unrelated generator redesign, broad lifecycle changes, supplier compatibility inference, historical-data cleanup and old-unit repair.

**No blocking Product questions remain for this bounded V1 design.** Chris supplied the common MTT target, preservation rules and separation of fields. Other profiles can remain without a Batch basis; unavailable provenance has an explicit fallback. Exact hosted MTT identity/revision is a later engineering verification prerequisite. Local implementation is now authorized; hosted release remains unapproved.

Repository boundary inspected: dev `af334e42076311501fbab464180fa6d799cbcc4b`; all pre-existing investigation files preserved. Primary implementation references: [profile model](../../src/modules/samples/operational-profile-model.ts), [managed profile migration](../../supabase/migrations/20260923160000_sample_operational_profiles.sql), [current calculator](../../src/modules/samples/formulation.ts), [density-profile SQL](../../supabase/migrations/20260918_004_sample_formula_density_profiles.sql), [PDF model](../../supabase/functions/_shared/sample-work-order-pdf-model.mjs), and [Edge renderer](../../supabase/functions/generate-sample-pdf/index.ts).
