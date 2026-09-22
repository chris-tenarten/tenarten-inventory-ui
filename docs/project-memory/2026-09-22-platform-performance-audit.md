# Platform performance audit — localhost review, 2026-09-22

Status: uncommitted on normal `dev`, based on `5bdbb6e5f831f26565f124ed1ab9e4d88dc9d28a`. No release, hosted write, schema/RLS/RPC change, branch, worktree, or visible browser control. The 13 previously accepted Unified Catalog paths remain byte-for-byte unchanged; their SHA-256 manifest is included in [measurement evidence](2026-09-22-platform-performance-evidence.json).

## Measurement method and limits

Measured the accepted local Production-mode export **before** application edits, copied it to `/private/tmp/tenops-performance/baseline-out`, then measured the optimized export. Same machine, headless Chromium, isolated cold contexts, 1440×1000 viewport, mocked auth/business HTTP and WebSocket traffic, 20ms synthetic API delay. No real account contents or hosted business data used. Fixtures: 120 Jobs, 100 active Bids, 1,674 labor rows, 1,000 Inventory groups, 200 My Work tasks, 218 Specialty Catalog matches. Fixture labor is **5,022 hours**, not a verification of hosted historical counts/hours. Unspecified tables are empty; document and message libraries are empty startup fixtures, not realistic maximum-size corpora.

The profiler records requested JS bytes, gzip size, CDP script/task/layout CPU and heap, DOM size, request timing/volume and returned rows. Auth profile/welcome RPCs are excluded from the data-request totals but captured separately in the temporary raw traces. Next Link prefetch causes route JS to load in the background; distinguish observed JS from scripts referenced by initial HTML. Wait windows are observation windows, not time-to-interactive benchmarks. Single-run CPU readings are noisy and are **not** claimed as Production speedups. No hosted SQL execution plan, network latency, Edge generation latency or actual Realtime delivery was measured. WebSocket interception did not produce usable channel observations; subscription findings below are source-inspection evidence only.

Reproduce after `npm run build`:

```sh
PERF_OUTPUT=/private/tmp/tenops-performance/profile.json npx tsx scripts/audit-platform-performance.mts
PERF_ASSERT=1 PERF_OUTPUT=/private/tmp/tenops-performance/acceptance.json npx tsx scripts/audit-platform-performance.mts
```

Create the output directory first if needed. `PERF_ROOT` selects another static export; `PERF_ONLY` selects comma-separated surface names. The script never connects to hosted business APIs. API mocks are tailored fixtures, not a general PostgREST implementation.

## Ranked findings and implemented corrections

Priorities combine reach/frequency, measured work and implementation risk; no invented numeric scoring.

| Priority | Finding and reach | Measured before → after | Correction / risk |
|---|---|---|---|
| 1 | PDF parser eagerly included in high-frequency root/Production loading and route prefetch | Root initial HTML JS 1,885,306 → 1,401,764 raw bytes; gzip 532,058 → 386,882 | Load `pdf-text` only when extracting a PDF. Same parser, sequence, error/manual fallback; Level 2 deferred-loading change, no PDF contract change. |
| 2 | Monthly Snapshot starts the invisible pipeline's queries | Labor pages 12 → 8; Jobs reads 2 → 1; total returned rows 5,262 → 3,468 | Gate pipeline loading by visible dashboard mode. Removes 11 business requests, including a complete duplicate labor pass; Level 2. |
| 3 | Inventory mounts both responsive lists | DOM 31,319 → 14,317 with all 1,000 groups retained | Render only the current viewport list; responsive external-store hook and resize-safe select-all indeterminate state. Level 1 rendering. |
| 4 | Inbox body loader depends on unstable parent callback | Body-list RPC 4 → 1 per open in fixture | Stable unread callback reads the existing current visibility ref. No new cache or auth change; Level 2. |
| 5 | Malformed inline appearance bootstrap on every measured route | One uncaught syntax error per route → zero | Move two existing storage-key constants to a server-safe module. Same keys/defaults/branding; Level 1 first-paint correction. |

Observed route-plus-prefetch JS: **2,576,091 → 2,092,850 raw bytes**, gzip **702,316 → 556,788**. These are unique local file byte counts, not actual CDN wire transfer. Messaging additionally loads its existing 26,083-byte dialog chunk. Purchasing/Samples/Intake initial HTML scripts are essentially unchanged (about +378 raw bytes each from shared fixes); their later root-route prefetch no longer pulls the parser. PDF import still loads its parser/worker when requested and successfully extracts the fixture Job number. Its substantial deferred cost has moved to the action that needs it, not disappeared.

Snapshot retains both required complete labor reads: period labor for analytics and all-time Job links for lifecycle/archive checks. It now announces critical-page readiness itself. Returning to Pipeline reloads its data normally. Aggregation, period rules, Product analytics, Rework and archive semantics are untouched.

## Coverage across the platform

Data totals below include lightweight shell reads. Notification history counts vary with boot/focus timing, so compare the specific business-query changes above rather than claiming exact total-request savings. DOM counts are the settled initial fixture view (Catalog/Inbox after opening).

| Surface | Requests before → after | Returned rows before → after | DOM nodes before → after | Findings / disposition |
|---|---:|---:|---:|---|
| Root/startup | 20 → 20 | 1,794 → 1,794 | 10,659 → 10,659 | Parser deferral and appearance bootstrap fixed. Remaining shared notification work below. |
| Intake | 11 → 14 | 101 → 101 | 1,486 → 1,486 | List/owner reads parallel. Activity loaded on opening a Bid; Files/Updates already deferred to tabs. No Inspector redesign. |
| Production | 22 → 21 | 1,794 → 1,794 | 10,675 → 10,675 | Core Jobs published before supporting reads complete. Summaries parallel; no measured initial per-Job N+1. Responsive duplicate markup remains a possible later rendering target. |
| Monthly Snapshot | 36 → 27 | 5,262 → 3,468 | 621 → 620 | Eleven business requests removed; two extra shell reads in after sample obscure that reduction in the raw total. |
| Manpower | 19 → 21 | 1,798 → 1,798 | 434 → 434 | Complete four-page labor loading preserved. Collapsed groups keep initial DOM small. Existing memoized grouping/analytics retained. |
| Inventory | 12 → 12 | 1,120 → 1,120 | 31,319 → 14,317 | Removed invisible duplicate list. Reads/persistence/filtering unchanged. |
| My Work | 17 → 15 | 321 → 321 | 5,342 → 5,342 | Overview queries parallel; options and attachment counts secondary. No Task Groups work. Larger lists remain a possible future windowing target. |
| Purchasing | 13 → 12 | 0 → 0 | 287 → 287 | List selects summaries + line IDs; editor detail only on opening. No preview/cache/issuance changes. Empty-library limitation. |
| Samples | 15 → 15 | 220 → 220 | 276 → 276 | List readiness independent of reference options, but Bid/Job/vendor options still loaded at workspace startup. Accepted file intentionally preserved. |
| Proposals | 15 → 14 | 0 → 0 | 297 → 297 | Access-gate sequencing retained. No business library latency claim. |
| Transmittals | 12 → 12 | 120 → 120 | 401 → 401 | Job choices first; selected-Job detail/generator later. No generation before selection. |
| Messaging opened | 21 → 18 | 122 → 122 | 320 → 320 | Body RPC 4 → 1. Full conversation history can still be large; no pagination contract changed. |
| Catalog: Klein | 16 → 18 | 438 → 438 | 934 → 934 | 218 blank suggestions + 218 typed matches plus 2 option rows; 50 results mounted, all 218 reachable. No regression to a silent result cap. |

CPU and per-query breakdowns are in the linked JSON. No optimization was justified merely by a small/noisy CPU difference. Manpower and Snapshot calculations remain unchanged; grouping/derived state already has memoization. No indiscriminate memoization added.

## Messaging / Realtime

Closed Messaging already uses a lightweight unread HEAD query and a user-filtered global badge subscription. Recent previews load on hover/focus/sidebar use, capped intentionally at 40 recent messages. Inbox code is already dynamically imported; full bodies load when open. Attachments load only for the selected conversation; signed preview URLs are requested on use. Detailed message subscriptions are guarded by `open` and removed in effect cleanup. Typing uses the selected peer and a private channel, with cleanup. These are inspection findings, not hosted Realtime tests.

The actual defect was callback identity: each parent render changed `onUnreadChange`, which changed Inbox `load`, retriggering its opening effect and detailed subscription effect. Stabilizing the callback removes that amplification while retaining refresh-on-open and unread-driven visible-preview refresh. Focused fixture checks prove no body list while closed, one body read on open, none merely from closing, and a fresh read on reopening. No send/read-mark/attachment/authorization semantics changed.

Deferred: per-conversation grouping copies arrays repeatedly and could become quadratic for very large histories. No large private-history fixture was measured; do not claim it as a demonstrated dominant cost. No private-data cache added.

## PDF / generator findings

Only parser module loading changed. Embedded-text parsing, document-family detection, error fallback and canonical Job creation semantics did not. The headless test imports a generated PDF into review and checks `26-9999`; it does not create/save a Job.

PO/Sample session caches remain unchanged. Cache hits avoid duplicate persistence/Edge work; meaningful rendered-input changes invalidate; issuance uses its authoritative separate path. Focused cache verifier passed. `DocumentViewer` uses native iframe/object rendering, fetches blobs when mounted and revokes object URLs; it is not the source of eager PDF.js loading. No Edge calls, real draft saves, issuance, logo/font regeneration measurements or PDF output-contract changes were made. Those require a separate evidence basis if optimized later.

## Remaining query / data opportunities and approval boundaries

- **Notification history duplication:** 7–10 reads observed during cold boot/opening flows. Both WelcomeHero and AccountNotifications load the same history. Auth session/profile callbacks also ensure welcome state and dispatch refresh events. Likely useful request coalescing opportunity, but must preserve account identity isolation, focus freshness, welcome sequencing and auth lifecycle. Deferred rather than changing security-adjacent startup behavior in this pass.
- **Inventory and other unpaginated reads:** Inventory and pending receivals currently have no explicit `.range()` completion loop. Snapshot's non-labor event/report/link reads and several Job/reference/attachment-count reads also lack complete pagination. Hosted cap/cardinality was not verified here. Potential existing correctness risk above server limits, not a newly introduced cap. Explicit pagination/count contracts deserve focused completeness work; do not remove data to improve timings.
- **Snapshot server aggregation:** after this change, two complete labor reads remain legitimately required. A future narrow, permission-correct server summary/existence RPC could avoid transferring all historical Job links. Fixture evidence: 1,674 link rows, four requests, on every Snapshot load. Requires independently approved RPC/compatibility work; none created.
- **Attachment summary reads:** Production counts attachments; My Work loads attachment ID/count information rather than bodies. At larger real cardinalities, scoped/count RPCs may help. No actual hosted cardinalities/plans measured, so no index recommendation asserted as proven.
- **Indexes:** no SQL plans or hosted latency evidence to justify a specific index. Inspect actual plans for period-filtered labor/events and user-filtered Inbox queries before proposing one; check existing indexes first. No index/migration drafted.
- **Samples:** reference options can potentially wait until editor opening, and large listing payloads containing formulation/version details merit later profiling. Preserve accepted Catalog files now. A new slim list RPC is a separate data-contract decision.
- **Lists:** Production's responsive duplicate markup and My Work's full list are next client-only candidates if realistic larger datasets show material cost. Inventory still renders all current rows; virtualization/pagination is not silently introduced.
- **More route splitting:** defer inspectors/generators only with action-level measurements and preserved loading/error behavior. The measured PDF parser saving was sufficient to justify this pass; no wholesale route rewrite or prefetch disabling.

Separate non-performance finding: existing unpaginated reads may become completeness defects. No hosted Catalog data reclassification or other unrelated Product correction performed.

## Validation and review

**Overall Level 2**, because this changes equivalent loading and callback-triggered fetching; rendering/bootstrap changes are Level 1. No Level 3 contracts entered.

Passed:

- Production build and TypeScript, targeted ESLint, `git diff --check`.
- Concise 13-surface headless platform profile: all after-build surfaces load without uncaught client errors or error alerts.
- Focused headless assertions: Snapshot retains 5,022 synthetic hours and both required complete reads; Pipeline loads when selected; Manpower loads all 1,674 synthetic rows; Inventory retains all 1,000 desktop/narrow records with one responsive tree, no narrow horizontal overflow and no refetch on resize; closed/open/reopened Inbox body counts; Catalog 218 matches across five pages, 50 mounted then 18 on final page; lazy PDF parser successfully extracts text.
- `scripts/verify-production-initial-load.ts`: core/supporting critical path preserved.
- `scripts/verify-production-job-import-parsers.mjs`: existing real-structure parser cases pass.
- `scripts/verify-pdf-preview-performance.mts`: session cache/invalidation behavior passes.
- SHA-256 comparison: all 13 accepted Catalog files unchanged.

Validation caveats: the old `verify-pre-release-performance.mjs` fails its literal one-line Sample loading regex. The same regex fails against committed HEAD (existing formatting mismatch); it was not rewritten to manufacture a pass. New browser harness initially selected a hidden responsive Job duplicate and counted native select options outside the Catalog listbox; selectors were corrected and affected checks passed. No application defect or source rollback resulted from those harness failures. No broad historical, database, authorization or issuance suite rerun.

Chris's localhost spot-check: initial light/dark appearance and TenDev branding; Pipeline → Snapshot → Pipeline; Inventory filters/row details and selection while resizing; open/close/reopen Messaging and recent/sidebar unread refresh; import a PDF into review without saving; accepted Sample/PO Catalog interaction. User-facing acceptance remains Chris's responsibility; no visible browser was controlled.

## Changed-file boundary

Application changes in this pass only:

- `src/modules/production/providers/composite-extraction-provider.ts`
- `src/modules/production/ProductionWorkspace.tsx`
- `src/modules/production/components/MonthlySnapshot.tsx`
- `src/app/inventory/page.tsx`
- `src/lib/use-media-query.ts` (new)
- `src/components/GlobalMessaging.tsx`
- `src/app/layout.tsx`
- `src/lib/appearance.tsx`
- `src/lib/appearance-storage.ts` (new)

Evidence/instrumentation:

- `scripts/audit-platform-performance.mts` (new)
- this report and `2026-09-22-platform-performance-evidence.json` (new)

The existing 13-path Catalog boundary remains separate and untouched. Final workspace is intentionally dirty on normal `dev`, with no staged changes, commit, push or deployment. Temporary baseline/export/raw traces are under `/private/tmp/tenops-performance`; durable compact measurements are committed to neither branch yet, but included in this uncommitted review boundary.
