# Performance first batch — local review

Baseline: `1ff0a134a1389aa2a7fa0a2f91ef3d1a284a74fe`. Tier 2 / Testing Level 2: equivalent shell data loading, no persistence, RLS, schema or business-rule changes. Local candidate only; no push, deployment, migration application or hosted mutation.

## Workspace reconciliation

Remote `dev` and `main` verified directly at the requested SHA. Fetch updated `origin/dev` and `origin/main`. Original local `dev`/`main` remain at `bdd3d578bd52430f9f841cbe27957fda35ae2bac`: fast-forward correctly aborted because the intentionally untracked Messaging discovery note collides with a different tracked release version. Original note SHA-256 `a77706eaec0cb91df8a39d4d7ad987ecdd67272b5d1b0fa4919c04e27a010f77` was preserved. Work is isolated on `perf/loading-first-batch` in `/private/tmp/tenops-performance-workstream`, based exactly on canonical. No original files were moved, overwritten, stashed or cleaned.

## Measurement and useful limits

[Compact evidence](2026-09-25-performance-first-batch-evidence.json) separates hosted read-only cardinalities from synthetic browser measurements. Production-mode static exports, same machine, headless Chromium; no development Strict Mode doubling. Existing route harness uses 20ms synthetic API latency; focused shell fixture uses 30ms and 100 synthetic notifications. All browser business/auth/storage traffic is intercepted; no real private content or file bytes are inspected. Hosted inspection uses privileged HEAD counts and lean Job/labor GET projections only, so it is **not** evidence of end-user RLS performance. Browser mutations are mocks.

Hosted totals: 39 Jobs (all unarchived; 20 complete, 9 not started, 5 on deck, 3 in production, 1 shipped, 1 cancelled); 1,868 labor entries in 38 reporting groups; 170 Inventory items; 76 Pending Receivals; 91 Inventory transactions; 301 Catalog rows; 8 Bids; 5 Planning phases/16 items; 11 Job Updates; 158 attachment metadata rows; 25 material reports. Private task/message/notification contents were not read.

The exact lean Job-linked labor query returns 1,168 rows across three pages, about 151 KB JSON; observed sequential HTTP duration 2.72s. This is one privileged network sample, not database execution time. All those rows belong to currently loaded Jobs. Scoping that query to unarchived Jobs saves **zero rows today**, so it was rejected for this batch. One planning-items HEAD took 2.24s despite only 16 rows: row count alone does not establish a database bottleneck.

## Current loading map and A/B/C contract

A = needed for current useful screen; B = progressively enrich after it; C = explicit destination/record/tab. Classes below are proposed loading responsibilities; deviations describe current implementation, not silently changed semantics.

| Surface / source | Current requests → consumer and timing | A / B / C and findings |
|---|---|---|
| Auth/shell (`auth.tsx`, client shell) | session → `get_my_app_user`; welcome ensure and account preferences; route mounts when shell access allows | A session/profile/capabilities and requested module; B welcome/notification state. Initial session and auth callbacks can both reload profile/ensure; left intact. No global inventory/labor module provider found. |
| Navigation | Next Link route-code prefetch; GlobalMessaging and AccountNotifications mounted in shell | A lightweight nav/unread; B intent prefetch. Route JS prefetch is distinct from business-data preload. Do not preload business histories. |
| Notifications / WelcomeHero | `list_my_account_notification_history(p_limit:100)` → bell history/unread; hero formerly repeated this query to locate one welcome row | A existing unread signal; B bounded history. First batch removes hero's independent requests. Existing 100-row history cap retained; no claim of unlimited history. |
| Production (`ProductionWorkspace`, `jobs.ts`) | complete paged Jobs + active Rework → list; attachment IDs, update summary fields, lean labor/material reports in parallel; phases → items after Jobs | A current list; B summary badges/planning. Core list is published before supporting reads. All unarchived terminal Jobs still included. No initial per-Job N+1 found; global supporting scans remain. Status/history pagination needs an explicit completeness/filter contract. |
| Production Planning (`planning/data.ts`) | visible Job IDs → batched, paged phases → item projection; phase-library reads on use | A lean scheduling projection; B progress; C item notes/library/history. Current phase/item projections include descriptions/notes; only 16 hosted items, so no urgent rewrite. Items/library lack complete paging. |
| Intake (`BidWorkspace`, `queries.ts`) | paged `list_bids` + owners concurrently, then client status filter; Bid click loads activity; tabs load Updates/Files | A active Bid summary; B owners; C activity/files/update bodies and document relationships. All 8 Bids cheap now; full Bid DTO includes notes/contact detail. No lifecycle semantics changed. |
| Intake Planning | dynamically mounted destination loads bid planning; Jobs → scoped phases | A cross-Bid/Job timeline; B secondary details; C history. Reuses full Production Job loader; lean schedule DTO is a future candidate. |
| Reporting / Monthly Snapshot | Snapshot mounts instead of Pipeline; period sources + all-time labor links for lifecycle checks | A period aggregates; C unrelated periods. Two complete labor reads are intentional in current semantics; do not remove lifecycle input or claim duplicate Pipeline loading. |
| Manpower Reporting | six concurrent loader groups: full paged joined entries, Job/Rework options, groups, workers, tasks, categories; whole load settles before display | A current groups/entries and immediate references; B likely recent groups; C old periods. Collapsed groups still download history. 1,868 entries requires four 500-row pages. Search/totals currently use all entries; windowing must preserve them. |
| Manpower Analytics | aggregates the already-loaded Reporting entries, no separate Analytics read | A visible period totals; C other periods. No extra data query to eliminate. Current counts alone do not justify server aggregation; measure joined payload/CPU on target devices first. |
| Inventory | items + all pending/partially received/received receivals + Job choices at route mount | A current stock; B Pending count/recent operational state; C received history, catalog and per-item transactions. Pending panel collapsed but all 76 rows fetched. Catalog and activity are separate destinations, not global preloads. |
| Inventory Activity | `inventory_transactions` ordered by created time, `limit(500)` → history table | C explicit history. 91 rows today; no continuation and no id tie-breaker: future completeness risk. |
| Material Usage | report history → selected report detail; linked Job option on context selection | A requested report/list; C older details. Keep independent from labor facts. |
| My Work | tasks/groups/memberships RPCs concurrently; collaborators, Job options and attachment counts support UI | A current authorized tasks; B counts/options; C selected attachments/completed history. Task list/memberships/count reads have no general complete-pagination contract. Do not replace with privileged/global cache. |
| Messaging V1.1 | closed: unread HEAD + filtered user badge channel; hover/focus/sidebar: conversation summaries/recipients; open peer: 40 recent messages + upward history | A unread/current conversation; B metadata/visible lazy previews; C history/original bytes. No closed-route message-body preload found. Preserve bounded reconciliation and shared peer/typing subscriptions. |
| Shared Inspectors | Production open loads activity (20), file metadata, Rework/labor lifecycle and own task count; Bid open loads activity and overview relationships | A identity/editable summary, useful first section; B small counts; C Files/Updates/history and expensive secondary sections. Production currently starts several secondary reads regardless of active section. File **metadata** must not be described as original file-byte downloads. |

## First batch and measured result

AccountNotifications remains the single history owner. It projects `{userId,id,unread}` for the welcome notification through the existing shell to WelcomeHero. Hero no longer calls Supabase or listens independently for notification refresh. Notification component is keyed by account identity; hero rejects foreign/inactive account status. No retained response cache, TTL, new subscription or authorization policy. Existing focus, notification-change, Realtime, read mutation and arrival logic stays with its owner.

Focused fixture: cold history reads **9 → 3**, rows **900 → 300**, JSON **438,930 → 146,310 bytes** (67% less repeated history work). One change event **2 → 1** history read. Focus remains one read. Data requests issued before first useful screen fell **17 → 12**; single synthetic useful-render samples were **165ms → 250ms**, so no latency improvement is established. Three initial reads remain from existing auth/welcome refresh sequencing; this batch does not claim a one-request cold boot.

| Initial route fixture | Total data requests before → after | Business rows before = after |
|---|---:|---:|
| Root | 22 → 17 | 1,794 |
| Production | 21 → 17 | 1,794 |
| Intake | 11 → 7 | 101 |
| Snapshot | 27 → 21 | 3,468 |
| Manpower | 21 → 16 | 1,798 |
| Inventory | 12 → 8 | 1,120 |
| My Work | 18 → 12 | 321 |

These route fixtures use empty notification histories; the separate 100-notification fixture measures payload savings. Auth mock RPCs are excluded from route totals. Event timing changes counts between surfaces; use the deterministic change-event comparison as the steady-state budget. Rendered DOM counts and business rows were identical on all seven routes; no client errors or visible error alerts. CPU samples are noisy, not claimed speedups. No proven Production wall-clock improvement or changed Hero animation duration is claimed.

## Ranked next work, completeness, database and caching

1. **Implemented: duplicate shell history reader.** Every route, repeated payload eliminated, three application files, low regression risk with behavioral/account-switch checks.
2. **Next: remaining shell profile/welcome duplicate startup sequence.** High reach, bounded work, but measure auth callback ordering, token refresh and post-ensure freshness before coalescing. Avoid caching an earlier read over a subsequent mutation.
3. **Production Inspector secondary sections.** Defer full file metadata/lifecycle detail until relevant section when not needed for default controls. Medium reach/effort/risk; measure Inspector useful-detail time and preserve counts/editing.
4. **Manpower recent-first reporting + Analytics aggregate path.** Highest growing row volume, medium/high effort and semantic risk because all-time search/totals are shared. Proposed investigation trigger: >10k entries, >2 MB measured joined initial JSON, or repeated measured long tasks >50ms on supported office hardware. These are review triggers, not observed failures or timing promises. Future authorized aggregate query: period → week/month + Product + Job + Task totals, compatible totals and historical drilldown. No Analytics rewrite justified yet.
5. **Completeness before scale:** Inventory/Pending/Job Update and attachment summaries, Planning items/library, My Work RPC sets need deterministic pagination/count checks before hitting provider caps. Job/Bid/Manpower/phase loaders already have explicit paging; Messaging uses bounded cursor history. No new truncation introduced. Activity's 500 and notification's 100 limits need explicit older-history UX before changes.
6. **Reference reuse and list DTOs.** Job choices recur across modules; worker/task/category/vendor caches could be session scoped, in-flight coalesced, invalidated after management edits and cleared on identity changes. No heavyweight store or arbitrary TTL added. List DTO should contain only displayed identity/status/dates/counts; opening Inspector owns detail, then tab/section owns history. Preserve full records until a narrow projection is proven compatible.

No client-side per-row fetch loop was found on the measured initial Production/Intake lists. Joined Manpower rows repeat lookup labels, which is payload duplication rather than a network N+1. `select('*')` remains on selected-Job Rework history and Planning library paths; narrowing those is not a measured first-batch win at current sizes. Samples/reference editors also merit intent-based options loading later.

Repository migrations define notification user/history indexes and Manpower date/Job-date/worker-date indexes. Their existence in SQL is not hosted verification. Safe PostgREST EXPLAIN request returned 406/PGRST107 (plan media type unavailable). No settings changed, query plans obtained, index effectiveness claimed, migration/index artifact or hash created.

Realtime topology from source: two global channels (notification INSERT/user filter; messaging INSERT+UPDATE/user filter), plus active system Inbox channel or selected-peer private broadcast/typing channel as appropriate. Notifications refetch bounded history; messaging debounces badge refresh and reconciles bounded active history. No Production/Inventory global subscriptions found. Counts are source topology, not measured hosted delivery. This batch adds none; focused browser mocks do not prove hosted Realtime delivery.

Proposed budgets: zero independent Hero history requests; one bell history read per settled change/focus event; no extra channel for welcome; unchanged complete visible records; zero closed-Inbox body/original-attachment downloads. Measure cold/warm module and Inspector readiness on real authorized sessions before adopting millisecond targets. Warm SPA shell should retain the same owner; selected modules still follow existing mount refresh rules. Initial useful-render timing is included in fixture evidence, but synthetic single samples cannot establish user latency budgets. Speculative history prefetch remains prohibited; idle lightweight references are a later measured opportunity.

## Validation / review boundary

Passed: Production build, TypeScript, targeted ESLint and diff check; focused browser fixture (100 history rows, welcome onboarding, unread count, mark-all-read, refresh failure/recovery, one change/focus read, account switch while old response is pending); seven-route before/after profile without client errors. Account-switch fixture uses Supabase BroadcastChannel events and synthetic identities. Source review confirms query payload/ordering/RLS/mutations and Realtime callbacks are unchanged. Original workspace and untracked note preserved.

Legacy `verify-welcome-hero.mjs` is not a passing gate: its source-section delimiter references the removed loader and its existing 100-character cover regex also fails canonical source. It was not weakened to manufacture a pass; the new browser verifier exercises the changed behavior. No broad historical suite, hosted browser login, hosted Realtime delivery or migration verifier claimed.

Application boundary: `src/app/client-layout-shell.tsx`, `src/components/AccountNotifications.tsx`, `src/components/WelcomeHero.tsx`. Supporting files: `scripts/measure-performance-readonly.mjs`, `scripts/verify-shell-notification-loading.mts`, this report and evidence JSON. No dependency manifest/lockfile changes. Local dependencies installed from canonical lockfile with scripts disabled.

Reproduce: `npm run build`; `PERF_OUTPUT=/private/tmp/tenops-shell-after.json npx tsx scripts/verify-shell-notification-loading.mts`. The read-only measurement script requires existing environment credentials and emits no secrets. Review the local candidate before any release. Suggested manual checks: sign in, welcome → bell, mark read, navigate Production/Intake/Inventory, open Messaging, sign out/in. No Production release authorized.

Review server: `http://localhost:3107` serves this worktree’s Production export. The application uses its normal configured backend; automated checks used mocks and did not sign in to hosted business data.
