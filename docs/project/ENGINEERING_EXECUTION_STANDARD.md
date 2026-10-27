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

[Intake graduation / material intelligence](../project-memory/2026-10-27-intake-graduation-material-intelligence.md) carries Chris's October 26/27 Product Implementation authority, canonical dev base, invariants, Tier 3 validation and local review boundary. Its October 27 UX refinement records the subsequent explicit author-in-Samples/reference-in-Intake decision, optional Production quantities, shared input reuse and focused compatibility evidence on `00ce91a`. Work is local on dev; the stop point is Product acceptance. Local commit authorization does not include push, main promotion, hosted migrations, Production writes, notifications or deployment. The separate Advisory conversation was unavailable.
