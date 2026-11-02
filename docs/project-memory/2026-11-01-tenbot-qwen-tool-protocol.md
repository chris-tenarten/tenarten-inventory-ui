# Qwen tool-call protocol correction — November 1, 2026

**Implemented locally; genuine Job reads proven; TenDev remains HOLD.** Chris accepts the prior live findings and authorizes only the focused protocol correction, bounded read-only retest and local commit. Separate Advisory context is unavailable; this explicit Product instruction governs. Base: `c1992d3`. No Production routing/configuration, permissions, spending limits or operational-write settings change.

## Confirmed cause and correction

The actual prior two response envelopes both contained model-generated ID `call_1`. The pilot transport delivered those labels and usage unchanged. The runtime correctly required unique execution IDs across the turn and rejected the second use. No wrong tool/result pairing was observed: the first undiscovered tool produced a correctly correlated error, then the second call stopped before execution.

Discovery also had a prompt-contract mismatch: the system catalog described several capabilities, but the initial callable schemas contained only `discover_capabilities`. Generic wording said discover “when needed”; the runtime actually required discovery before using any catalog entry. Qwen called the scope tool without discovery, then searched static workflow knowledge for a live count. This was not a missing authorized Job operation or failed transport.

The **Qwen adapter only** now:

- Validates the returned batch, then assigns execution IDs using a server-generated namespace, step and position. Valid provider labels may repeat across rounds; duplicate labels within a batch remain rejected.
- Uses the identical server IDs in `AgentStep.calls` and normalized continuation. Tool names, arguments and ordering are unchanged; subsequent `tool_result.callId` matches the issued call. Raw provider output remains available separately in the private evaluation trace.
- Explains that the supplied tools array is the complete current callable set; a catalog description does not load a capability. Discovery must return before invoking a newly loaded tool.

No operational capability is auto-discovered or injected by the host. Generic runtime discovery, unique-ID checks, authorization, schemas, evidence publication and bounds remain intact. No generic router/core change or question-specific handler was added. The unrelated dirty generic-agent change is excluded from the candidate and preserved in dev.

## Focused validation

Tier 2 / focused Level 2 protocol validation: **14 changed-adapter groups and 17 directly adjacent orchestration groups pass**, plus strict targeted TypeScript, ESLint, diff checks and the exact isolated Webpack production build. Independent EM review found no blocking mapping/auth issue. The existing 103 transport checks and real database/JWT/quota evidence were reused.

Offline replay of the exact two raw responses now reaches both `capability-not-discovered` checks without an ID collision; neither tool executes. A separate scripted discovery → parallel planning/labor → final sequence verifies successful pairing and unchanged authorization/accounting. These are explicitly scripted regressions, not live model-quality results.

Build notes: default Turbopack rejected the archive's external dependency symlink. The established Webpack path passed. One invocation mistakenly ran from dev and regenerated ignored build output; tracked files remained unchanged. The exact isolated candidate then built successfully with dummy public build configuration and no real provider credentials.

## Actual live retest

The existing Free allowance/model preflight passed with its still-current owner confirmation; no confirmation, ledger or quota was reset. The existing isolated fixture, genuine signed synthetic employee, caller-scoped five Job tools and both canonical meters were reused. No SQL or write capability reached the model.

| Turn | Actual model-selected sequence | Outcome | Agent latency | Calls | Neurons | Deterministic control |
| --- | --- | --- | --- | --- | --- | --- |
| Production count | Discover overview → overview with In Production/active archive scope → blocked undiscovered workflow search → final | Correct authorized count: 0; verbose presentation | 9.167s | 4 | 76.456 | Correct 0 in 424ms |
| “Which Jobs are they?” | Discover seven read capabilities → overview → filtered `find_jobs` → workflow search → scope → repeated workflow search | Both authorized populations correctly 0, but no final answer; `round-limit` | 19.587s | 6 | 187.965 | Complete empty list in 744ms |

The first actual operational tool proof succeeds. All **nine normalized host call identities are unique**, with validated raw/normalized name, argument, position and continuation pairing. There is no `invalid-call` collision or mismatched tool response. Three model-selected Job reads complete successfully. Count/list use equivalent In Production, archived-excluded authorized populations.

Remaining reliability failure: Qwen makes **four unnecessary knowledge/scope attempts**, one blocked by discovery. On the follow-up it already has complete empty-population evidence, but continues calling unrelated tools instead of finalizing. The unchanged six-round limit stops it after19.587s. This is model tool relevance/termination failure, not unavailable tools, retrieval failure, authorization failure, timeout or exhausted inference funding. The count answer also leads with explanatory tool semantics instead of the requested number; no presentation redesign was attempted here.

Per the requested early-stop boundary, **Specific Job → schedule and compound summary were not run**. No more inference was issued after the failed follow-up. These cases remain unvalidated; this is not a four-case pass or a broad model benchmark.

Actual provider usage: **10 rounds, 51,550 input tokens, 853 output tokens, 264.421 rate-derived Neurons; $0 within Workers Free**. Provider inference latency totals 9.172s; the complete process takes 94.392s including deliberate 61-second inter-turn pacing for the existing minute quota. Actual fallback was disabled to isolate model behavior; one of two attempted tasks requires fallback. One of two tasks completed. The successful count alone used 76.456 Neurons; the failed follow-up used 187.965. Do not interpret metering outcome `completed` as employee-task completion.

PostgreSQL readback confirms all 10 new inference reservations settled with exactly 51,550/853 tokens and 264.421 Neurons, no unmeasured new call and zero still-reserved rows. All 18 historical/test/live rows remain, accounting for 285.877 Neurons including the earlier synthetic/unknown test accounting. The local account journal independently retains/settles the same 264.421 new Neurons. Caps, permission and unrelated-policy fingerprints remain unchanged. No migrations or fixture setup were needed in this pass.

## Product review boundary

**Recommend HOLD for TenDev/model-directed opt-in.** The execution identity defect is fixed and real authorized tool selection now works, but termination/tool relevance remains unreliable. Keep existing deterministic Production behavior and fallback; do not increase limits, suppress grounding or add phrase-specific routing to hide the failed turn. Further quality work needs a separate focused decision. These two zero-population turns do not establish general Qwen capability or named-Job/compound performance.

Only the Qwen adapter, its verifier, the measurement harness and this task's evidence/documentation are in the local commit scope. Unrelated dev changes and previous receipts are preserved. No push, deployment, shared-database/configuration change, operational write, permission activation, enrollment or new review server occurred. The temporary remote binding was disposed and the bounded process exited normally with a recorded failed evaluation status.

[Actual plans, normalized mapping, timings, source hashes and metering evidence](evidence/2026-11-01-tenbot-qwen-tool-protocol/results.json). Private evidence: `/private/tmp/tenops-tenbot-qwen-tool-protocol-20261101` and `/private/tmp/tenops-tenbot-qwen-tools-live-hewKBH`. Stop for Product acceptance.
