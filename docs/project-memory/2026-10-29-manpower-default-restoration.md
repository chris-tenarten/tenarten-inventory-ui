# Manpower familiar default and optional sorting — October 29, 2026

Status: **implemented locally on dev; pending Product acceptance.** Chris’s current “HIGH PRIORITY MANPOWER DEFAULT VIEW RESTORATION” and “RESTORE FAMILIAR DEFAULT + OPTIONAL SORTING” authorize this bounded correction, proportional validation and a local commit only. The separate Advisory thread is unavailable; no additional Product semantics are inferred from it. Base dev: `0bb928e1aa857a44d8269607665dbf412bfc9932`. No push or deployment.

## Historical findings and cause

Git source at `1d34f18^` (before October 14, and therefore before October 19–20), immediately before October 19 deferral (`c43f0c7^`), and before progressive history (`af04478^`) establishes the same presentation:

- Persistent `reporting_group_id` is the grouping identity, independent of Production Job. Empty named groups are retained; ungrouped entries form a final bucket.
- Leading valid M/D/YY or M/D/YYYY calendar dates in reporting-group names sort descending. Dated groups precede undated groups. Ties/undated groups use group creation descending, then name and ID ascending. Invalid calendar dates use the undated fallback.
- Rows originally loaded by `work_date` descending, `created_at` descending, then ID ascending. Explicitly created rows are inserted into their group immediately, retaining the existing entry workflow.
- Groups start collapsed. Search/product filtering reveals matching rows. New groups open for entry, and consecutive entries retain work date/group/work identity. These controls already existed and are preserved.
- **Neither Job `updated_at` nor report/entry `updated_at` controlled default order.** The recollection of “most recently modified Job” is not supported by the historical implementation. Earliest workspace `2a7a213` already included the reporting-date parser.

October 19 `c43f0c7` deferred historical retrieval; October 20 `01e5e83` exposed selected-period rows before full history. Both retained the metadata display comparator. October 20 `af04478` replaced the display comparator with `history.order`, the priority/completion order of retrieval batches. Groups containing recent work were retrieved first and remained first even when another loaded group had a newer reporting date. The group read correctly uses an immutable ID cursor, but publication also exposed that cursor order as row order. Thus both presentation effects arose from reusing retrieval order for display, rather than a historical “recently updated” sort being removed. The earlier append-stable-order claim in [the progressive-history candidate](2026-10-20-manpower-progressive-groups.md) remains historical evidence; this explicit restoration request supersedes that presentation choice only.

## Scoped implementation

Restored metadata ordering over every loaded complete group, independent of batch arrival order. Extracted the existing comparator for reuse by retrieval and presentation. Restored row ordering once after each complete batch arrives; pagination, count reconciliation, eight-group batching, recent priority, visibility pause, cancellation and all persistence operations remain unchanged. Existing row/group identities and collapsed/expanded state survive publication.

Added a small read-only-capable Sort groups select: **Reporting date, newest first** (default); **Work date, newest first** (latest member work date); **Job name, A–Z** (alphabetically first Job/work label in mixed groups, empty groups last). Deterministic ties use historical metadata order. Sort is session-local and resets to the familiar default on a fresh visit. No “Recently updated” option is labeled historical because it was not historical. Text search filters after group sorting, and no sort selection fetches extra data. The existing incomplete-history coverage notice is retained, with explicit notice that sorting covers loaded complete groups and order may change as older groups arrive. These are loaded-scope results, not a claim of globally sorted unavailable history.

A directly adjacent batch-entry layout defect was reproduced: the fieldset’s intrinsic minimum width grew the 1440px document to 1502px when a new entry row opened. Setting only `min-w-0` on the existing reporting fieldset kept the document at 1440px and retained the entry table’s own horizontal scroll container. Desktop/mobile browser checks cover this. No reporting redesign, grouping changes, calculations, schema, auth/RLS, permission policy or hosted mutation.

## Validation and evidence

Tier 2 / Testing Level 2. Reused existing verifier and safe-fixture infrastructure, with an optional default-view fixture and focused cases; no new harness or broad suite.

- [11 focused retrieval/presentation checks](evidence/2026-10-29-manpower-default-retrieval.json): existing eight complete-group/capped-pagination/integrity checks plus historical/default and both optional sorts. Older report update timestamps and Job edits do not override reporting dates.
- [Three focused browser workflow groups](evidence/2026-10-29-manpower-default-browser.json): desktop 1440×1000; mobile 390×844; read-only permissions. Confirm default collapse/order, newest-first member dates including archived members, late-arriving newer group insertion, preserved unsaved draft and expansion, complete 157/1501-member groups/totals, all 12,888 rows, undated creation fallback/ungrouped last, historical archived edit, all sorts without extra reads, local batch creation/entry with retained date, contained viewport and disabled writes for read-only users. Zero page errors/unexpected external requests.
- TypeScript, targeted ESLint, diff check and optimized Production-mode local export pass. The export uses only `http://localhost:3000` synthetic Supabase configuration; no hosted writes.
- Desktop/mobile screenshots were inspected: `output/manpower-default-desktop.png` and `output/manpower-default-mobile.png`. These are synthetic Chromium review views, not physical-device certification.
- [Exact localhost review-source smoke](evidence/2026-10-29-manpower-default-review-origin.json) records library loading, disposable local creation and PDF generation. Chromium’s browser response-body capture reported empty bytes for the successful PDF POST despite the viewer opening; restricting the waiter to POST did not resolve capture. An independent same-payload local HTTP request returned status 200, 861,258 bytes and `%PDF-1.7`, verifying generation without changing application code. This capture limitation is retained explicitly.

The first desktop browser pass exposed the fieldset overflow after all sorting/history/batch assertions; the narrow layout correction was built and the affected desktop/mobile/read-only groups passed afterward. An earlier export was superseded when investigation additionally established historical row ordering, and a final export included the verified fieldset fix. No repeated unrelated validation was run.

## Review and workspace closure

Review: **http://localhost:3000/manpower-reporting?review=populated**. Existing adapter `scripts/start-manpower-progressive-review.mts`, task-owned port 3000 (unused at task start), `MANPOWER_DEFAULT_VIEW_REVIEW=true`. This URL restores the synthetic owner session and resets representative populated fixtures with visible retrieval delay. It requires no manual test setup. No hosted forwarding mode is enabled.

The fixture deliberately separates an older reporting date with recent labor/Job edits from a newer reporting-date group without recent work, plus undated/invalid-date groups. Performance is not inferred from hosted data. Review may move cards into their correct date position as batches arrive; the UI explains this, rather than freezing the wrong priority order. Current reporting period analytics remain independent.

Task-owned artifacts: three dated evidence JSON files above; screenshot files under output; `/tmp/manpower-default-{build,tsc}.log`; the existing adapter process on port 3000; the optional fixture/verifier cases. Unrelated dirty Current State/Web Push/Contacts records and untracked worktrees/evidence are preserved and excluded from this commit. Original progressive evidence is not overwritten. Stop for Chris/Marcos Product acceptance. No commit/push to main, deployment, migration, hosted data/configuration change or cleanup of unrelated work is authorized or performed.
