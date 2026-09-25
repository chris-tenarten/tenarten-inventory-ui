# Comprehensive performance candidate — localhost review

Continues accepted `662fce1` on `perf/loading-first-batch`, rooted at released `1ff0a134a1389aa2a7fa0a2f91ef3d1a284a74fe`. The original checkout and untracked Messaging note remain untouched. Candidate worktree: `/private/tmp/tenops-performance-workstream`; review server: **http://localhost:3107**. No hosted mutation, migration/index application, push or deployment.

Tier 2 / Testing Level 2: loading/projection/rendering changes using existing authorized queries. No business persistence, permission policy, calculation semantics or schema changes. The [initial loading map](2026-09-25-performance-first-batch.md) remains the architecture/discovery reference; [cumulative evidence](2026-09-25-performance-comprehensive-evidence.json) records the implemented delta. No wall-clock speedup claimed.

## Implemented together

| Group | Before → after | Completeness / freshness contract |
|---|---|---|
| Accepted notification owner | Original cold history 9 reads/900 rows/438,930 bytes → final 2 reads/200 rows/97,540 bytes, using 100-notification fixture. Accepted Batch 1 alone was 3 reads. Change event remains 2 → 1. | WelcomeHero consumes only account-tagged welcome status. Bell still owns history, unread, focus, changes and Realtime. No response cache. |
| Auth bootstrap | `getSession` and recovery/initial auth events repeated profile and welcome ensure. One bootstrap now owns the recovered session. | Supabase recovery `SIGNED_IN` before `INITIAL_SESSION` is handled by `getSession`; later sign-in, token refresh and user update still refresh. Password setup/recovery gates unchanged. Cold fixture asserts one profile and one ensure request. |
| Production queue / Timeline | Overview fetched all Planning items; now **zero item requests**. Timeline uses only id, phase id, completion and estimated hours: 16-item fixture **32,373 → 1,289 bytes**. | Full phase schedules remain available for staging. Timeline shows loading status until progress arrives. Editor requests full item details separately; calculation unchanged. No terminal Job hidden or removed. |
| Job Inspector | Default Details formerly fetched 1,000 file metadata rows/254,781 bytes in the cap-stress fixture; now **zero** until Files or Updates is selected. Rework/labor lifecycle detail only loads on Details. | Existing summary count remains on Files tab. Opening refreshes authoritative metadata/count; no stale TTL. Updates waits for its attachment input. File upload waits for metadata; tabs cannot leave during a parent upload/delete. Recent Changes remains eager and bounded because its count is visible. |
| Manpower transfer | Reporting already reads workers/tasks/groups separately; those repeated per-entry joins are now reconstructed from the complete reference reads. Same 1,674 fixture entries: **2,527,878 → 1,729,380 bytes**. | All entries, notes, historical search/totals, archived Job links and Rework joins retained. Inactive references retained. Missing required references fail visibly instead of dropping rows. No retained reference cache. Mutation loaders remain unchanged. |
| Inventory collapsed panel | Pending Receivals data formerly rendered its hidden table; now table mounts on expansion. Fixture DOM **15,531 → 14,296** while collapsed. | All 76 pending rows and selection remain available after reopen. Data is still loaded because its material/vendor/unit values feed existing Inventory autocomplete. No receiving semantics changed. |
| Complete data access | Explicit exact-count, deterministic pagination added to Inventory/Pending reads, attachment metadata/counts, Manpower worker/task/group references, new entry-facts loader, full Planning items and progress projection. | Tests cover 1,201 records under a 137-row provider cap, 205 phase scopes, final page, duplicates, missing page/count drift, 1,101 browser Inventory items and 1,201 browser files. More requests when needed for completeness are intentional; the old 1,000-file truncation is not a performance benchmark to preserve. |

All history needed by existing filters is retained. Deferred reads refresh on re-entry, rather than becoming a long-lived client cache. Ordinary list ordering is retained with id as the deterministic final tie-breaker. Planning scope batches are merged into the original item sort order.

## Measurements and scope

Production exports, not development Strict Mode. Synthetic browser fixtures measure work and verify behavior; they do not measure hosted RLS execution time. Auth and all business mutations in tests are mocked. No real private messages, attachment bytes or private task contents were retrieved.

Read-only hosted Manpower: original joined query returned **1,878 rows / 1,961,322 bytes** in four requests; reduced projection later returned **1,885 rows / 1,233,624 bytes** in four requests. Live entries grew between samples. These are directional payload observations, not a paired latency benchmark. Original aggregation over the actual entry distribution took approximately **0.52ms median / 0.85ms p95** in 50 warm local samples, with empty label vocabularies. No server aggregation rewrite is justified by that CPU cost. No raw operational rows, notes or names were persisted by measurement scripts.

Representative request totals relative to accepted Batch 1: Production Details 23 → 21; Intake open/close 12 → 11; Manpower 16 → 14; My Work 12 → 10. Total requests may remain flat or increase where pagination fixes previously truncated results. For example complete Files now loads three pages for 1,201 metadata rows. Individual eliminated/projection costs above are the stable performance claims.

No migration/index artifact or hash exists. The earlier safe EXPLAIN probe returned 406/PGRST107; plan output is unavailable through the hosted REST API. No settings changed or speculative index proposed. Existing index definitions remain repository evidence only.

Realtime unchanged: notification user INSERT channel; messaging user INSERT/UPDATE badge channel; active system/peer/typing channels remain scoped to the released Messaging design. No new subscriptions. Messaging 40-message paging, bounded reconciliation, lazy previews and explicit originals remain untouched. Browser checks confirm no initial message-page read while closed; hosted delivery was not exercised.

## A / B / C boundaries after this pass

- **Shell:** A session/profile/access and requested module; B notification/unread/welcome status from one owner; C conversation history/files.
- **Production:** A unchanged useful queue and phase schedule data; B existing badges/labor summaries; C Timeline item progress, opened Inspector file metadata, relevant lifecycle details. Full editor item notes are separate from list progress.
- **Intake:** A current Pipeline; B owners; C Bid activity/relationships and Files/Updates tabs. Timeline's Production/Combined projection remains intent-loaded. Early Access, TEST and conversion rules unchanged.
- **Manpower:** A complete entries and reference dictionaries required by current all-history search/totals. Transfer is smaller; recent-only/windowed semantics are deliberately not substituted. Analytics reuses those entries without a new read.
- **Inventory:** A current stock; B Pending/reference data needed by existing selectors; C hidden Pending table rendering, separate Activity and Catalog destinations.
- **My Work / Messaging / Reporting:** retain existing authorized filters, selected details, summary/period queries and bounded Messaging history; benefit from the leaner shell.

List → Inspector convention now has concrete implementations: summary attachment counts versus opened metadata, and Timeline progress DTO versus editable item DTO. Identity/current state renders first; useful detail is not replaced with an empty Inspector.

## Focused validation and Gio exercise readiness

Passed:

- `npx tsc --noEmit`, targeted ESLint, `git diff --check`, Production build.
- `scripts/verify-performance-contracts.mts`: real loaders against a mocked low-cap provider, deterministic complete paging, exact hydration equivalence, inactive/null/historical references, refreshed second-user labels and failure detection.
- `scripts/verify-performance-workflows.mts`: Production queue → Details/Files; Timeline; Intake Pipeline → Bid; Intake Planning Combined; Inventory collapsed/expanded with selection persistence and newest historical transaction detail; full Manpower row count; My Work; Messaging open/close. Separate 1,101-item and 1,201-file checks. Final Files check includes loading/upload guard.
- `scripts/verify-performance-two-user.mts`: two isolated synthetic authenticated browser contexts; user A renames a reporting group through UI, user B uses normal Refresh and opens all 1,674 historical entries with current group/worker/task labels.
- `scripts/verify-performance-auth.mts`: one bootstrap profile/ensure, later SIGNED_IN/TOKEN_REFRESHED/USER_UPDATED revalidation, setup/recovery password gates.
- Accepted shell verifier: unread welcome onboarding, 100-row history, mark-all-read, refresh failure/recovery, account switch with old response pending. Final cold result 2 history reads.

These are representative readiness checks, not a claim of a completed live Gio exercise or hosted two-user/RLS/Realtime validation. Original legacy source-regex WelcomeHero verifier remains obsolete as documented in Batch 1; it was not rewritten to manufacture a pass. No broad unrelated suite was run.

Review caught and corrected fixture selectors for native controls/desktop duplicates and a provider-cap assumption in the new facts loader. App review also added a guard against starting file mutations during deferred metadata loading. Only affected checks were repeated. No discarded fixture failure is presented as application success.

## Remaining opportunities and risk boundary

Safe measured opportunities selected from the roadmap are implemented. Remaining large candidates require new semantics/contracts or stronger backend evidence:

- **Current-only Production/Intake and recent-only Manpower:** existing all-history filters/search/totals and unarchived terminal Jobs are visible behavior. A new search/pagination/aggregate contract is required before excluding those rows. Manpower CPU is already cheap; retain the future period → week/month + Product + Job + Task aggregate direction, not a speculative service rewrite.
- **Inventory data deferral:** Pending rows feed autocomplete even when the panel is closed. Separating count, options, current rows and history needs a coherent server/search contract. Hidden DOM waste is removed now.
- **Persistent reference caching:** invalidation across users is not proven by a TTL. This pass instead removes repeated labels using authoritative existing reads. Do not cache operational Jobs/tasks/labor to improve benchmark counts.
- **Summary RPCs / indexes:** require query plans, hosted compatibility and authorization review; no broad RPC rewrite or schema change is justified here.
- **Unchanged bounded/history paths:** Activity's existing 500 limit, notifications' 100 limit, My Work history and per-Job Update/Rework history remain next-stage pagination audits. They were not redefined by this pass. Production material/update summaries and general Job-option loaders were not changed; existing limits there are not claimed fixed.

Suggested measurement triggers remain >10k Manpower rows, >2MB joined JSON, or repeated >50ms aggregation tasks on supported hardware. Payload reached approximately 2MB, and this pass directly reduced it; CPU did not approach that trigger. Avoid adding speculative prefetch while critical requests are active. No unmeasured background history preload was introduced.

## Changed boundary and review

New application changes beyond accepted Batch 1: `src/lib/auth.tsx`; `src/app/inventory/page.tsx`; `src/modules/manpower/{manpower.ts,ManpowerWorkspace.tsx}`; `src/modules/planning/data.ts`; `src/modules/production/{jobs.ts,ProductionWorkspace.tsx,components/ProductionGantt.tsx,components/ProductionJobInspector.tsx}`. Batch 1's three shell/notification files remain preserved.

Support: five focused measurement/verifier scripts (`measure-manpower-performance.mts`, `verify-performance-{contracts,workflows,two-user,auth}.mts`), this report and evidence JSON. No dependency manifest/lockfile changes, no migration artifacts. Original untracked note SHA-256 remains `a77706eaec0cb91df8a39d4d7ad987ecdd67272b5d1b0fa4919c04e27a010f77`.

Manual review at localhost:3107: normal login, Production Details → Files/Updates → Timeline, Intake Pipeline/Planning, Manpower search/older groups/Refresh, Inventory Pending collapse/reopen and history, My Work, Notifications and Messaging. The served app uses its configured backend; automated checks used mocks. Stop here for Chris's review before any release.
