# TenOps Engineering Execution Standard

This document governs scoped inspection, implementation, validation and reporting. Follow the authority hierarchy in [AGENTS.md](../../AGENTS.md): Chris and Product/Architecture own intended behavior and acceptance; the [Project Manifest](PROJECT_MANIFEST.md) records durable direction; Git/source and narrowly verified hosted state establish implementation reality.

## Compact handoff and status

Reuse the relevant existing decision/candidate/release record. Carry only:

- Objective and approved behavior, with advisory decision/date/reference; name unavailable context.
- Scope, exclusions, invariants and acceptance criteria.
- Exact base/candidate SHA, branch/worktree and target environment where relevant.
- Status, explicit authorization boundary and stop point.
- Validation actually performed, evidence links and remaining uncertainty.
- Next action or Product decision, including the responsible owner.

Use precise status claims: **proposed** means not yet implementation-authorized; **implemented** means code exists at the named boundary; **accepted** means Chris accepted the named behavior/candidate; **deployed** requires target, runtime SHA and observed deployment evidence; **deferred** means preserved outside the active scope. These may coexist for different parts of one feature. Acceptance is not deployment permission; migration files may be created, applied and verified at different times. An unmatched branch is not automatically active work.

## Default workflow

**Prompt → iterate → approve → release.** Establish the compact scope/authorization, then complete and validate a concrete candidate. Reuse evidence when still applicable; return the exact candidate and remaining acceptance items. Chris approves material Product decisions and release actions under AGENTS. Execute only the approved release boundary, then update the existing receipt and Current State with actual outcomes. Documentation-only work ends after scoped review and its authorized commit; no application release is implied.

## Autonomous execution

Inspect the repository, root `AGENTS.md`, current documentation, migrations, and canonical implementation boundaries before changing code. Reuse existing components, helpers, persistence paths, routing, terminology, and visual semantics instead of creating competing implementations.

Complete the coherent scoped feature before broad validation. Resolve routine implementation decisions from repository evidence and existing conventions without unnecessary interruption. When ambiguity remains, choose the safest reversible approach consistent with the requested scope and report the assumption.

Repository approval policy and implementation judgment are separate concerns. A tool or environment may require approval to execute an authorized command; that does not turn ordinary implementation details into product decisions that require user interruption.

## Cost-conscious risk tiers

Choose and state the smallest sufficient tier before directing implementation:

- **Tier 1 — tiny/low risk:** copy, styling, labels, isolated presentation defects, or narrow deterministic fixes. Use one lightweight implementation pass, narrow validation, and no independent review unless something suspicious appears.
- **Tier 2 — normal feature:** bounded UI, ordinary query changes, contained domain behavior, or a small additive feature using established architecture. Use one capable self-validating implementation pass and one EM review of the diff and evidence. Iterate only for a real deficiency.
- **Tier 3 — high risk/architectural:** schema, migrations, RLS, authentication, privacy, destructive lifecycle, canonical-record conversion, Production-data behavior, or multi-module architecture. Use stronger implementation, deeper EM review, and focused adversarial/security verification where warranted.

Additional agent effort must reduce meaningful risk, not merely consume available capacity. Prefer continuing a worker for a small correction while its bounded context is clean. Start fresh only when context is bloated or confused, stale assumptions recur, scope changes materially, or independent high-risk review is justified.

Give workers only the relevant Product Acceptance Contract, engineering context, exact scope, invariants, and validation requirements. Use durable repository memory instead of repeatedly reconstructing the entire architecture. Escalate genuine Product decisions to Product/Chris; do not spend multiple engineering passes trying to infer them from code.

## Operational independence

A completed operational feature should not require a software developer for routine business maintenance. Vendors, Vendor Contacts, Vendor Catalog items and prices, Workers, Tasks, and similar reusable configuration should be safely maintainable by the people performing the work.

Developers build systems; they do not become part of the operational workflow. User-managed configuration must still preserve validation, permissions, historical records, canonical identity, and auditability.

## Browser testing philosophy

Browser testing protects meaningful operational workflows, state transitions, persistence, navigation, canonical relationships, destructive operations, cross-module interactions, and previously discovered defects. It does not exist to maximize coverage percentages.

Add a durable regression test when a real defect affects a meaningful workflow. Prefer extending shared fixtures and an existing end-to-end scenario over adding overlapping tests. Avoid low-value tests for typography, spacing, color, static labels, or isolated rendering already protected at a lower level. One complete workflow test is more valuable than several shallow control tests.

Tests must use deterministic data and waits. Do not weaken assertions, add arbitrary sleeps, blindly update snapshots, conceal failures, or label deterministic failures as flaky.

## Validation discipline

Use this default sequence:

```text
Implement
  ↓
Focused validation
  ↓
Focused browser tests
  ↓
Repair
  ↓
Re-run affected validation
  ↓
Required risk-appropriate completion checks
```

Use the testing levels in AGENTS for the delta and adjacent blast radius. Do not repeatedly run full suites or builds after small edits; broaden checks for a concrete dependency or risk. Documentation-only changes need scoped diff, link and factual review, not builds or application tests. Report unrelated baseline failures separately.

Do not automatically rerun a relevant deterministic verifier that a worker already passed. Review the diff, architecture, verifier coverage, and evidence first. Rerun only when evidence is missing, implementation changed afterward, the result is suspicious, security/data risk warrants independent verification, or the exact release candidate requires the check.

Release execution operates on the already accepted candidate. Confirm the exact boundary, required focused verifiers, warranted build, branch safety, and hosted/deployment result; do not redo feature development or a broad architecture audit without a reason.

## Migration discipline

Schema changes use new forward migrations. Previously applied migrations are immutable. Preserve existing data, ownership, grants, RLS, constraints, canonical relationships, and controlled `search_path` behavior.

Local implementation work may create migration files but must never modify a Production database without Chris's explicit approval. Repository presence does not prove that a migration was applied; completion reports must distinguish created, applied, and verified states. Make migrations safely rerunnable where practical without hiding predecessor incompatibility.

## Workspace and artifact closure

Reuse a suitable existing checkout, review harness and fixture. For new isolation, prefer a sibling worktree outside the repository; inspect its base, branch and dirty state first. Keep raw generated output in task-scoped scratch storage, with task ownership and ports/PIDs recorded.

Keep concise release receipts and selected sanitized evidence; preserve research, dirty work, recovery refs and failed/stopped checkpoints. Review links, shared-helper dependencies, sensitivity and live consumers before proposing adoption, archival or removal. Untracked does not mean disposable. Commit selected explicit paths only when authorized. Retire disposable task output/processes within authorization; skip ambiguous targets and report them. No blanket ignore, clean or prune operation substitutes for review.

## Completion reporting

Use a consistent completion report containing:

1. Summary
2. Files changed, identifying new and modified files
3. Migrations, including behavior and application status
4. Validation commands and actual outcomes
5. Browser tests and workflows actually exercised
6. Assumptions
7. Deferred work or known limitations
8. Implemented/accepted/deployed status, exact Git/runtime boundaries and next decision
9. Final workspace state and disposition of task artifacts/processes

Never claim browser testing from code inspection or migration deployment from a checked-in SQL file. Keep the user-facing report concise: acceptance status, material decisions, migration requirement, security/data concerns, validation evidence, remaining Product-level acceptance, and exact approval requested. Do not reproduce routine worker or command transcripts. End with any manual actions required from the user.

## Current scoped handoff — October 27, 2026

[Intake executed release](../project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026) records Chris's Product acceptance of `5a7159c`, explicit narrow security correction/release continuation, correction `74f799b` and isolated runtime `bc628bd`. Tier3 / focused Level3 regression, real privileged PostgreSQL handler checks and hosted compatibility/security passed; prior candidate validation reused. Exactly the three approved Intake migrations applied with atomic data preservation; existing Sample/Proposal Edge functions updated with JWT verification retained. TenDev then TenOps deployment and exact served assets/mobile auth gates verified. TenBot/AI and unrelated local dev/dirty work remain excluded. No live business test writes or notification/device changes. Separate Advisory context was unavailable; current explicit Chris decisions govern. Status: deployed; receipt-only documentation updates do not require another application build/deployment.

## TenBot scoped handoff — October 27, 2026

[TenBot local candidate](../project-memory/2026-10-27-tenbot-candidate.md) carries Chris's attached Product Implementation authorization: integrated read-only guidance, versioned capability registry, provider boundary and confirmed Product feedback. Tier 3 / Testing Level 3; local dev commit and localhost review only. Intake remains a separate unreleased candidate. Separate Advisory context is unavailable. Product acceptance, reviewer-role choice and provider activation are the next boundaries; no hosted migration/configuration, push or deployment is authorized.

### TenBot floating UI follow-up — October 27

Chris's floating-assistant Product decision supersedes the dedicated-page UI in the original TenBot candidate. [Scoped UI refinement and evidence](../project-memory/2026-10-27-tenbot-candidate.md#floating-assistant-ux-refinement--october-27-2026) use existing dev/local review, Tier 2 / Testing Level 2, unchanged backend contracts and a local commit. Product review is the next boundary; no deployment authorization.


### TenBot metadata polish — October 27

Chris accepted the floating UI at `6a21ce4` and authorized the smallest employee-facing metadata correction, local validation and dev commit. [Scoped presentation polish](../project-memory/2026-10-27-tenbot-candidate.md#employee-chat-metadata-polish--october-27-2026) uses Tier 1 / Testing Level 1 and preserves backend/provenance, capabilities, permissions, feedback and inference state. No deployment authorization.


### TenBot scoped handoff — October 27, 2026

Chris’s explicit “FREE REAL AI INFERENCE PILOT” request and subsequent Workers Free dashboard confirmation authorize the existing dev/local fixture pilot and local commit only; separate Advisory context is unavailable. [Pilot boundary and Product review](../project-memory/2026-10-27-tenbot-candidate.md#free-workers-ai-local-pilot--october-27-2026) carry five actual remote answers, owner-confirmed Free plan plus live catalog/allowance evidence, privacy projection, persistent caps and fallback. Tier 3 / focused Testing Level 3 covers the new external inference/usage boundary; existing feedback/Auth/RBAC/Web Push contracts and migrations are unchanged. Floating UI is Product-accepted; constrained inference is implemented locally, pending Product acceptance. Stop at localhost:3000 Product review. No push, hosted schema/configuration change, paid activation, employee rollout or deployment. Concurrent Intake work and historical receipts remain outside this boundary.


### TenBot conversational/shared-pool and retrieval handoff — October 27, 2026

Chris explicitly authorized continued local dev work from 14a9e67: existing communication access, bounded conversational explanations, then shared daily allocations and the exact Manpower false-match correction. Separate Advisory context remains unavailable. [Current review boundary](../project-memory/2026-10-27-tenbot-candidate.md#conversational-communication-ux-shared-pool-and-guide-match-correction--october-27-2026) records Tier 3/focused Testing Level 3 evidence, generated-prose/permission containment, Messaging isolation, shared 20/day with 6/account/minute and preserved monthly/free guards, administrator-only aggregates and exact no-guide/no-inference regression. One append-only forward usage migration is verified only locally; original migration and hosted state unchanged. Candidate is implemented locally, pending Product review; no push, hosted migration, paid activation, employee rollout or deployment. Independent Intake 5a7159c and unrelated dirty records remain outside this task. Stop at the actual localhost:3000 Messaging → Ask TenBot review.

### TenBot Contacts coverage handoff — October 27, 2026

Chris's exact saved-customer editing report authorizes the smallest local guide/resolution correction and dev commit. Separate Advisory context remains unavailable. [Updated Product review](../project-memory/2026-10-27-tenbot-candidate.md#contacts-guidance-coverage-correction--october-27-2026) records missing editing coverage, released f8f78c5 controls and existing dual-capability enforcement, distinct documentation/access/unavailable outcomes, no retrieval-failure feature suggestion and exact Contacts/Manpower regressions. Tier 2 / Testing Level 2 core/handler plus 17 focused existing-browser groups, TypeScript, targeted lint, diff and export passed; independent review closed the new generic-word ranking risk. No new inference calls, policy/migration, hosted record access or budget/Messaging change. Implemented locally, pending Product review at localhost:3000 Messaging → Ask TenBot; stop after local commit, with no push or deployment. Preserve unrelated records and concurrent Intake work.

### TenBot system-conversation handoff — October 27, 2026

Chris explicitly supersedes the separate Ask TenBot tab with the existing TenOps conversation and includes Enter/Shift+Enter/mobile Send behavior in this pass. Separate Advisory context remains unavailable. [Current boundary](../project-memory/2026-10-27-tenbot-candidate.md#existing-tenops-conversation-becomes-tenbot--october-27-2026): Tier 3 / focused Testing Level 3 for official sender authority and per-account privacy. Existing release-message/RLS/v12 send/read/push contracts were inspected before implementation; no assistant row gains official authority, enters employee send/read RPCs or receives loaded Messaging content. Reused account-keyed controller, normal history/composer and existing in-session persistence; no new schema/system. Core checks, 18 focused final-artifact browser groups (including pending account/thread switches), independent scoped review, TypeScript, lint, diff and export passed without real inference. Contacts correction 72b5a2c is separately committed and preserved. Implemented locally, pending Product review at localhost:3000 Messaging → TenBot; stop after local dev commit. No push, hosted mutation/migration, paid activation or deployment; preserve unrelated work.

### TenBot coverage/conversational correction handoff — October 27, 2026

Chris accepted existing Messaging integration and explicitly requested systematic released knowledge plus intent-aware, multiple-source, own-dialogue reasoning; separate Advisory context remains unavailable. [Current Product review](../project-memory/2026-10-27-tenbot-candidate.md#deployed-workflow-coverage-and-conversational-ai-correction--october-27-2026) carries Tier 3 / focused Level 3 evidence: 34 registry entries / 89 examples pinned to deployed `bc628bd`, Planning disabled public-build proof, unchanged live permission RPCs, privacy minimization, strict fallback, original prose/clarification and deterministic notices. 89 core examples, 49 binding cases and 24 browser groups, preserved local cap/fallback, application/Edge TypeScript, lint/diff/export pass. Four existing remaining reservations yielded mixed real quality; no-call guard/context corrections do not establish successful real-model retesting. All 20/$0.20 local day/month reservations remain spent; further real evaluation needs available authorized budget and fresh Free verification, never a reset/bypass. Implemented locally, pending Product review at localhost:3000 Messaging → TenBot (currently fallback). No schema/grant/UI redesign or budget policy change; no push, hosted mutation/migration, paid activation or deployment. Preserve unrelated Web Push/release records/worktrees and independent port 3000 server; task adapter 55593 / bridge 55594 metadata/artifacts remain under existing private/tmp review directory. Stop after the authorized local dev commit.

### TenBot knowledge/inference refinement handoff — October 27, 2026

Chris's current explicit knowledge/inference refinement request supersedes exhausted pilot testing caps and authorizes a reasonable shared free-only pool, release-aware source extraction, model comparison, focused local validation and dev commit. Separate Advisory context remains unavailable. [Updated Product review](../project-memory/2026-10-27-tenbot-candidate.md#knowledge-and-inference-refinement--october-27-2026) records Tier 3 / focused Testing Level 3, base `3fc36ea`, current Production `bc628bd` verified read-only, 16 generated module chunks / 37 pinned files alongside 34 workflow supplements, actual three-model evaluation, guarded conversational output and honest quality failures. New forward usage migration `20261027140000` is applied only to disposable local PostgreSQL, preserving all historical attempts. Existing Messaging, feedback and permission contracts remain authoritative. Implemented locally, pending Product review at localhost:3000/my-work → Messaging → TenBot; no push, hosted migration/configuration, paid activation or deployment. Preserve independent Intake port 3000 process, unrelated Web Push/Contacts receipts and `.worktrees/`. Stop after local commit; future hosted activation requires a separately reviewed free-only boundary.

### TenBot privacy clarification/correction handoff — October 27, 2026

Chris's explicit privacy correction/local-commit request and subsequent **TENBOT — PRIVACY POLICY CLARIFICATION** authorize arbitrary explicitly submitted text for the employee's own answer, with configured-provider disclosure. They supersede the prior blanket sensitive-text gate; separate Advisory context remains unavailable. [Focused correction and evidence](../project-memory/2026-10-27-tenbot-privacy-correction.md) record Tier 3 / focused Level 3 owner-scoped server history, rejection of forged turns, fixed private-data retrieval boundaries, validated and deliberately confirmed feedback, and non-content-bearing rejection/diagnostics. New migration `20261027150000` is applied only in local PostgreSQL. Real database/adversarial gates, ordinary Messaging/Tasks preservation, existing workflow/budget checks and synthetic localhost browser checks pass. Existing Qwen3/free-only controls and knowledge work remain preserved; the independently inspected 96-record ZIP is unchanged/unintegrated. Implemented locally on dev, pending Product review. No hosted changes, push, deployment or paid activation. Hosted transport/logging/provider retention remain release preflight; no perfect semantic detector is claimed. Preserve unrelated dirty work and the existing localhost:3000 review server; task adapter remains 55593. Stop after the authorized local commit.

### TenBot conversational/presentation polish handoff — October 27, 2026

Chris accepts Qwen3, release-aware knowledge and multi-turn behavior and authorizes final relevance/presentation polish, followed by the conversation-UI simplification in the same local candidate. Separate Advisory context is unavailable. [Focused review](../project-memory/2026-10-27-tenbot-candidate.md#final-conversational-and-presentation-polish--october-27-2026) starts from dev `a936aa5`, uses Tier 2 / Testing Level 2, and preserves model, generator, budgets, owner-history/privacy contracts, Messaging RPCs and confirmed feedback. Dependent source retrieval follows the active topic; verified completed-Job authority answers the exact Rework pre-completion question after real Qwen contradiction/rejection evidence. Presentation makes sources/disclosure/actions secondary and the composer compact. Implemented locally, pending Product review at localhost:3000/my-work → Messaging → TenBot. No new migration, push, hosted change or deployment. Preserve unrelated dirty Web Push/Contacts records and worktrees. The obsolete port 3000 process ended independently; the existing synthetic review server was restored and its old database retained. Stop after local dev commit.

### TenBot approved-icon handoff — October 27, 2026

Chris's current attached-image approval authorizes the white-outline rotary-tool/short-bit/sparkle TenBot avatar on navy, replacing only its existing Messaging sparkle avatars. Separate Advisory context is unavailable; the supplied approved image establishes this visual boundary. [Icon review](../project-memory/2026-10-27-tenbot-candidate.md#approved-tenbot-icon--october-27-2026) starts from dev `7effce0`, Tier 1 / focused Testing Level 1. Shared SVG and its three render sites only; accepted conversation UI, privacy, feedback, inference, knowledge and other branding remain unchanged. Implemented locally, pending visual Product review at localhost:3000; stop after local commit. No push, hosted change or deployment.

### TenBot final integration/release-readiness handoff — October 27, 2026

Chris's current explicit request accepts the existing TenBot conversation, Qwen3, budgets, privacy behavior and approved icon and authorizes final local integration/readiness and a dev commit. Separate Advisory context remains unavailable. [Final candidate review and proposed release requirements](../project-memory/2026-10-27-tenbot-candidate.md#final-integration-and-release-readiness--october-27-2026) carry Tier 3 / focused Level 3 evidence: selective 96-record package reconciliation against deployed October 27 Intake runtime `bc628bd`, retained 34 precise/16 broad entries plus 24 distinct supplements, owner-history/feedback/privacy checks, actual Qwen follow-ups and honest fallback/quality limits. An observed unverified feature-absence claim receives a bounded correction; no model, privacy authority or budget policy changes. Existing icon/UI/DM-task evidence is reused. Hosted metadata confirms all four TenBot migrations, function and five custom secret names absent, compatible predecessors and unchanged Intake/Web Push. Exact selected paths/checksums and the disabled-first deployment/Free-plan/logging gates are proposed only. **Accepted candidate plus locally implemented integration; not deployed.** Stop for final release/migration/deployment/AI-activation authorization. No push, hosted mutation, paid activation or release; preserve unrelated dirty records, worktrees and the actual localhost:3000 review server.

### TenBot authorized release stop — October 27, 2026

Chris authorizes accepted `4c2e1fa` release with ordered four migrations, JWT Edge, verified Free-only AI and TenDev then TenOps, and explicitly prohibits gate bypass. Separate Advisory context unavailable. [Stopped preflight](../project-memory/2026-10-27-tenbot-candidate.md#authorized-release-preflight-stopped--october-27-2026): Tier 3 focused checks confirmed hosted automatic guide fallback is absent (present only in the local review adapter), dedicated provider credential is missing, and hosted logging/Auth gates remain unresolved. Current Free plan and migration predecessors/hashes are verified; no source correction, hosted mutation, migration, push, deployment or inference occurred. Accepted candidate remains `4c2e1fa`; remotes `1785874` and served `bc628bd` unchanged. Resume requires the narrow fallback/configuration correction and privacy-gate resolution; preserve unrelated dirty work and existing review servers.

### TenBot executed release handoff — October 27, 2026

Chris's explicit **TENBOT — RESUME BLOCKED RELEASE** authorizes the two corrections, secure free-only provider configuration, ordered migrations and TenDev-before-TenOps release; separate Advisory context remains unavailable. [Executed receipt](../project-memory/2026-10-27-tenbot-candidate.md#executed-tenbot-release--october-27-2026) records Tier 3 / focused Level 3 completion at runtime `6cb6cf7`, accepted `4c2e1fa` plus fallback `f1547b6`, solely parented to canonical `1785874`. Four exact migrations are committed once after a fully reconciled verifier rollback; never repeat them. Actual HTTP fallback/Auth, SQL owner/Admin isolation, safe API logging, Qwen3/free allowance, exact source/configuration preservation and both deployments passed. Existing local UI/model/knowledge evidence was reused. TenBot v5 is enabled for the two approved Pages origins; Workers Free cost is $0 for one measured request / 7.6589 Neurons, with failed-attempt accounting preserved. Production data, Intake, Messaging and Web Push remain preserved. Knowledge gaps, lazy history cleanup, provider-retention and unsigned hosted-browser limits are explicit. Source-only version counters increased after project secret writes; preserve exact hashes/configuration rather than stale counters. No paid activation, unrelated rollout, announcements or broad test framework. Stop release work after the documentation receipt; rotate the dedicated credential before January 26, 2027 and use the normal accepted-change process for future work.

### TenBot workflow-fidelity handoff — October 28, 2026

Chris's current **TENBOT — WORKFLOW ANSWER FIDELITY** authorizes the exact Bid-conversion answer investigation/correction, existing iPhone viewport defect and local dev commit, with no deployment. Separate Advisory context unavailable. [Focused Product review](../project-memory/2026-10-27-tenbot-candidate.md#workflow-answer-fidelity-and-mobile-keyboard-correction--october-28-2026), base dev `36c00c1`, Tier 2 / Testing Level 2: released Intake/source relationships verified unchanged from `6cb6cf7`; narrow transfer-intent selection, existing prerequisite/preservation sources, permitted entry points and validation/fallback corrected; active mobile TenBot document containment preserves normal Messaging. Exact live Qwen still produced unsupported ownership prose and was rejected: final visible correction is verified guide fallback; successful conversational AI is not claimed. Five bounded calls / 49.028 token-derived Neurons within freshly verified Workers Free; no budget reset/model change/corpus expansion. Focused core/handler, 59 binding cases, four keyboard browser groups, app/shared types, lint, diff, local export and independent EM review pass. Physical iPhone remains manual. Implemented locally, pending Product review at localhost:3000/my-work → Messaging → TenBot; preserve Intake port 3000 and unrelated dirty work. Stop after local dev commit; no push, hosted change, paid activation or deployment.


## TenBot Live Job Intelligence handoff — October 28, 2026

Chris accepts the October 28 architecture review and explicitly authorizes five read-only Job tools, safe local implementation/validation and a local dev commit. The [candidate contract and evidence](../project-memory/2026-10-28-tenbot-job-intelligence.md) retain exact approved active/fixture/date/privacy semantics, caller-JWT authorization, shared effective Rework/labor rules, bounded completeness and no fact-bearing operational history. Base `dfdef9d` preserves concurrent workflow fidelity; Production remains `6cb6cf7`. Tier 3/focused Level 3 includes actual local PostgreSQL/RLS/revocation, quantitative guards, final desktop/mobile real-Qwen conversations and deterministic fallback, types/lint/diff/export. Status: implemented locally, pending Product acceptance at localhost:3000/my-work → Messaging → TenBot. No new migration file, hosted TenOps data/configuration change, push or deployment authorized. Separate Advisory thread unavailable; current explicit Chris contract governs. Preserve unrelated dirty Current State/Web Push/Contacts evidence and original Intake server.

## TenBot QA reconciliation handoff — October 28, 2026

Chris's current **TENBOT — QA RECONCILIATION & RELEASE CANDIDATE** authorizes focused local corrections over `ee2baa6`, retaining `dfdef9d` and the five-tool architecture, with a local commit and Product acceptance stop. Separate Advisory context unavailable. [Reconciled candidate review](../project-memory/2026-10-28-tenbot-qa-reconciliation.md), Tier 3 / focused Level 3, distinguishes old `6cb6cf7` QA outcomes from current source/handler/actual-model evidence. Corrections cover operational read-versus-write/receiving/scheduling/conversion authority, bounded contextual retrieval, permission-specific source availability, selected notices, private-content policy explanation, Job answer relevance and workflow/live dispatch. Tools/projections/JWT/RLS/history/consent/provider/budgets remain intact. 18 exact QA cases, 113 existing retrieval examples, 20 Job groups, six policy groups, 81 binding cases, 18 PostgreSQL groups/109 queries, four mobile groups, five real Job browser groups, types/lint/diff/export and independent EM review pass. Eighteen actual Qwen dispatches / 136.169 token-derived Neurons remain metered; rejected/superseded output is explicit. Workflow/qualitative fallback and Q24 uncertainty remain quality limits. Implemented locally, pending Product acceptance at localhost:3000/my-work → Messaging → TenBot; physical iPhone/hosted Auth/query plans remain separate gates. Preserve unrelated dirty work and Intake port 3000. No new migration, push, hosted change, paid activation or deployment.

## TenBot approved release handoff — October 28, 2026

Chris's explicit **TENBOT — APPROVED RELEASE** accepts `93e7d18` with `dfdef9d` / `ee2baa6` and authorizes dev → main, TenDev before TenOps; separate Advisory context unavailable. [Executed release and focused evidence](../project-memory/2026-10-28-tenbot-qa-reconciliation.md#executed-approved-release--october-28-2026) record Tier 3/focused Level 3 at isolated runtime `c3f39e5e` on canonical `38c0a2a`, exact 31 accepted source paths, fresh caller-JWT/five-tool/RLS/history/Auth/logging/query-plan gates, both builds, 47 served assets/four unsigned Auth checks per site and real Qwen/fallback. No new migration; prior four hashes verified and never repeated. JWT TenBot v8, same Qwen3/Workers Free routing, budgets, Intake/Messaging/Web Push are preserved. Thirteen actor-window requests / 90.754 token-estimated Neurons remain charged, including two measured failed attempts with fallback; incremental Free cost $0. Initial transient lookup and bounded verifier/Auth corrections are retained; no unsafe gate bypass. Status: deployed TenDev `90a74787…`, then TenOps `8ef91b61…`. Physical-device, signed-in-hosted-browser, best-effort/fallback/knowledge limits remain explicit. Preserve unrelated dirty work and localhost processes; subsequent receipt-only promotion requires no runtime deployment.


## Bid Preparation Overview handoff — October 28, 2026

Chris's current UX refinement and explicit TenBot checkout-release confirmation authorize the [focused Overview candidate](../project-memory/2026-10-27-intake-graduation-material-intelligence.md#bid-preparation-overview--october-28-2026), Tier 2 / Testing Level 2, directly on shared dev base `72841ee` with a local commit and Product acceptance stop. Separate Advisory context is unavailable. Existing Bid-context actions and permission gates move from Tools into compact Overview preparation beside related records/handoff; generators, ownership/associations and Won/deposit conversion remain unchanged. No schema/API/migration or broader Inspector change. Preserve the local development history, unrelated dirty records and original localhost:3000 fixture. Eight focused localhost browser groups, TypeScript, targeted lint, syntax/diff checks, optimized export and EM/visual review pass; evidence is linked from the candidate receipt. No push, hosted mutation or deployment is authorized.
