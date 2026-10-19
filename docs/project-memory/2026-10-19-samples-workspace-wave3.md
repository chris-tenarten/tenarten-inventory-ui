# Samples workspace performance Wave 3 — local advisory candidate

Branch `perf/samples-workspace-wave3`; persistent worktree `.worktrees/samples-workspace-wave3`. Base `da21615ad6f06727e4f18a75c65331a7266d2404`. Resolve the local candidate commit with `git rev-parse perf/samples-workspace-wave3`. Tier 3 / focused Testing Level 3 because async draft state and historical document access are involved. No release preparation, push, merge, hosted writes, schema changes, dependencies, or applied migrations.

## Findings and implementation

`list_samples` is the principal unresolved payload bottleneck. The repository definition in `supabase/migrations/20260917_001_sample_formulation_foundation.sql` aggregates current rows, every working-version snapshot, and every issued snapshot for every Sample. `queries.ts` maps working versions to metadata, discarding their snapshots after transfer. Issued mapping uses snapshot-derived identity, Production source keys and readiness; the library also requires material previews, version counts and generated status. A naive header-only query would lose visible behavior. Hosted SQL state and latency were not inspected; this finding is based on current repository contracts.

New-draft URL initialization previously waited for the entire library, then geometry defaults, then color-plate suggestion in sequence. It now starts independently, with the two setup reads in parallel. The New Sample action also runs those two reads concurrently. Counts, default normalization, numbering authority at save time, and business formulas are unchanged.

Initialization depended on the profile display name. A revalidation returning a changed display name could repeat all four library/options reads and replace an edited directly opened Sample. The effect now uses stable workspace dependencies and reads the latest preparer name only when constructing a new local draft. A monotonic draft revision rejects late initialization after edits or selection. Independent Bids, Jobs and Vendors publish their own results instead of being discarded together when one fails.

Library reads abort superseded requests and on unmount; only the current mounted request may publish its list or finish loading. Initial errors resolve without retry loops. Other option reads retain their existing contracts and ignore results after cleanup. Catalog search already has debounce, result-key validation, cleanup and concurrent complete reads of both catalogs; it remains unchanged. Operational profile loading already has mounted-result protection. Supplier loading retains the baseline shared loader; Wave 2's independent completeness correction is not copied into this candidate.

Collapsed checkpoint history now defers version-row DOM creation until expanded. All versions remain in memory and all rows appear when opened; this is not pagination or payload reduction. Checkpoint refresh rejects a changed selection/edit while awaiting its library read. Working/checkpoint PDF completion and issued-document opening reject results for another selected Sample or an unmounted workspace. Existing PDF cache keys, calculations, saving/issuance/snapshot routines, permissions, shared auth and generated document content are unchanged. No shared auth defect was found.

## Measurements and limits

Evidence: [before](evidence/2026-10-19-samples-wave3-before.json), [after](evidence/2026-10-19-samples-wave3-after.json), [profile revalidation](evidence/2026-10-19-samples-wave3-profile.json).

| Observation | Before | Candidate |
|---|---:|---:|
| New-draft readiness, one synthetic browser observation | 1,928 ms | 421 ms |
| Initial list/default/suggestion requests | 1 / 1 / 1 | 1 / 1 / 1 |
| One-Sample list response, JSON bytes | 7,452 | 7,452 |
| Collapsed 600-version history article rows | 600 by source behavior | 0 measured; all 600 available on expansion |

Delays injected identically: library 900 ms, defaults 200 ms, suggestion 200 ms. The expected dependency wait changes from 1,300 ms to 200 ms, excluding hydration and rendering. These are single local observations, not benchmark averages or authenticated Production latency. The before browser used the preserved Wave 1 export at port 3000, whose Samples source matches canonical baseline; unrelated global awareness behavior differs. Do not attribute the entire observed timing difference exclusively to Wave 3. There is **no measured request-count or payload reduction for normal initial loading**. A profile-name refresh now leaves list/Bid/vendor reads at one each; baseline dependency behavior would repeat them (baseline comparison here is source-derived).

Large synthetic case: 120 Samples, 600 historical snapshots on one Sample, 5,458,847 JSON bytes. Existing Inspector/list still wait for the full RPC payload. No Production improvement is claimed for that bottleneck. Catalog check observed one request to each existing source with complete fixture counts; no catalog reduction is claimed. Selecting an already loaded Sample requires no new list/detail request; this behavior is preserved. Navigation away/back still fetches a fresh library, intentionally avoiding a cross-mount/account cache.

## Verification

[Validation receipt](evidence/2026-10-19-samples-wave3-validation.json) and [disposable lifecycle](evidence/2026-10-19-samples-wave3-local-lifecycle.json).

- Seven focused browser cases passed: new-draft readiness, delayed initialization versus selected unsaved draft, denied library with usable new draft, empty library, large complete library/history and restore, material Catalog, independent option failure/navigation cleanup. Additional profile-name revalidation case passed with unchanged unsaved input and one library read.
- Actual local components created a new Sample and its first checkpoint in one action with exactly one create RPC, restored a checkpoint, rendered a working PDF, generated an issued document and reopened it through existing endpoints. Synthetic mutations remain in server memory. The local renderer produces actual `%PDF` documents. This does not certify hosted persistence, RLS, Storage or historical PDF parity beyond the unchanged production contract.
- Existing access-refresh verifier: eight initial groups and seven remaining Sample/session groups passed, including initial restore, direct entry, navigation back, fresh sign-in, continuing SIGNED_IN/token rotation, unsaved Inspector/node retention, denied/missing/failed verification, distinct login, sign-out and account switch with stale responses, and working PDF. The full run stopped at an unrelated My Work composer because this Sample adapter lacks messaging recipients; that unchanged scenario was excluded from the follow-up, not counted as passed. Previously accepted shared-auth evidence is reused.
- Three native Chrome tab-switch attempts generated zero hidden/visible events. This is not physical refocus certification. Simulated continuing-session events passed. Manual physical refocus remains part of Product review.
- `tsx scripts/verify-sample-batch-first.mts` passed calculation, proportions, authority, package and PDF-model integrity. Shared formula/ratio/snapshot/auth sources are byte-identical to baseline.
- Final application-source Production webpack build and TypeScript passed. Targeted ESLint and `git diff --check` passed. Build uses synthetic localhost public configuration and is not a deployable artifact. New test locators were corrected after an assertion ran before the empty-state request; the app did not fail that case. Final fixture support was checked through the local lifecycle verifier.

## Database authorization needed

Recommend a separately reviewed, narrow forward migration adding a capability-equivalent, deterministically ordered complete summary RPC and a selected-Sample detail contract. Summaries must retain all visible/search/filter fields, material/formulation preview inputs or equivalent server-derived previews, complete version/issue counts, generated status, creator and canonical Job context. Detail should return current formulation/rows plus complete version metadata and issued metadata with the exact snapshot-derived identity/readiness/source-key semantics. Historical bodies remain accessible through existing version/issued PDF authority; never substitute current state for issued snapshots. Keep existing RPC consumers compatible until explicitly migrated.

Do not send a smaller PostgREST projection over the existing JSON RPC as a substitute: it would still build expensive historical JSON. Repository table grants/RLS suggest direct reads may be possible, but safely assembling all counts/derived contracts client-side would add fan-out and require hosted compatibility verification. This candidate does not change that boundary. No migration was drafted or applied.

Remaining risks: initial existing-Sample readiness and complete-library payload remain unbounded by history; expanded very large histories still render all rows. Independent source failures share the existing error area. Existing mutation workflows and historical calculation/document lifecycle were preserved, not broadly redesigned or exhaustively re-certified for every concurrent write interaction. The focused stale-result changes cover initialization, list publication, checkpoint reload and document viewing. There is no new timeout or automatic retry policy. Review this bounded candidate before authorizing any broader mutation concurrency or DB work.

## Product review

Port 3000 remains the active Wave 1 candidate; port 3322 remains Wave 2. To preserve those reviews, Wave 3 uses **http://localhost:3333/samples**. Actual exported application, synthetic session and disposable in-memory Samples; no credentials or hosted business writes. Chrome is opened with the provided launcher.

From this worktree, restart if needed:

```sh
SAMPLE_REVIEW_PORT=3333 ./node_modules/.bin/tsx scripts/start-sample-job-update-review.mts --fixture-auth
node scripts/start-samples-wave3-browser.mjs
```

The existing `out/` is the verified local artifact. The launcher installs only a synthetic session in its isolated Chrome context. Restarting the server resets disposable records. Review existing Inspector, New Sample/Resin System selection, Save Version, restore, PDF generation/reopening, unsaved edits during continued session revalidation, away/back, and physical tab refocus. Large/failure/delay fixtures are exercised by `node scripts/verify-samples-wave3.mjs`; `--profile-only` is the isolated revalidation case. No new test framework or global cache was added.

Canonical main/dev remain `da21615`; Wave 1 remains `71f6915`; Wave 2 remains `8f26471`. Root audit/release receipts and unrelated work are preserved. **STOP for Product/Architecture advisory review.**
