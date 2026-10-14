# TenOps database retrieval candidate for Product review

October 14, 2026. Base: `ba776a1814649e2ea64f7c1642428ed691f3bafd`. Branch: `perf/database-retrieval`. Candidate is the local commit containing this report; resolve with `git rev-parse HEAD`. Main and dev were fetched from the canonical GitHub remote and both resolved to the base. No push or deployment is authorized or performed.

Selected-period Manpower analytics now loads a complete server-filtered period before starting the complete editable history. Production labor and material enrichment is restricted to the Jobs actually loaded for the current view, including a focused archived Job. Lifetime labor calculations, Job ordering, Rework, historical editing and search are preserved. Job choices and material summaries no longer silently stop at the provider's 1,000-row cap.

## Implementation

Manpower's new period reader applies inclusive `work_date >= start` and `work_date <= end`, plus the selected Job predicate when present. It uses the existing complete reader with deterministic ordering and exact counts, bounded to 500 requested rows per page. The reader follows actual returned offsets, so a provider returning only 137 rows is supported. Duplicate IDs, failed pages, incomplete final pages and count drift fail the read instead of publishing partial totals.

Two concurrent boundary queries, each intentionally limited to one historical row on or before the report end, preserve the existing latest-work label and yearly available-history behavior. Those rows are deduplicated and passed through the unchanged integer-hundredths aggregator; out-of-period hours are excluded by its existing logic. The selected report becomes usable independently of editable groups. Full history then loads for the unchanged all-history editor/search/bulk operations, and the report reuses those authoritative in-memory entries for later periods and edits.

This is a readiness optimization, not a removal of history or a total-session byte reduction. With no early navigation away, it adds a period read and two boundary queries to the existing history read. The fixed fixture's labor transfer across both phases is 9,475,691 bytes versus 8,630,544 before, about 9.8% more. Editable-history readiness can be slightly later. Avoiding that remaining transfer requires a separately designed on-demand historical editor/search contract; this candidate does not silently restrict it.

Manpower Job choices and Rework choices are now complete paged reads. Production material summaries page `id,job_id,report_date` completely. Production labor and material scopes use deduplicated Job IDs in batches of at most 200; an empty scope performs no reads. Lifetime actual hours include older work and every Rework cycle, so no date cutoff is imposed on Production enrichment. Core Job visibility remains independent; enrichment starts after Job scope resolution and publishes without waiting for Planning. While incomplete or failed, labor/material badges show loading/unavailable states rather than zeros or “no reports.”

Request-generation guards discard obsolete refreshes. Scoped report effects discard responses after period/Job change or unmount. Manpower operational state remounts when account identity changes. There is no module-level or persistent response cache. The same Supabase client, authenticated credentials, capabilities, tables and RLS apply; no authorization rule is relaxed.

## Before and after evidence

The same synthetic 12,001-entry dataset contains 1,201 entries in the selected 30-day period, 40 Jobs (20 nonarchived), and 1,201 material reports. Measurements execute the actual baseline and candidate loaders with a fixed 20 ms fetch delay, exact selected-column projection and provider caps. They exclude dictionaries, authentication, React rendering, actual SQL and real network transfer. Elapsed values are single local samples, not percentiles or production speed claims.

| Affected retrieval | Before requests / rows / JSON bytes / elapsed | After requests / rows / JSON bytes / elapsed |
|---|---|---|
| Required Manpower facts before selected report | 25 / 12,001 / 8,630,544 / 813 ms | 5 / 1,203 / 845,147 / 100 ms |
| Production labor and material enrichment | 26 / 13,001 / 1,577,151 / 652 ms | 6 / 2,402 / 295,452 / 97 ms |

The 1,203 transferred report rows include the two one-row boundary responses; a boundary overlapping the period is deduplicated before aggregation. Production's baseline includes only 1,000 material rows because it reproduces the old truncation; the candidate returns all 1,201 material rows plus 1,201 labor rows for relevant Jobs. Thus its reduced transfer does not rely on preserving that defect.

Retained raw measurements: [before](evidence/2026-10-14-retrieval-before.json), [after](evidence/2026-10-14-retrieval-after.json).

## Hosted observations and query plans

Four sequential privileged HEAD requests found 2,011 labor rows overall, 200 in September 15–October 14, 812 in July 17–October 14, and 40 nonarchived Jobs. Counts show the current 30-day fact scope contains about 90% fewer rows than all history, before the two boundary rows. No hosted operational row content was retrieved.

Single HEAD samples were 1,045 ms for all labor, 280 ms for the 30-day scope, 207 ms for 90 days and 192 ms for nonarchived Jobs. Connection warmup and different queries make these unsuitable as a before/after speed comparison. Service-role HEAD requests bypass user RLS; they establish neither authenticated API latency nor SQL execution time.

A read-only, non-ANALYZE selected-period EXPLAIN request returned **406 / PGRST107**. Database execution time, index effectiveness and RLS overhead remain unmeasured. No hosted configuration was enabled. Existing migration definitions include work-date and Job/date indexes; no new index or policy change is justified without authorized-role plans and actual hosted index inventory. Follow-up should inspect period ordering/count plans, Job-scoped enrichment, Messaging peer predicates and conversation-summary window work on a sanitized local/staging database. No index, RLS, RPC or schema change is proposed for this candidate.

[Hosted count and plan evidence](evidence/2026-10-14-retrieval-hosted-readonly.json).

## Messaging and startup

Messaging source and Realtime semantics are unchanged. Existing message pages are keyset-paged to 40 rows with participant predicates. Conversation summaries rank all visible ready messages by peer and count unread history; that query remains a growth bottleneck requiring plans before SQL changes.

The representative local empty-Inbox open made two conversation-summary RPCs and two recipient RPCs across the shell/menu and dialog paths. No thread body page was fetched because no conversation was selected. This confirms a bounded duplication opportunity, but does not measure a populated conversation's SQL, switching latency, RLS or delivery behavior. Coalescing summary ownership would be a separate account-invalidation increment and is deferred.

Six local full-page initializations made six access-profile RPCs, consistent with one bootstrap profile read per navigation. Fixture accounts are read-only, so welcome creation is not exercised. Writable startup still awaits the existing welcome-notification operation after profile retrieval. Auth lock handling, capability checks and welcome behavior are unchanged. No hosted login was used, since it could create a notification.

## Focused validation

Tier 3 / focused Testing Level 3 evidence, limited to retrieval and reporting contracts. No broad unrelated suite was run.

- TypeScript, targeted ESLint, `git diff --check`, and a production webpack export passed. The exported candidate used only local fixture credentials and Production branding. Default Turbopack was not used with dependencies linked outside the worktree.
- `scripts/verify-database-retrieval.mts` passed 1,201 period facts, Job choices, Rework choices and material rows through a 137-row provider cap; 205 Job scopes; deduplicated scopes; empty scopes; and complete core Job ordering.
- Full-history and scoped analytics compare deeply equal for 30 days, 90 days and a trailing year, across all Jobs, a selected Job and an empty Job. Additional cases include inclusive endpoints, future rows excluded, unlinked work, inactive category labels and Rework. Existing aggregation code is unchanged.
- Lifetime labor hours and entry counts match fixture reference totals for every visible Job. Old history remains in Production totals. Unauthorized fixture reads, count drift, duplicate IDs and missing pages reject rather than yielding complete-looking results. Switching the authorized fixture dataset to empty returns empty results rather than retaining prior rows.
- The actual exported app in the in-app browser showed 4,503.75 h for the selected period at 378 ms, while a deliberately delayed history reader was still loading. A second navigation showed the same total at 300 ms, with complete history ready at about 16.2 seconds under the artificial 15-second delay. These are single fixture observations, not a hosted speed comparison.
- Browser period controls showed 6,753.75 h for 90 days and a year; the existing Job link showed 228.75 h for Job 0. Review B showed 0 h with no Review A labor. This is a local account-navigation check, not an adversarial in-place token-switch or hosted RLS test.
- Production showed all 20 current fixture Jobs, correct 228.8 h rounded labor for Job 0, linked materials, and working Overview/Table rendering. A denied material query left core Jobs visible, displayed the incomplete-summary alert and “Labor unavailable,” and did not display “No Labor Reports.” Messaging opened and closed normally with the empty fixture.

[Browser observations and requests](evidence/2026-10-14-retrieval-browser-validation.json), [validation receipt](evidence/2026-10-14-retrieval-validation.json).

The local adapter blocks hosted connections with a local-only build and CSP, rejects writes and Edge calls, uses synthetic read-only accounts, and denies Realtime upgrades. Its welcome-played flag is fixture setup only; welcome source and animations are untouched. It is sufficient for affected read workflows, not for write lifecycles, hosted authorization or live Realtime validation.

## Local review and release risks

Review: **http://localhost:3315/manpower-reporting?reviewHistoryDelay=15000**. Production: **http://localhost:3315/**. The actual app is running with a disposable read-only data source.

Port 3000 is occupied by the completed DYMO review at `/private/tmp/tenops-dymo-print-qol`. The sandbox denied stopping that process, so 3315 is an explicit exception. The candidate was built with `http://localhost:3315` as its API URL and verified at that exact origin. To restart after rebuilding for that port: `RETRIEVAL_REVIEW_PORT=3315 node scripts/start-database-retrieval-review.mjs`. Do not deploy this local-only export; any approved release needs a fresh build with the actual hosted configuration.

Remaining risks: full editable history still transfers; complete choice pagination can increase reads above old silent caps; exact counts and sequential offset pages still scale with history; no transactional snapshot or detection of all same-count edits is promised; period and boundary reads may observe concurrent edits at different instants. Existing calculations and permission contracts are preserved, but authenticated hosted latency, database plans and in-place account-switch races are not proven by this local fixture. A later release needs the approved hosted acceptance checks and a fresh Production build/branding verification.

Released Sample Generator and DYMO code are inherited unchanged. No Sample Matcher or TenDev hosting configuration was touched. No hosted writes, migrations, Edge deployments, push, deployment, or release occurred. **Stopped for Product review.**

## Exact candidate file boundary

```text
src/modules/manpower/ManpowerAnalytics.tsx
src/modules/manpower/ManpowerWorkspace.tsx
src/modules/manpower/manpower.ts
src/modules/production/ProductionWorkspace.tsx
src/modules/production/components/ProductionQueue.tsx
src/modules/production/components/ProductionTable.tsx
src/modules/production/jobs.ts
scripts/retrieval-review-fixture.mjs
scripts/start-database-retrieval-review.mjs
scripts/verify-database-retrieval.mts
docs/project-memory/2026-10-14-database-retrieval-candidate.md
docs/project-memory/evidence/2026-10-14-retrieval-before.json
docs/project-memory/evidence/2026-10-14-retrieval-after.json
docs/project-memory/evidence/2026-10-14-retrieval-browser-validation.json
docs/project-memory/evidence/2026-10-14-retrieval-hosted-readonly.json
docs/project-memory/evidence/2026-10-14-retrieval-validation.json
```
