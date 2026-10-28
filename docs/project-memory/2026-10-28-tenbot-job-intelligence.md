# TenBot Live Job Intelligence — October 28 local candidate

**Implemented locally on dev, pending Product acceptance.** Chris accepted the October 28 read-only architecture review and authorized the five read-only tools, local safe-fixture validation, localhost review and a local dev commit. Base: `dfdef9d` (the concurrent workflow-answer/mobile correction, preserved). Production remains the separately released `6cb6cf7`. The separate Advisory thread is unavailable; Chris's explicit implementation request and approved decisions govern this candidate.

No new migration file, hosted query/data mutation, hosted migration, push or deployment belongs to this implementation. Existing canonical migrations were replayed only where missing in the established disposable local fixture. No new branch, worktree, broad framework, grant or Production record was created.

## Accepted Product semantics

- Active Jobs are nonarchived Not Started, On Deck, In Production and On Hold. Shipped/archived Jobs do not enter the default active count.
- Management summaries exclude the exact reviewed `chris-dev-test` UUID `cba79566-3fde-4910-9cf6-45687db70b01`, shared with existing Production fixture visibility. No fuzzy name/legacy-source exclusion. Explicit fixture lookup additionally requires current `manageUsers`; ordinary summaries exclude it for everyone.
- Historical Job search is explicit (`include_archived`). Job UUIDs establish identity; ambiguous names remain unselected.
- Default labor uses the existing inclusive trailing 30 calendar dates: Chicago today minus 29 through today. On October 28 this is September 29–October 28. Upcoming planned finishes use Chicago today through today plus 29 (October 28–November 26). Date-only values retain their calendar meaning.
- Planning completeness is recorded setup completeness, not Production readiness. No completion percentage, forecast, risk score or new cost calculation.
- Missing values stay unknown. A confirmed empty recorded scope can have a recorded count/sum of zero; that does not establish no physical work or no blockers.

## Implemented tool contracts

`createTenbotJobTools` receives only the authenticated caller's client. Its five allowed names have fixed projections, strict argument keys, current capability checks and final visibility checks. There is no SQL input, arbitrary table/projection selector, write method or service-client parameter.

| Tool | Arguments | Result |
|---|---|---|
| `find_jobs` | `query?`, `include_archived?`, `limit?`, bounded `cursor?` | Exact UUID/number/name resolution first; bounded candidate references and lifecycle facts; unselected ambiguous results. |
| `get_job_summary` | `job_id` | Original/effective lifecycle, saved dates, material status, planning completeness/missing fields, recorded Rework and unresolved-follow-up counts. |
| `get_job_planning` | `job_id` | Persisted schedule/setup facts; phase/item detail explicitly disabled, with no phase/item query. |
| `get_job_labor_summary` | `job_id`, optional paired `start_date`/`end_date` | Complete bounded-period recorded hours, entry count, latest work date in period, daily and Rework breakdowns. |
| `get_production_overview` | `include_archived?`, optional paired dates for upcoming list, `limit?` | Current visible Job/status/scheduled counts, approved active count and bounded upcoming saved finishes. Date window applies to upcoming list, not historical completion events. |

The envelope includes tool/version, status, Chicago timezone, applied filters, units, source references, read-start/read-completion timestamps, `best_effort_multi_query` consistency, complete/truncated flags and explicit unknowns. Search/upcoming output is capped at 20 Jobs. Source coverage is capped at 1,000 Jobs / 2,000 labor entries, with 200-row transport pages, a four-second abortable whole-tool deadline and a 366-day maximum reporting window. Rework breakdowns are capped at 20; daily output is bounded by the reporting period. Incomplete transport never yields asserted exact totals.

The application and tools share extracted existing Production lifecycle/readiness/active-status definitions and Manpower integer-hundredths accounting. Active Rework overlays the original Job consistently; the original lifecycle remains explicit. Null Rework attribution remains original or unclassified. No Monthly Snapshot/history-wide loader is called.

Natural routing keeps workflow explanations and explicitly pasted-text tasks on their existing paths. Named Job questions resolve exact candidates. Follow-ups use only an owner-scoped canonical UUID seed, then reread. Supported relative/explicit periods use Chicago calendar boundaries; invalid/conflicting/unbounded periods clarify rather than silently becoming the default. Historical completion-event cohorts and unsupported combined filters clarify their current boundary.

## Authorization, privacy and inference

The Edge authenticates the caller, then passes that JWT-bound client to the tools. Each tool checks `readOperationalData`, queries under caller RLS, then rechecks capability and visible Job IDs before returning facts. Explicit fixture access rechecks `manageUsers`. Long inference is followed by another authorized read; changed or revoked facts replace model prose with fresh deterministic results. Missing and inaccessible Jobs share a nondisclosing outcome.

Existing service authority remains limited to usage reservation/finish and owner-history append. Tools do not read private DMs, personal tasks, financial fields, contact/employee identities, raw Updates/remarks, Rework scope, attachments or document contents. Follow-ups count only structured unresolved Update records. No independent material sufficiency/shortage claim is introduced.

Operational facts are separate from release-pinned workflow sources and generated prose. Qwen3 receives bounded structured fact sentences, no private dialogue or raw business records. It returns fact-linked original claims. Deterministic validation rejects altered/swapped numbers/dates/units, foreign subjects/statuses, removed unknowns/negation, unsupported causation/readiness/forecasts and uncited claims. The validator is deliberately conservative; it is not a general semantic-entailment proof. Rejected output/provider/quota failures use available deterministic facts without another model call. Existing free-only model, shared/burst/Neuron budgets, provider abstraction and conservative failure accounting remain.

Operational questions/answers are not saved as fact-bearing assistant prose. The existing owner store retains only a server-authored canonical UUID/tool/filter marker; ambiguity/search names serialize no context. Other assistant history and deliberately confirmed feedback keep their prior contracts. A refresh requires an existing owner conversation and makes no inference/history append.

The client has no persistent live-response cache. Previous live facts clear on another request, access-profile/account change and loss of foreground. Foreground refresh reauthorizes every 30 seconds and on return. In-flight responses are checked against current owner/access/foreground. **This is bounded refresh, not instantaneous revocation delivery**; already-displayed information cannot be retroactively unseen. Tool authorization always runs at the next call. Static workflow history remains owner-scoped under its existing expiry.

## Validation and review

Tier 3 / focused Testing Level 3:

- [Real PostgreSQL/RLS tool and handler receipt](evidence/2026-10-28-tenbot-jobs/tool-validation.json): 18 groups, 109 direct tool queries, four synthetic provider attempts through actual local history/metering RPCs. Includes exact/ambiguous/historical lookup, fixture exclusion, Rework, labor/date boundaries, unknowns, pagination, timeout, malformed null labor, read-only/inactive accounts, row/capability revocation during a tool and during inference, cross-account/forged history and private-field sentinels. Existing feedback/history/usage rows were preserved; new task-owned reservations remain charged.
- Routing/evidence verifier: 12 focused groups including date routing and invented/swapped quantitative/qualitative claims. Existing core verifier passes 16 extracted chunks / 113 workflow examples.
- Existing binding verifier: 81 no-network cases, including the operational input boundary and unchanged free-only metering guards.
- Application/shared TypeScript, targeted application/shared ESLint, diff checks and optimized local-environment Webpack export pass. The shared factory typechecks against the actual Supabase SDK client.
- Existing Rework architecture, fixture visibility and Manpower accounting checks pass. The readiness verifier's functional assertions pass, but its untouched historical queue-source assertion still fails; no unrelated queue behavior was changed.
- [Desktop/mobile safe-fixture conversations](evidence/2026-10-28-tenbot-jobs/browser.json) use the actual application and local adapter, with no Auth injection/request interception. Final pass: three validated Qwen explanations, two safe model fallbacks, one deterministic ambiguity and one no-inference refresh. Across both complete review passes and the initial response-observer correction, 11 actual safe-fixture responses used 6,657 input / 1,586 output tokens and 79.125 token-estimated Neurons; no reservation reset/refund. Selected screenshots and exact model/fallback modes are retained. Foreground invalidation and no-inference reauthorization are exercised.

Local SQL uses actual authenticated roles and JWT-sub claims; it does not prove hosted HTTP Auth, deployed query plans or a new hosted permission policy. No signed-in hosted browser or physical-iPhone claim is made. Existing broad compatibility policies are preserved; explicit tool capability checks do not assert that all database reads already enforce those checks.

Review **http://localhost:3000/my-work → Messaging → TenBot**. Safe fixture examples:

1. “What is the current status of Job TB-2801?”
2. “How many recorded labor hours does that job have?” — 8.3 recorded hours for September 29–October 28.
3. “How many active Production Jobs are there?”
4. “What is the status of Job \"TenBot Review Shared Name\"?” — two choices; no selection.
5. “What is the status of Job TB-2805?” followed by “What work is scheduled next for that job?” — active Rework #2, saved dates and disabled phase detail.

The original Intake-owned application process/port 3000 remains. The confirmed obsolete task-owned TenBot adapter was replaced on port 55593; existing free-only binding remains on 55594. Metadata is in `/private/tmp/tenops-tenbot-review/server.json`. Local fixtures are synthetic canonical rows in `tenops-tenbot-review`; they are not Production records. Other workstreams' evidence, dirty records, worktrees and ledgers remain preserved.

## Release requirements and remaining limits

No new schema migration is required for this candidate. Future release would require separate authorization for the exact selected application/shared helper boundary and updated TenBot Edge bundle, followed by narrow hosted Auth/RLS/capability, logging/privacy, feature-gate and query-plan checks. Existing default-off/provider configuration and free-only safeguards must be verified at that release boundary, not inferred from localhost.

Current-source scans are bounded and use existing Job/date/reservation indexes where applicable. Name/substring search and exact aggregate performance are not certified against current hosted cardinality/compute; a small output limit does not prove an indexed execution plan. No compute upgrade, new index, cache framework or broad historical scan was introduced. Bounded scope failure returns partial/unknown results.

Phase/Item Planning, material sufficiency/shortage evaluation, raw blocker prose, related document contents, employee analytics, historical completion-event reports, Job References/Share Job links and all writes remain outside this candidate. Stop for Product acceptance; no push, hosted mutation/migration or deployment is authorized.
