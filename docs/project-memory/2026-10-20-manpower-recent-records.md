# Manpower selected-period records — local integration refinement

Branch `perf/waves1-4-integration`, existing worktree `.worktrees/performance-integration`, parent `e902bf3b018226fa49527b2a99cf45197bc3668e`. The local commit containing this report is the updated candidate; resolve with `git rev-parse perf/waves1-4-integration`. Implementation, validation and local commit only. Stop for Product/Architecture review.

## Result and retrieval contract

The selected report period now owns both analytics and the editable reporting records. Initially this is the existing inclusive 30-day period. The existing complete, counted, cancellable `loadManpowerReportFacts` query runs once for both views. No duplicate editor query and no automatic all-history read were added. Its earliest/latest boundary facts still support existing analytics labels; facts outside the selected period never appear in the period editor. Existing reporting groups retain their collapsed presentation and expose actual editable rows on expansion without further retrieval.

Period and Job changes hide obsolete records immediately, clear selections, cancel obsolete reads and publish only the matching result. The existing 30/90/calendar-year calculations, integer-hour arithmetic, grouping, search vocabulary, Job/product filters and archived target compatibility are retained. Empty periods say that no labor entries were recorded. Period/reference failures have explicit retry controls; failures do not retry automatically.

**Load complete history** explicitly retrieves every authorized historical entry using the existing complete pagination helper. Recent records remain visible during this read; their controls are temporarily disabled to avoid edits racing with replacement of the facts. Failure preserves the recent records and offers Retry history. Success exposes complete history, including empty groups and archived Jobs. Show selected period / Show complete history switches reuse that complete in-memory collection; changing the period returns to its matching records. A period chosen while history is loading remains selected when history arrives. Full-history completion takes precedence over any concurrent period result.

Period-only groups are not treated as complete identities: whole-group Job/name changes, new lines and empty-group creation require complete history. Explicit row selection and row edits remain available on recent records under existing write permissions. Totals say MATCHING for a period subset. Whole-group changes after history loads use the complete group identity, including older hidden entries. The all-dates Job summary appears only in complete-history view, with its original all-dates semantics. The Product Category filter remains usable in the period-only Job view. An ambiguous bulk-category response reconciles the selected period rather than silently fetching all history; obsolete reconciliation results cannot replace a newer period.

## Synthetic before/after observations

One local browser observation per candidate, fixed October 20 clock, identical 12,001-entry fixture, provider cap **137**, 1,201 entries in 30 days and 1,801 in 90 days/year. Baseline export was built from `e902bf3` at localhost:3355. Final export was built for and verified at localhost:3000. These are local JSON-body/readiness observations, not SQL timings, compressed transfer sizes, statistical benchmarks or Production latency gains.

| Labor retrieval / readiness | Integrated baseline | Refinement |
|---|---:|---:|
| Initial analytics ready | 314 ms | 321 ms |
| Recent editable records ready automatically | Unavailable until manual history request | 323 ms |
| Initial labor reads / JSON bytes | 11 / 845,153 | 11 / 845,153 |
| 90-day switch ready | 122 ms | 134 ms |
| Additional 90-day labor reads / bytes | 16 / 1,277,758 | 16 / 1,277,758 |
| Explicit full-history readiness after that switch | 808 ms | 808 ms |
| Additional full-history reads / bytes | 88 / 8,630,607 | 88 / 8,630,607 |

The initial 1,203 transferred rows include two boundary responses, with deduplication in the unchanged helper; exactly 1,201 period records are displayed. Full-history retrieval transfers 12,001 rows. Timings are reasonably comparable in this observation; the improvement is immediate utility with unchanged labor retrieval cost. Raw cumulative observations: [baseline](evidence/2026-10-20-manpower-baseline-measurement.json), [refinement](evidence/2026-10-20-manpower-refinement-measurement.json). Reproduce final measurement with `PERFORMANCE_REVIEW_ORIGIN=http://localhost:3000 node scripts/measure-manpower-refinement.mjs` while the review server is running.

## Focused validation and diff review

Risk Tier 3; focused Testing Level 3 for partial/complete group identities, persistence compatibility and historical edits. No database, policy, calculation, PDF or auth implementation changed, so no new database migration/security suite was required. Prior hosted security and calculation evidence remain scoped to their original inspection dates.

`node scripts/verify-manpower-refinement-browser.mjs`: **8 checks passed**, zero page errors, zero external requests, zero hosted writes:

- Automatic 1,201-row default above the provider cap; real editable worker/task/hour/note fields; recent note save; scoped selection; unchanged analytics; 90-day/year completeness.
- Out-of-order period and Job changes; no mixed results; Job/product/search filtering; no implicit all-history reads.
- Empty database and empty period with older boundary records; no historical rows leaked into the period view.
- Period denial settles, no retry loop, explicit retry restores all period rows.
- History denial retains recent rows; explicit retry loads all 12,001; archived Job note edit preserves Job identity and hours; cached period/history switches do not fetch again.
- A period selected during history loading survives history completion.
- Read-only account sees recent records with disabled write controls.
- Same-account SIGNED_IN and dispatched focus preserve an unsaved draft without labor reload; Messaging coexists; navigation reloads correctly; another account clears former rows.

[Browser evidence](evidence/2026-10-20-manpower-refinement-browser.json). Focus was an automated focus-event check, not a physical multi-tab acceptance claim. A separate exact-origin smoke verified Sample library loading, complete Proposal library loading, disposable local creation and the existing PDF renderer/download: [review-origin evidence](evidence/2026-10-20-manpower-review-origin.json).

Final candidate Production webpack build, TypeScript, targeted ESLint and `git diff --check` all passed. Diff/evidence review checked boundary exclusion, cancellation, denied/empty states, complete identity gating, full-history versus period publication races, all-dates summary labels, scoped reconciliation and original source boundaries. The only application changes are `ManpowerWorkspace.tsx` and `ManpowerAnalytics.tsx`; query helpers, calculations, permissions, auth, Activity and every other module are byte-identical to the parent. The original Wave 1–4 refs and main/dev refs are unchanged: [source/ref receipt](evidence/2026-10-20-manpower-refinement-boundary.json).

The seven prior integrated workflow groups remain documented in [the integration report](2026-10-19-performance-integration.md) and [its browser evidence](evidence/2026-10-19-integration-browser.json). Six unaffected groups were not repeated. The affected Manpower/Messaging behavior is covered above, and the maintained integration verifier now expects automatic records and the new history button. Historical evidence files were preserved.

## Local Product review and remaining considerations

Review **http://localhost:3000/manpower-reporting**. Port 3000 was unoccupied before startup; no other candidate process was replaced. The existing integration adapter serves the actual export and one synthetic source, with disposable local Manpower note/hour PATCH support added for validation. No hosted forwarding is enabled. Full application review is available at http://localhost:3000. Restart from this worktree with `PERFORMANCE_REVIEW_PORT=3000 ./node_modules/.bin/tsx scripts/start-performance-integration-review.mts`; the export must retain the local-only public configuration used for this build.

Product/Architecture should review the automatically populated collapsed reporting groups, scope labels and explicit complete-history transition. Existing release considerations and Wave 1 acceptance remain in the integration report. Production latency is unmeasured for this refinement; full history still incurs its complete authorized retrieval cost, and multi-request reads retain the existing non-snapshot consistency limits. No push, deployment, migration, hosted mutation, release preparation or unrelated cleanup was performed.
