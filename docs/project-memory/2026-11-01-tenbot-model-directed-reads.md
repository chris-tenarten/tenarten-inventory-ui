# TenBot model-directed read orchestration — November 1, 2026

**Implemented locally on dev; Product acceptance pending. Production remains `e71bd981a583e0a4e706f9953c6cc1fcc4d576e1`.** Chris's current **TENBOT — GENERALIZE READ-TOOL ORCHESTRATION** authorizes this focused implementation and local commit, not push, deployment, hosted settings or new funding. The separate Advisory thread is unavailable. Base: `8d590343df8506169e9944beffe84feccbce5c88`. Tier3 / focused Testing Level3, because resource identity, authorization, evidence and owner-private context cross module boundaries.

The candidate removes deterministic operation preselection from a **server-only opt-in** path. It reuses the existing agent loop, capability discovery, five authorized Job tools, knowledge/scope tools and Qwen transport. The model may discover capabilities, resolve an exact resource, sequence different read tools and select grounded facts. No new operational tool, SQL/database interface, write capability, framework or migration was added.

**Actual model evidence is limited.** No fresh Terra or Qwen inference ran for this candidate. Ordinary Terra spending remains disabled. The local Qwen path's existing Workers Free confirmation is expired and its bridge is unavailable; no guard, quota or settings were bypassed. The new adapter and executed tool traces were exercised with explicitly scripted provider responses. These prove orchestration/grounding contracts, not Qwen's ability to choose a good plan. Actual model planning accuracy, latency and fallback rate remain unmeasured.

## Identity correction

The demonstrated wrong-prior-Job risk came from resolving pronouns against retained context before extracting explicit names/numbers. A1/A3 could therefore clarify unnecessarily or use the previous canonical ID; the A2 clarification could search the whole explanatory sentence.

The shared resource parser now extracts bounded explicit names, numbers and UUIDs independently of operation choice. Explicit identity overrides prior focus; quoted names retain their literal content, including names beginning with “Job.” A bare numbered clarification can include explanatory prose while retaining the pending operation and period. Multiple, empty, unfinished or genuinely ambiguous identities clarify instead of borrowing an earlier record.

In the model path, current explicit references withhold old bindings. Detail IDs must come from a current complete exact lookup or reauthorized canonical context. A new named lookup clears prior-only focus, including when that lookup finds nothing. Up to four selected canonical Jobs are allowed. The existing caller-JWT executors still enforce access, bounded arguments and effective Rework fields. No model-authored UUID or prior answer grants access.

## Model-directed path and enforcement

`HostedTenbotConfig.modelDirectedReads` defaults to false. The Production Edge entry/config was not changed. The localhost review harness sets it true; an employee request cannot activate it, and the path requires read-only hosted mode. Future rollout requires Product acceptance and separately authorized selective preparation/staging/deployment.

The opt-in path uses the existing agent protocol and discovery contracts. It does not call the legacy Job operation router before presenting tools to the model, does not substitute a single routed operation's prose for a compound answer, and does not silently rewrite chosen operation/date/status arguments. Resource binding remains deterministic. The five existing operational tools remain `find_jobs`, `get_job_summary`, `get_job_planning`, `get_job_labor_summary`, and `get_production_overview`.

Qwen uses the existing Cloudflare provider endpoint and server-side free-pool reserve/finish RPCs **for every model round**. Same-input estimation and provider-owned usage, conservative missing-usage accounting, exactly-once settlement, caller authorization and cancellation remain enforced. A failed orchestration attempt falls back without making a second Qwen explanation call. No paid allowance or credential configuration changed.

The experiment caps each request at six model rounds, ten tool calls, four calls per round, 640 output tokens per round, 75 seconds and four selected Jobs, within the existing hard bounds. Tool schemas, result/session byte limits, native query bounds, RBAC/RLS and publication freshness remain enforced. Every transmitted operational read and knowledge proof is rechecked before another model dispatch and before publication, including uncited evidence.

The model chooses current host-issued operational facts across its reads. Publication validates those selected facts, includes each record's identity and required limitations, and rejects invented quantities/statuses, execution claims or assertions disguised as clarifications. A saved finish-versus-requested-delivery comparison is computed from validated ISO dates by the host; it is explicitly a comparison of saved dates, not a forecast. Workflow synthesis reuses the existing permission, prerequisite and capability-claim guards. Descriptor bytes/history scope compatibility are preserved. Clarification/workflow prose validation remains heuristic rather than a formal semantic-entailment proof.

At most two prior **employee questions** from the claimed owner's existing archive can retain an unfinished compound goal. They are labeled untrusted employee context and reauthorized for current source/record access before each model step and publication. Prior operational answers, raw tool payloads and provider continuations are not replayed as model context. No new history storage or cross-owner retrieval was introduced.

## Before/after evidence

The independent Production baseline was **15 actual live turns: 4 pass / 3 partial / 8 fail**. Its 13 measured Qwen responses used 9,267 input tokens, 1,589 output tokens and 91.29 estimated Neurons, with zero OpenAI calls. Those are prior baseline costs, not candidate inference. [Source-hashed exact questions and displayed baseline responses](../../scripts/fixtures/tenbot-conversational-qa.json) preserve all 15 cases without adopting or rewriting the prior untracked QA report.

The following comparisons use identical synthetic records/permissions and actual registered executors on both sides. The control is deterministic-only; candidate plans and telemetry are scripted through the actual Qwen adapter. Provider-step counts are simulated. Tool traces include additional server freshness reads, which must not be counted as model-selected calls.

| Actual QA question | Deterministic control | Scripted candidate contract | Steps / local CPU wall time |
| --- | --- | --- | --- |
| E1: “Give me a quick handoff for Job "chris-dev-test": saved dates, labor hours, and unresolved follow-ups.” | Partial: labor only, 1/3 requested components. | Pass: discovery → exact lookup → summary + labor; dates, hours and follow-up count, 3/3. | 4 steps / 11.38 ms |
| B2: “Was any of that rework, or all the original run?” following the explicit-period labor question | Wrong summary; 0/2 attribution components. | Pass: chooses labor with retained period; 4 original/unclassified + 2 Rework hours, 2/2. | 3 steps / 3.89 ms |
| C1: hypothetical allocated PO not received; can Ordered start, and what planning details matter? | Literal Job lookup; 0/3. | Partial: chooses verified knowledge without Job lookup; explains receipt/readiness distinction and planning prerequisites, 2/3. Exact Ordered definition was not separately present in the retrieved guide. | 3 steps / 14.97 ms |

All three nominal scripted investigations completed without provider fallback. Separate negative cases prove deterministic-only fallback on provider/invalid-output failures, quota rejection without dispatch, hard call/round bounds, current permission loss, changed source data and output-grounding rejection. These are contract tests. They do not establish a live candidate fallback percentage, speed improvement or model completion score.

The existing Qwen six-per-account-per-minute limit applies **per model round**. Several multi-step questions can reach it sooner than the old one-call explanation path. Its daily/monthly/Neuron limits are unchanged. Real throughput and model behavior require a later properly metered evaluation; this candidate does not authorize funding or renew a Free-pool confirmation.

## Validation and local review

- **34 new focused groups pass:** identity 7, Qwen adapter 10, orchestration/security 17.
- **36 adjacent groups pass:** existing resource orchestration 15, direct answers 8, hosted history 13. Existing database/JWT/RLS evidence was reused; no database/security campaign or new database write occurred.
- Exact clean-candidate TypeScript, targeted ESLint, packaged knowledge integrity, diff checks and Next production Webpack build pass. The build took 18.35 s. A plain source archive of the exact base plus task overlays restored committed generic-agent bytes, excluding the unrelated dirty latency change. No worktree/branch was created and no provider secrets entered the build.
- Independent focused source review passed after correcting scope-prefix trust, workflow guard reuse, assertion-shaped questions and required identity/limitation companions. Model-directed planning quality remains untested.
- Native Chrome accessibility automation exercised the actual TenOps app at `http://localhost:3000`: combined briefing, exact labor period/daily data, Rework follow-up, different-Job setup then explicit override, focused ambiguity, and close/reload/reopen. Six submitted turns plus the reopen check; no screenshots or live inference. The review shows **“Synthetic records and simulated tool planning; no live inference.”**

The browser fixture uses 7 synthetic hours (5 original/unclassified + 2 Rework), while the isolated comparison uses 6 (4+2); neither is a claim about Production. The API trace records 20 scripted rounds and actual authorized synthetic executor/freshness calls. The browser's complete answers and timestamps persisted across reopening. Guarded operational output is currently factual and can repeat identities/caveats across tool blocks; fluent synthesis remains constrained.

Two existing verifier failures reproduce unchanged from the untouched base and remain deferred:

1. `verify-tenbot-conversation-context.mts:47`: “Can you list Jobs that are On Deck?” compiles a literal search for “that” and misses. The suite stops at that failure; its remaining groups are not claimed passing.
2. `verify-tenbot-hosted.mts:9`: a stale exact status assertion omits the already-existing `persistentHistoryAvailable:true` field. Its remaining groups are not claimed passing.

These were not hidden, relaxed or folded into unrelated changes. [Detailed validation and baseline reproduction](evidence/2026-11-01-tenbot-model-directed-reads/validation.json), [17-group comparison/negative cases](evidence/2026-11-01-tenbot-model-directed-reads/orchestration.json), [browser observations and safe synthetic trace](evidence/2026-11-01-tenbot-model-directed-reads/browser.json), [source boundary](evidence/2026-11-01-tenbot-model-directed-reads/source-boundary.json).

Review location: **http://localhost:3000/my-work → Messaging menu → TenBot**. Synthetic account `customer-review@example.invalid`, password `Local-review-only!`. Suggested questions are the E1 briefing, B1 explicit period, B2 follow-up, A3 saved-date comparison and “What about the other one?” This is a finite scripted review fixture; unfamiliar questions do not demonstrate real model reasoning. The task-owned API runs on 55597 and serves only synthetic conversation actions and reads. The old confirmed review processes were replaced after ownership checks; their restart commands/receipts and original root `out` directory were preserved. The fresh candidate build serves 3000 from the task archive. Process receipts and raw logs remain under `/private/tmp/tenbot-read-orchestration-20261101`.

## Remaining acceptance boundary

The candidate enables model-selected investigation contracts using existing tools. It does not add historical activity/status events, incoming PO/Inventory reservation relationships, follow-up descriptions, physical sufficiency, staffing capacity or remaining-work forecasts. Those require additional evidence/tools. C1 remains a knowledge-coverage partial, and the two baseline verifier failures remain explicit. New tools would not resolve the identity or operation-preselection defects fixed here.

Current candidate inference: **0 calls / $0**. Actual candidate model quality/latency/fallback rate is unverified. Production, hosted settings, permissions, providers, ordinary Terra spending and all write-OFF controls remain unchanged. No migration, hosted database change, push or deployment occurred. Product acceptance, real model evaluation under existing authorized limits, selective release proof and separately authorized staging/deployment remain subsequent gates. No release hold or proof metadata was waived. Stop for Product acceptance.
