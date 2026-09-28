# Performance completion — comprehensive local candidate

Completion verified September 28, 2026. Continues accepted `54aefe10249ebd7b2e594cf8daf0d04f28b6e0e3`, preserving all accepted work. Final canonical base: **`c3df23d1220b997e2c118a41bb103463ee92231c`**, including the concurrent Messaging composer-completion hotfix. Candidate branch `perf/loading-first-batch`, worktree `/private/tmp/tenops-performance-workstream`. Resolve the final candidate SHA from the commit containing this report. Local review: http://localhost:3107.

Tier 2 / Testing Level 2. No Product lifecycle, mutation contract, authorization, schema, calculation or release changes. No hosted mutation, push, deployment, migration or index artifact. The normal checkout remained clean at `1ff0a134...`; fetching advanced its shared remote-tracking refs only. Its local branches/files were not changed by this pass.

## Result and measured work

All selected high-confidence current-generation opportunities from the loading map are implemented. This report supplements, rather than repeats, the [initial map](2026-09-25-performance-first-batch.md), [accepted cumulative report](2026-09-25-performance-comprehensive.md), and their retained evidence. [Completion evidence](2026-09-28-performance-completion-evidence.json) contains compact request/row/byte comparisons and exact cumulative file boundary.

Measurements use production exports and synthetic authorized browser sessions, not development Strict Mode. They measure work, not hosted latency. No wall-clock speedup claimed. Historical reports describe their original workspace state; later housekeeping removed the redundant normal-checkout note and fast-forwarded normal branches before this completion pass.

| Module | Cumulative implemented result | Before → after evidence |
|---|---|---|
| Shell / Notifications | One notification-history owner supplies account-tagged WelcomeHero status; one auth bootstrap owns recovered session. Later auth events, unread changes, focus and account switching remain authoritative. | Original 100-notification fixture: **9 → 2 reads**, **900 → 200 rows**, **438,930 → 97,540 bytes**; change event **2 → 1 read**. Retained evidence, not rerun. |
| Production | Queue no longer fetches Planning items. Timeline fetches lean progress. Files metadata is deferred to Files/Updates; Details-only lifecycle reads remain scoped. Attachment count badge survives deferral. | Overview item reads **1 → 0**; 16-item Timeline payload **32,373 → 1,289 bytes**. Default Inspector file metadata reads **1 → 0** in cap fixture; opened Files reaches all **1,201** rows. |
| Production Planning | Library entries remain immediately useful for the chooser. Library items load only after choosing a template, before mounting its creation dialog. Reopening fetches current Items; errors do not produce a partial/empty creation dialog. | Planning section no longer reads all **120 template Items**. Selecting one template reads its **12 Items**, with unchanged selection and totals. Library management still loads the complete library. |
| Intake | Combined/Production Timeline uses a typed Job/Rework schedule projection, preserving role fixture visibility, lifecycle keys and active Rework overriding terminal original Jobs. Pipeline still includes all current filter inputs. | Same 120 Job fixture: **60,251 → 22,211 bytes** for the Job read. Terminal Jobs were not dropped from the source to manufacture savings. |
| Manpower | Reconstructs repeated worker/task/group labels from complete authoritative dictionaries already requested. All entry history, notes, historical Job/Rework inputs and calculations remain. | Same 1,674 entries: **2,527,878 → 1,729,380 bytes**. Original measured aggregation ~0.52ms median/~0.85ms p95 does not justify backend replacement. |
| Inventory | Hidden Pending table mounts on expansion; selection persists. Production Job choices now load when a lot editor, Pending editor or selected-row controls need them. Closing/reopening refreshes; no TTL. | Cold fixture **8 → 7 data reads**, **120 Job rows / 29,531 bytes deferred**. Earlier collapsed-table measurement avoided **1,235 DOM nodes**; small total DOM changes between builds are not another speed claim. |
| My Work | Job/collaborator choices load for composer/detail/context rather than unopened controls. Current Tasks, groups and counts stay immediate. Group mutation uses the overview's group reload instead of querying groups twice. | Cold fixture **10 → 8 reads**, **120 Job rows / 29,531 bytes deferred**, plus one collaborator read deferred. Group mutation group reads **2 → 1**. |
| Deferred detail correctness | Task attachments ignore obsolete record responses. Bid activity, Files and Updates reads are generation-guarded; relationship cards are keyed by Bid. | Reproduced Bid A history appearing after opening Bid B, then passed the same delayed-response test after correction. Task A attachment response likewise cannot replace Task B's detail. No row data is cached across users. |

Hosted payload observations from the prior report remain directional only: the original and reduced Manpower samples had different live row counts. This completion did not read additional hosted private content or run hosted mutations. The 1,200/1,201-row fixtures below test completeness; they are not a speculative scale redesign or a Production speed forecast.

## Immediate, deferred, on demand

- **Immediate:** authorized shell/profile, current module lists and their existing all-history filters/totals; stock and Pending inputs used by autocomplete; My Work task/group/count data; Production queue identity and phase schedule inputs.
- **Progressive enrichment:** existing notification/unread/welcome owner and list badges; Timeline progress with loading feedback. No speculative background history prefetch.
- **On demand:** Job Files/Updates metadata, section-specific lifecycle detail, full editable Planning items, selected library-template Items, Intake Production/Combined schedule projection, Inventory Job choices and Task composer/detail choices, selected Task attachments, existing Inventory Activity destination, Messaging history/original files.

There is no persistent operational response cache and no arbitrary TTL. Reference reads refresh on reopening their consuming controls; old effect responses are discarded after close/switch. Intake's existing in-flight schedule request reuse remains scoped to bids/revision/role; explicit Refresh changes the revision. No new framework or shared global store.

## Completeness and boundaries

New/changed paged readers use exact counts, deterministic ordering and the existing complete-row reader, which rejects duplicate rows, count drift and missing final pages. This is not a transactional snapshot: same-count concurrent edits are not claimed detectable.

Covered cumulatively: Inventory/Pending, attachment counts/details, Manpower facts and dictionaries, Planning items/progress, Job choices including archived/schedule variants, schedule Jobs and active Rework, Phase Library entries/items, My Work collaborator RPC and Task attachment counts/details, Bid activity/Updates/Files. Collaborator paging preserves the authorized RPC's `lower(display_name), user_id` ordering; it does not substitute a direct app-user read. Bid detail paging keeps timestamp/id descending order. Generic reference paging ends in unique id. Authorization/RLS/RPC predicates are unchanged.

Tests cover 1,201 records with a provider returning only 137 rows, 205 phase scopes, exact historical/inactive/null hydration, final pages, missing/duplicate/count-drift rejection and complete scoped templates. Browser checks retain 1,201-file and historical Inventory access; prior 1,101-item coverage remains valid. Filters continue to operate on their complete existing inputs. No current-only filter was substituted for all-history search/totals.

This is not a claim that every legacy TenOps reader is now unlimited. Unchanged Activity's explicit 500-history limit, notification history's 100 limit, Task/group set RPCs, and untouched summary readers remain separate audits; none was shortened by this pass. New completeness work may add reads where old results were silently capped.

## Realtime and database

No Realtime subscriptions or authorization policies changed. Notification user INSERT, lightweight Messaging unread awareness and released active-conversation/typing reconciliation retain their existing ownership and cleanup. Closed Messaging still makes zero conversation-page/original-byte reads in the browser fixture. Existing record-level refresh semantics remain; no live synchronization is newly promised for modules without subscriptions.

Earlier safe EXPLAIN probe returned 406/PGRST107; no usable hosted query plan was available. No query-plan effectiveness or missing-index claim, no speculative index, no migration/configuration artifact. Existing schema and query contracts are sufficient for this client-only pass.

## Focused validation and reconciliation

- TypeScript, targeted ESLint, cumulative diff check and final Production build.
- `verify-performance-contracts.mts`: complete loaders, reference hydration, selected templates, authorized recipient and Bid detail paging, drift/error cases.
- `verify-performance-schedule-options.mts` and existing `verify-intake-planning-model.ts`: exact schedule display equivalence, active Rework over completed original Jobs, archived options, role fixture filtering and refreshed labels.
- `verify-performance-workflows.mts`: Production queue/Details/Files/Updates/Timeline, rapid Job switching, template selection, Intake Pipeline/rapid Bid activity, Files and Updates switching/Combined Planning, Inventory Pending selection/reopen/history/choices, Manpower, My Work current/shared Tasks/choices/group edits/delayed attachments, Messaging open/close and closed-state signal assertions.
- `verify-performance-two-user.mts` options scenario: two isolated synthetic authenticated users; A edits a Job through Production UI; B reopens Inventory choices and opens My Work composer and sees the authoritative new label. Earlier two-user Manpower historical-entry refresh evidence remains valid.
- Earlier shell/auth gates remain valid: first useful readiness, one bootstrap profile/ensure, subsequent auth refresh, setup/recovery gates, welcome/unread/read-failure recovery and stale-account response protection. No unchanged broad suite or large Messaging transfer suite rerun.

Test fixture corrections included scoped Job filtering, missing Bid planning rows, exact controls, normal discard confirmation nullable contract values, and browser-visible pagination count headers. These were corrected in the harness; they are not reported as app fixes. The reproduced stale Bid history was an application correction. All browser business/auth/Storage traffic was mocked; no hosted two-user/RLS/Realtime validation or completed live Gio exercise is claimed.

Fetched both canonical refs at `c3df23d...`. Rebased the three local performance commits once with no conflict. Cumulative binary patch before/after rebase is byte-identical, SHA-256 `f8450035e6b6c63b904c160411d3145cff17fe7c64d91b94b4bd7f088252ad61`. The six Messaging hotfix files are inherited from canonical, not part of the performance delta. Rebuilt the reconciled export and repeated only affected integration checks.

## Deliberately deferred — Performance Phase 2: Scale, Rendering & Observability

- Current-only Production/Intake or recent-only Manpower loading requires compatible all-history search/totals/drilldown contracts; blindly excluding terminal/history rows would change behavior. Small measured current counts do not justify a new summary service.
- Server analytics/aggregate RPCs, period → week/month + Product + Job + Task totals, large-scale virtualization and deep framework/bundle work await measured CPU/scale evidence. Existing Manpower CPU is inexpensive.
- Persistent reference caching requires proven cross-user invalidation. This pass uses authoritative intent reads instead; operational stale TTLs are not acceptable.
- Inventory Pending data also supports autocomplete. Separating count/options/history requires a coherent server/search contract. Catalog/Activity already have explicit destinations; no initial full transaction preload was found.
- Further Bid Sample relationship projection is behind its existing nested full-record RPC and requires an independently reviewed summary contract. No Sample lifecycle/formulation change belongs here.
- Legacy bounded history/summary pagination, observability budgets, and database/index work require scope-specific contracts and/or actual plans. No partitioning, archive strategy, new global state manager or synthetic 5×/10× redesign.

**Readiness:** suitable for Chris's localhost review and a streamlined client-only release gate after authorization. Representative Gio workflows pass under the stated fixture limits; the live Gio exercise remains next. No backend application step is prepared or required by this delta. Before any later release, verify canonical has not drifted and promote only the approved candidate.

## Exact cumulative changed-file boundary

```text
docs/project-memory/2026-09-28-performance-completion-evidence.json
docs/project-memory/2026-09-28-performance-completion.md
docs/project-memory/2026-09-25-performance-comprehensive-evidence.json
docs/project-memory/2026-09-25-performance-comprehensive.md
docs/project-memory/2026-09-25-performance-first-batch-evidence.json
docs/project-memory/2026-09-25-performance-first-batch.md
scripts/measure-manpower-performance.mts
scripts/measure-performance-readonly.mjs
scripts/verify-performance-auth.mts
scripts/verify-performance-contracts.mts
scripts/verify-performance-schedule-options.mts
scripts/verify-performance-two-user.mts
scripts/verify-performance-workflows.mts
scripts/verify-shell-notification-loading.mts
src/app/client-layout-shell.tsx
src/app/inventory/page.tsx
src/components/AccountNotifications.tsx
src/components/WelcomeHero.tsx
src/lib/auth.tsx
src/modules/manpower/ManpowerWorkspace.tsx
src/modules/manpower/manpower.ts
src/modules/my-work/MyWorkPage.tsx
src/modules/my-work/queries.ts
src/modules/planning/PlanningPanel.tsx
src/modules/planning/data.ts
src/modules/pre-production/BidWorkspace.tsx
src/modules/pre-production/IntakePlanning.tsx
src/modules/pre-production/planning-model.ts
src/modules/pre-production/queries.ts
src/modules/production/ProductionWorkspace.tsx
src/modules/production/components/ProductionGantt.tsx
src/modules/production/components/ProductionJobInspector.tsx
src/modules/production/fixture-visibility.ts
src/modules/production/job-options.ts
src/modules/production/jobs.ts
```
