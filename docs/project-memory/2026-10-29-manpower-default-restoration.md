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

## Executed approved priority release — October 29, 2026

Chris’s **MANPOWER — APPROVED PRIORITY RELEASE** explicitly accepts `f5b1ce8736932859d193fe0ac8f601afb1d15bb9` and authorizes standard dev → main, TenDev before TenOps. This executed release supersedes the earlier local-only/pending-acceptance status above. Separate Advisory context remains unavailable; current explicit Chris approval governs.

Selective runtime **`ae50e0fc55a7a6d9e454016c5d73a58e792aff79`** is parented to canonical **`8da34ba008098ba68f6464adc7390dc60c90b44b`**. The exact accepted 13-path delta was selected: all seven non-documentation files, including the three application files, match the accepted candidate byte-for-byte. Only the task’s Current State/Execution Standard additions were appended to canonical versions; unrelated local documentation and TenBot PoC history were excluded. Local dev remains at accepted `f5b1ce8`, with its unrelated history and dirty/untracked work preserved; local main and remote main/dev are at the release runtime. This is selective promotion, not a wholesale dev merge.

| Target | Served SHA | Deployment | Branding |
|---|---|---|---|
| TenDev | `ae50e0fc55a7a6d9e454016c5d73a58e792aff79` | `7ef121ad-e19e-4caf-816d-11d2c590a734` | TenDev / RESEARCH & DEVELOPMENT |
| TenOps | `ae50e0fc55a7a6d9e454016c5d73a58e792aff79` | `6cda75a5-dc37-480c-8027-bd7806176c34` | TenOps / OPERATIONS CONTROL |

Tier 2 / Testing Level 2 release gates reused the accepted local 11 checks, desktop/mobile/read-only/batch-entry, type/lint/export and review-source evidence. One standard isolated Production export per target passed, using the existing target-specific Pages public configuration; `.env.local`, active review URLs and local request guards/fixture code were excluded. TenOps explicitly set `NEXT_PUBLIC_DEV_BRANDING=false`; unchanged TenDev/Production Planning rollout flags and Supabase target were preserved. Exact source/archive manifests agree between both exports, and tracked source was immutable through each build.

TenDev was pushed, manually deployed and verified before main/TenOps promotion. Four automatic Git-triggered builds were confirmed skipped. Each actual public environment passed **32 exact served route/manifest/service-worker/asset checks** and the brief **four-group desktop smoke**, with **46 browser-loaded JS/CSS hashes** verified. Smoke covered unsigned startup, historical reporting-date default and collapsed 157-member complete recent group, automatic 1501-member later group correctly preceding the older recently edited report, coverage notice, both alternate sort options, restored default and contained viewport. These use actual served frontend bytes with existing intercepted synthetic Auth/data; **zero hosted backend requests forwarded or business/Auth writes**. No full-history wait, full suite, browser matrix, new framework, broad security/database audit or live authenticated business-data claim. Prior accepted editing/permissions/mobile evidence was reused. No Production latency measurement or physical-device claim.

Final remote main/dev, local main and both canonical served revisions are aligned; Pages deployment configuration remained exactly unchanged. There are no remaining blockers in these scoped gates. No migrations, schema/RLS, Edge deployment, hosted business-data mutation, unrelated application change or new credential/scope occurred. Existing Wrangler OAuth refresh was reused. No additional optimization work started.

Rollback refs: `rollback/manpower-default-20261029-canonical` at previous canonical `8da34ba`, plus preserved `...-local-dev` (`f5b1ce8`) and `...-local-main` (previous stale local main). Verified `/private/tmp/tenops-manpower-default-release-20261029/release.bundle` remains available. Previous runtime `5e28d254b8d674ec64ce2ba347c83108366af936`: TenDev `faa8af5a-4e96-43a2-9641-ba6bbefb40f8`, TenOps `395bba78-2861-4e74-a0aa-8b8cdef3c301`. Historical refs/worktrees and original task review port 3000 remain preserved. Scratch release helpers, exports, manifests and private logs are task-owned under that `/private/tmp` folder. Final repository receipts remain local/uncommitted to avoid creating another canonical/runtime boundary.

[Secret-free final release receipt](evidence/2026-10-29-manpower-default-release.json).
