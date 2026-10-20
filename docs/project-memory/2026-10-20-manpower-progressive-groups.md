# Manpower progressive historical groups — local Product candidate

Branch **`perf/manpower-progressive-groups`**, persistent worktree `.worktrees/manpower-progressive-groups`. Parent/released baseline **`01e5e839fdba0256023077cf1d85c2d4dd15212c`**. The commit containing this report is the completed local candidate; resolve with `git rev-parse perf/manpower-progressive-groups`. Local investigation, implementation, validation and commit only. No push, merge, migration, hosted mutation, deployment or release preparation.

## Constraint and chosen contract

The released page already retrieves complete group metadata and selected-period facts, but its manual history action waits for a complete raw-entry read before publishing history. A period slice can omit other members of the same group. Neither sliced entry pages nor arbitrary first-N groups can safely supply final group totals.

The existing authenticated tables support `reporting_group_id IN (...)`, a null-group filter, exact counts and immutable entry IDs. That is sufficient for compatible complete-group batches; no new RPC/schema/policy is required. Group ordering reuses the existing reporting-date prefix, then creation/name/id fallback. Metadata has no authoritative latest-work-date aggregate, so this does not invent ordering by an unverified per-group maximum work date. Repository migration source defines a group/date index; no hosted plan/index claim or change was made.

Selected-period analytics retain their existing inclusive 30-day default and calculations. The editor now displays **complete group membership across all dates**, explicitly labeled independently of the analytics period. The selected-period group view means groups containing work in that period, with complete membership, rather than partial group totals. This visible distinction is a Product review point.

## Implementation and request lifecycle

- Selected-period facts/boundaries load first through the unchanged report helper. Analytics become usable immediately from that complete period read.
- A single account-owned worker then prioritizes groups found in the selected period. It requests at most **eight group IDs per batch**, requesting **500 rows per page** with `id > last_id`, ordered by immutable ID. Actual provider caps are honored. Each batch finishes every member before any of its groups are published.
- After recent groups, remaining group metadata is traversed in its existing newest-first order. Ungrouped entries form one separately completed scope. Empty named groups become available once their membership query is complete. There is no history cutoff.
- Publication appends whole groups without re-sorting existing ones. Expanded state and existing row objects survive new batches. An eight-group bound limits query size and publication churn; it does not limit a group's membership. A very large group can require many requests before its card appears.
- Between batches the worker yields for 32 ms and pauses when the document is hidden. An in-flight complete-group batch may finish before pausing. Navigation, account changes and explicit Refresh cancel/obsolete the prior worker. Period changes reprioritize unrequested groups, retaining completed groups rather than restarting history.
- A failed batch publishes none of its incomplete groups, preserves existing groups, and stops until **Retry older groups**. No automatic retry loop. Period/reference failures retain their explicit retry behavior.
- Per-page remaining counts, monotonic IDs and cross-batch duplicate detection reject observed membership drift. A final authorized **HEAD count** must match cached unique entries before “All available history loaded” appears.
- Complete history is available automatically; **Selected-period groups only / Show all groups** are view filters, not fetch buttons. Once history is complete, period changes and view switches reuse it without further labor reads.

This is component-owned data, not a new general caching framework. Calculations, auth/refocus infrastructure, permissions, target compatibility and all other modules remain unchanged. The existing write capability also disables whole-group selectors for read-only accounts; no RBAC/RLS policy changed.

## Search, edits and integrity

Existing Job/product/text matching is retained. During retrieval, the UI states how many reporting groups are loaded and that search covers loaded complete groups, not exhaustive history. Results grow as additional complete groups arrive. Existing nested Worker/Task/Job labels do not have a compatible complete server-text-search RPC, so no misleading server-search claim or database workaround was added. After final coverage reconciliation, search is exhaustive for this authorized retrieval. Clearing it restores the same published order.

Row edits, archived Job edits, new empty groups and new lines work before global history finishes. Whole-group actions use the complete cached identity; filtered rows retain MATCHING labels. Bulk moves offer completed destination groups, avoiding operations against unretrieved context. New user-created groups are registered as complete and follow the existing explicit creation behavior. Ambiguous bulk-category responses reconcile affected complete groups, not a period slice or replacement of global history; changing periods does not discard that reconciliation. A new account/load generation invalidates it.

The all-dates Job summary still waits for complete history and retains its all-dates calculation contract. It is placed after the records so background completion does not insert it above the browsing position; the product filter remains available above the list. Stable member arrays, memoized group headers and a stable Product context avoid repeatedly rendering unchanged collapsed groups. These targeted corrections followed an observed stress-case rendering deficiency; no broad frontend refactor was performed.

## Comparable synthetic measurements

One final observation per export, actual components at exact `localhost:3000`, fixed October 20 clock, identical fixture and **20 ms simulated delay on every labor request in both versions**. DOM MutationObserver timestamps are relative to navigation; polling observations are retained separately. These are synthetic observations, not Production latency, compressed transfer sizes, SQL execution times or statistically established gains.

Fixture: **1,013 named groups + one ungrouped scope; 12,888 entries; provider cap 137**. The selected period contains 1,201 rows. Its eight groups have 1,207 complete members because one includes six older archived-Job rows. A historical group contains 1,501 entries; metadata itself exceeds 1,000 groups.

| Observation | Released baseline | Candidate |
|---|---:|---:|
| Selected-period analytics ready | 481 ms | 586 ms |
| Recent rows / complete recent groups usable | 481 ms, period slices | 880 ms, complete groups |
| First older group automatically available | Requires manual action | 1,247 ms |
| All history displayed, from navigation | 4,122 ms, after harness clicks history | 9,080 ms, automatic and yielded |
| Initial labor protocol reads | 11 | 20: 11 period + 9 recent-group context |
| Initial fact rows / JSON bytes | 1,203 / 839,396 | 2,410 / 1,681,691 |
| Total reads after complete history | 106 | 160 |
| Total fact rows / JSON bytes | 14,091 / 10,053,038 | 14,091 / 10,053,091 |

Candidate background group reads total **148**, including the nine needed to complete recent groups, followed by one final HEAD coverage read; initial analytics use 11 reads. Complete-history reads therefore total 160. All group reads were serial in the normal browser test and had unique request paths; no published group was refetched. Period/group-context overlap is intentional completeness work, not duplicate publication. Poll-time snapshots can include already-started older batches; classified initial protocol figures above exclude those unrelated reads.

The candidate deliberately takes longer to finish all history while yielding between batches and maintaining an already useful workspace. It transfers approximately the same total fact JSON as manually loading released history, with 54 additional reads in this capped stress fixture. It does not minimize requests at the expense of the accepted browsing goal.

The two view toggles settled in **63 ms** combined in the final observation. Final animation-frame intervals: **p95 45 ms, p99 56 ms, maximum 102.1 ms** across 481 samples, with 13 over 50 ms. The 1,000-group stress view still exhibits occasional frame hitches; this is not a claim of 60 fps. An intermediate render diagnostic motivated memoizing unchanged headers. Native scroll anchoring changed absolute scroll offset by 16 pixels while the checked content anchor remained within half a pixel; expansion and an unsaved draft survived the entire stream.

[Released baseline](evidence/2026-10-20-manpower-progressive-before.json), [final candidate](evidence/2026-10-20-manpower-progressive-after.json), [intermediate rendering diagnostic](evidence/2026-10-20-manpower-progressive-render-before.json). Reproduce with `node scripts/measure-manpower-progressive.mjs`; `--baseline` requires serving the preserved released export through the same local adapter.

## Validation and evidence review

Risk **Tier 3 / focused Testing Level 3** for group completeness, persistence compatibility and historical operations. No database/security suite was repeated because schema, policies, auth source and write API contracts were unchanged.

- **8 deterministic retrieval checks passed**: complete metadata above 1,000/provider caps; complete cross-period and 1,501-member groups; null scope and coverage count; immutable cursor requests; priority/batch limits; count drift, repeated IDs, short/empty data, missing count and denial; cancellation. [Retrieval receipt](evidence/2026-10-20-manpower-progressive-retrieval.json).
- **10 focused browser checks passed**: automatic complete groups, incremental history, every group's counts/totals, no duplicates and serial requests; stable order/visible anchor/expanded state/unsaved draft; failure and explicit retry without refetching published groups; period/Job races and scoped filters/search; exhaustive tail search and cache-only switches after completion; historical archived edit and all 157 members of a whole-group change; denied period; empty-history Refresh invalidation; read-only and account/navigation lifecycle; creation before full history; ambiguous category recovery across period changes; controlled visibility pause/resume. [Browser receipt](evidence/2026-10-20-manpower-progressive-browser.json).
- Production webpack build, standalone TypeScript, targeted ESLint and `git diff --check` passed on final application source. The rendering/cache correction was rechecked against the same eight behavior groups; the narrow recovery and visibility checks completed coverage without rerunning unrelated suites.
- Exact-origin smoke verified library loading, disposable local creation and the existing PDF renderer/download. Recent/older screenshots were inspected. Capture assertions passed; a one-off cleanup request made after browser closure failed, then an independent local reset succeeded. [Origin receipt](evidence/2026-10-20-manpower-progressive-review-origin.json).
- Diff/evidence review covered atomic publication, cursor/count failure, null scope, unknown/moved membership detection, generation cancellation, local edit preservation, read-only controls, creation/reconciliation and complete-versus-period totals. Application delta is confined to four Manpower files. Original calculations, target compatibility, all other modules, schemas/RLS and canonical/rollback refs are unchanged. [Boundary receipt](evidence/2026-10-20-manpower-progressive-boundary.json).

The ten browser checks are bounded workflow groups; related assertions such as exhaustive search and post-completion cache reuse share their historical-edit group. Prior integrated workflow and release receipts are preserved and reused for unaffected modules. No comprehensive audit or unrelated feature suite was run. Focus/visibility checks are controlled events, not a new physical tab-switch or live authenticated hosted-data certification. All verification used disposable synthetic local data; hosted reads and writes were zero.

## Review, limitations and recommendation

Review **http://localhost:3000/manpower-reporting**. The prior confirmed TenOps review process on port 3000 was stopped; the new persistent review process serves this candidate with synthetic records and 20 ms local labor-request latency. No other candidate process/worktree was replaced. From this worktree, restart with `PERFORMANCE_REVIEW_PORT=3000 ./node_modules/.bin/tsx scripts/start-manpower-progressive-review.mts`; the local export was built with localhost-only public configuration and `NEXT_PUBLIC_DEV_BRANDING=false`. Review has searchable “Historical edit target” and cross-date/archived members, plus local creation/edit support.

**Functionally ready for focused Product/Architecture review; not released.** Product should accept the full-membership/all-dates group labels, automatic stream, search scope and large-history interaction cost before any later release authorization. No material database-contract blocker was found. No Production speed improvement is claimed.

Remaining limits: group metadata is still retrieved completely at entry; an exceptionally large group must finish before publication; visible pages may eventually retrieve all authorized history and keep it in account-owned memory; hidden-page pauses occur between batches; the stress view retains some frame hitches. Reads are counted and checked but are not a transactional database snapshot—concurrent same-count external changes may require explicit Refresh. Existing oversized whole-group write request/response limits were not redesigned. No new Realtime subscription was added; explicit Refresh and current lifecycle invalidation retain the released external-change behavior. Hosted query plans and authenticated real-data performance have not been measured.

Canonical main/dev, the October 20 release, previous rollback refs, independent wave worktrees and root-local release receipts remain preserved. Stop for Product/Architecture review. No push, merge, hosted mutation, migration or deployment is authorized or performed for this candidate.
