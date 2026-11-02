# TenOps — ChatGPT continuity handoff, November 2, 2026

**Snapshot:** November 2, 2026, America/Chicago. **Status:** documentation implemented; pending Product review. Repository and retained receipts inspected; no fresh hosted verification performed by this continuity pass.

**Authority:** Chris's **TENDEV — CHATGPT CONTEXT TRANSFER & PROJECT MEMORY RESTORATION** request accepts Stage 1 and authorizes Stage 2 immediately, superseding the earlier deferral. Its supplied Product decisions and same-day **Living Schema & Capability Documentation** direction govern this handoff. The separate ChatGPT advisory conversation was unavailable. This single dated transfer uses the existing compact-handoff convention; it grants no application, funding, migration, integration or release authority.

## Read this first

TenOps (Tenarten Operations Control) is Tenarten's internal operations platform for a terrazzo manufacturing business. Production is the center of gravity. Preserve useful Excel/notebook/Monday workflows while replacing duplicate entry and fragile relationships. Favor dense, familiar, information-first workspaces, clear business language, explicit consequential actions and minimal administration. Success means employees complete useful work with little training.

`public.jobs` is the canonical Production Job identity. Inventory/reservations, purchasing, labor, material usage, planning, files and documents connect to it where meaningful. Bids, Proposals and Samples retain their own domains; pre-Production work must not fabricate Jobs or Job numbers. Issued documents preserve historical snapshots. My Work, Inbox and assistant conversations remain participant/owner-private; Admin cleanup authority does not permit routine transcript access.

The stack is Next.js App Router, React, TypeScript and Tailwind; Supabase supplies Auth, PostgreSQL/RLS, RPCs, Storage, Realtime and Edge Functions. Cloudflare Pages hosts separate TenDev and TenOps frontends. Their backend is shared: a TenDev change to an Edge Function or schema can affect Production. Separate branding is not isolation.

Use these existing owners, in order, then consult only relevant scoped records:

1. [AGENTS](../../AGENTS.md): authority, approvals, privacy and preservation boundaries.
2. [Project Manifest](../project/PROJECT_MANIFEST.md): enduring Product Canon and architecture.
3. [Current State](CURRENT_STATE.md): status/evidence index; **its October 21 opening is stale at this snapshot**. Use the newer release boundaries below until its owner reconciles it.
4. [Execution standard](../project/ENGINEERING_EXECUTION_STANDARD.md#compact-handoff-and-status): scoped handoffs, execution and proportionate validation. Old task-specific instructions are historical unless still applicable.
5. [Documentation index](../README.md), [Open Questions](OPEN_QUESTIONS.md), and focused workflow/schema/decision/release records. Historical rationale and planned diagrams do not establish current deployment or authorization.
6. [Technical inventory](../schemas/README.md): physical-schema retrieval, existing services, actual TenBot tool exposure, source/release boundaries and freshness. Physical detail stays there and in its source references, not in this bootstrap. Codex maintains affected technical references during the same schema/service/API/capability implementation and release work.

> Before proposing new database structures, services, or agent tools, first consult the existing technical inventory. If its freshness or completeness is uncertain, ask Codex to inspect the current source and deployed schema, then recommend the smallest change that reuses existing functionality.

## Status language

| Claim | Required meaning |
| --- | --- |
| Proposed | Product direction/backlog; scoped implementation authority is not implied. |
| Implemented locally | Code/document exists at a named source boundary; no release implied. |
| Validated | Named checks actually support the tested behavior; retain fixture, environment and missing-check limits. |
| Product accepted | Chris accepted the named behavior/candidate; does not imply migration or release permission. |
| Deployed to TenDev | Exact TenDev runtime/deployment evidence exists; identify shared backend changes separately. |
| Deployed to Production | Exact TenOps/runtime/deployment evidence exists; state what employees can actually use. |

These claims can coexist for different parts of a feature. Retain deferred/rejected scope with its dated decision instead of treating it as an active commitment. Passing source/build gates is not conversational acceptance.

## Latest known release and employee behavior

The [November 2 TenDev release receipt](2026-11-02-tenbot-conversational-tendev-release.md) and [sanitized JSON](evidence/2026-11-02-tenbot-conversational-tendev-release.json) supersede earlier local-only infrastructure summaries for this exact boundary. Initially untracked, both were retained by their release owner in **`f9ec952` during this handoff pass**. They were not staged or changed by this pass. Identities below are retained receipt observations, not a new hosted check.

| Boundary | Latest recorded identity/state |
| --- | --- |
| TenDev Pages | `278165095eb000b69610f903424e951ce320acdb`; deployment `1dde420f-8072-4a5d-b4bd-6ad056ab8441`; https://tendev.pages.dev |
| TenOps Production Pages | `e71bd981a583e0a4e706f9953c6cc1fcc4d576e1`; deployment `eb191ab7-6e40-4275-b0a1-c616044b89a5`; https://tenops.pages.dev |
| Shared TenBot Edge | Version 43, ACTIVE, JWT verification ON; source SHA256 `eb54e9ce51a5b6febe27a141860af02e1db7c4478a479f13ac2f8e98d5006e8c` |
| Model-directed read origins | `https://tendev.pages.dev` only |
| Provider/write controls | Ordinary Terra spending OFF; existing metered Qwen ON; preparation and operational agent writes OFF |
| Migration application in this release | None. `20261102100000_tenbot_monthly_allowance.sql` remains absent from the hosted ledger per receipt. |

The release retains the existing Messaging frontend. It deploys accepted backend changes, including Job-identity parser corrections used by Production's legacy lane. **Unchanged Production Pages does not mean unchanged shared Production Edge bytes.** The exact selective source is retained at local ref `refs/tenops-releases/tendev/2026-11-02-conversational`.

The [November 1 Production receipt](2026-11-01-tenbot-consolidated-production-release.md) establishes shipped persistent owner-private history, Messaging navigation, canonical Job references and authorized Job reads: discovery/count/list, summary, saved planning/schedule and recorded labor. Knowledge guidance and deterministic fallback exist. These reads do not establish physical material sufficiency, staffing availability, remaining work or a delivery forecast. Operational agent writes are not available under the current disabled controls.

Actual signed-in TenDev review on November 2, **9:15–9:24 AM Chicago**, passed Job status and contextual labor follow-up through deterministic presentation. Combined schedule/labor, compound Production handoff and unfamiliar delivery-confidence requests failed: **2 of 5 checks passed**. Reload restored three completed/unavailable turns; two stopped questions were not retained as completed answers. The shared Qwen ledger increased by 23 measured steps (1,054.336 Neurons) during the window; exclusive session attribution is unestablished. **Terra calls: zero; new paid inference: $0.** No successful model-generated compound briefing was observed. Reliable AI-first acceptance failed; limited Production rollout is not ready. Terra reasoning remains untested here.

## Active workstreams and ownership

| Workstream | Owned boundary and current status |
| --- | --- |
| [Infrastructure & TenBot Simplification](2026-11-02-infrastructure-tenbot-simplification.md) | Conversational backend, Terra-first orchestration, spending architecture, shared migrations and TenDev preparation/release. Local `b5f7f66bfe924a2876834d0e698decf206eff9bb` and `2ed403b` accepted per release receipt; selective TenDev `27816509` deployed, conversational acceptance failed. Next: Product review and a separately authorized bounded Terra test. |
| TenBot Workspace & Feature Requests | Isolated frontend `5cb71fb52ffe784715b9ae5d8bb95a14ac6df395` on `feature/tenbot-global-workspace-20261102`, one commit atop `b5f7f66`; implemented/validated locally, pending Product review. Not integrated into `dev` or deployed at inspection. |
| TenDev — Project Memory & Context Continuity | This documentation/handoff pass only. Stage 1 accepted; this transfer is ready for Product review. Preserve other writers' files; no application ownership. |
| Next planned: Agentic Actions | Proposed future scope: Proposal drafts from screenshots/specifications; Pending Receivals from invoices; Admin-configurable execution permissions; user reauthentication for consequential actions; lightweight feature-request persistence. This prompt does not authorize implementation. Existing invoice/receival prototypes do not establish deployed write authority. |

Workspace source is in the existing `/private/tmp/tenops-tenbot-global-workspace` checkout. Its [branch-only receipt](/private/tmp/tenops-tenbot-global-workspace/docs/project-memory/2026-11-02-tenbot-global-workspace.md) can also be read without that checkout using `git show 5cb71fb:docs/project-memory/2026-11-02-tenbot-global-workspace.md`. Do not assume this file exists on root `dev`.

The workspace implements the global header launcher, desktop right panel, expanded workspace, mobile fullscreen and shared existing conversation/history/draft state. Legacy Messaging entry remains during transition. Its receipt reports type/lint/component/build/EM checks and ten synthetic browser workflow groups passing at `localhost:3100`; this is not Chris's manual `localhost:3000` or hosted acceptance. Feature-request UI/adapter contract exists, but the genuine gap signal, submission/persistence backend and daily reporting are **not connected**. The unavailable default adapter cannot claim saved success. The branch also changes Current State/execution-standard paragraphs, so integrate its owned delta selectively and reconcile shared documentation.

Root source was inspected on `dev` at `b5f7f66`, ahead 80/behind 14 cached `origin/dev`. The release owner then added documentation-only `f9ec952`; this handoff's own documentation commits also advance `dev` without changing runtime source. No fetch was performed; cached refs do not establish live remote state. Preserve unrelated dirty backend/evaluation/docs and existing worktrees/processes. A branch's presence alone does not establish an active workstream.

## Current Product direction supplied for this handoff

- TenBot should be an intelligent operational agent. **Terra is the preferred reasoning engine; Qwen is optional fallback**, not the primary tuning target. This is intended direction; current paid Terra availability and live acceptance remain gated as above.
- The model should interpret employee objectives and select existing authorized capabilities. Keep deterministic operations where fast and reliable; never intercept a compound objective with a partial keyword match or silently present partial coverage as success.
- Reuse TenOps authentication, RLS and business services for permission checks, validation and persistence. Consequential writes need appropriate authorization. Admin execution controls and user reauthentication are planned work requiring their scoped contract.
- Optimize for successful employee outcomes and development velocity. Avoid redundant agent-specific safeguards, inference-budget bureaucracy, new frameworks and repeated testing. This preference does not authorize bypassing current financial, privacy or write controls.
- The global header panel/workspace/mobile interface will replace Messaging as the primary TenBot entry point. Product direction is established; the isolated frontend candidate still needs acceptance/integration/release. Meaningful agentic functionality is the initial-release goal, beyond canned responses.
- Unsupported automation may offer an optional employee-submitted capability suggestion after useful help. Keep the interaction simple, transmit only explicitly reviewed fields, and provide a consolidated private Product report when practical and when new requests exist. Submission/persistence/reporting remain planned; ordinary questions, permission failures and temporary failures are not capability gaps. No automatic sharing of private transcripts.

ChatGPT provides Product/development advice and complete, copy-ready implementation prompts. Codex implements the authorized scope and supplies evidence. Use **prompt → iterate → approve → release**; resolve routine engineering choices without repeated permission cycles. Coordinate owners before parallel edits to shared source. Favor employee functionality over maintaining unnecessary development infrastructure.

## Outstanding decisions and immediate next steps

1. Product reviews the failed TenDev conversational acceptance. Define and separately authorize the smallest real Terra acceptance test; do not continue Qwen-specific tuning by inference from this handoff. The existing $0.25 per-request ceiling is a limit, not new spending authority.
2. A bounded hosted test can use the existing atomic meter without the monthly migration, but needs explicit finite funding and verified TenDev-only containment. The ordinary funding switch is shared. Separately, adopting the [monthly allowance](2026-11-02-tenbot-monthly-allowance.md) requires approved migration application and verified accounting cutover. Preserve the **$0.061139 hosted** and **$0.018723 local** uncertain holds without refund, reset, double import or invented settlement. The [local recovery appendix](2026-11-02-tenbot-limited-terra-evaluation.md#replacement-loaded-accounting-recovery-proposal--november-2-2026) records replacement loading only; authentication, accounting recovery and a fresh retry remain gated.
3. Coordinate workspace Product review at safe `http://localhost:3000`, then selective integration with the accepted backend. Inspect port ownership; do not replace another workstream's server. Real hosted conversation/reopen and frontend acceptance remain to be established for the combined candidate.
4. Before Agentic Actions implementation, issue a scoped Product Acceptance Contract: first operation, draft versus execution boundary, role/capability policy, reauthentication triggers and approval semantics. Reuse existing Proposal/receival services and historical snapshots. Define the minimal private request record/report contract; daily automation need not block the workspace.
5. After each accepted/released boundary, have the owning writer reconcile the shared memory files listed below. Production rollout requires successful acceptance and Chris's separate explicit approval; no whole-`dev` promotion.

[Backup/recovery](2026-11-02-supabase-backup-recovery.md) records verified database backup availability and locally implemented independent Storage export tooling. An independent Storage copy/recovery drill is not established by that tooling and was excluded from the TenDev release path. Preserve this distinction without making optional backup work a new conversational-release blocker.

## Shared memory reconciliation still needed

`docs/README.md`, `CURRENT_STATE.md`, `ENGINEERING_EXECUTION_STANDARD.md` and the limited-Terra record were dirty and already owned by active workstreams. They are untouched by this pass. Another writer added the November 2 release handoff to Current State/execution standard during this pass; preserve those additions. The manifest's overlapping TenBot area also needs owner coordination. Current supplied direction is captured here without overwriting their edits.

- **Current State opening:** replace the apparent current October 21 front matter with a dated workstream/release summary. Explicitly preserve and label the October observations and receipts as historical. Reconcile local `b5f7f66`, deployed TenDev `27816509`, Production Pages `e71bd981`, shared Edge43 and separate workspace `5cb71fb`.
- **Execution standard:** clarify the six status claims above and keep the compact active handoffs focused. Retain old receipts and supersession links; do not duplicate release history.
- **Manifest/index:** reconcile supplied Product direction and link the [technical inventory](../schemas/README.md). The July-only migration list, older anonymous/shared-password descriptions in [Forms and Documents](../architecture/FORMS_AND_DOCUMENTS.md), and old local-only TenBot summaries need narrow owner-reviewed supersession.
- **Evidence durability:** November 2 TenDev receipt/JSON retention is complete in the release owner's `f9ec952`; the workspace receipt remains branch-only with its candidate. This pass does not commit another writer's evidence. After releases, refresh identities, real Terra results, funding/migration/write settings, workspace integration and request-reporting state; retain the exact original evidence limits.

For future maintenance, update the owning scoped receipt first, then Current State's concise status/pointer, and the manifest only for enduring decisions. No new documentation tree, framework or evidence directory is needed.

## Engineering and release constraints to carry forward

Chris alone approves material Product/UX changes, migration application, Production data mutation, destructive operations, privacy/RBAC policy changes, pushing/releasing `main`, Production deployment and external announcements. Candidate acceptance is not release authority. Selectively promote only an approved boundary; preserve unrelated dirty work and stage explicit owned paths only.

Choose the smallest sufficient risk tier and test the changed behavior plus realistic blast radius. Reuse valid worker/verifier evidence; broaden checks only for a real dependency or risk. This continuity pass is Tier 1 documentation-only: factual/source review, link checks and diff checks, with no application build/test or hosted mutation. Manual candidate review uses the actual application at exact `http://localhost:3000` with safe functional data; synthetic tests and other ports retain their stated limits.

Migrations are narrow, append-only and forward-only. Verify target and actual objects/policies/grants/behavior; repository or ledger presence alone is insufficient. Never apply `20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql` wholesale. Further Bid/Sample lifecycle changes require the applicable Product contract; preserve later scoped accepted behavior. Keep credentials, private transcripts and raw operational evidence out of the handoff and Git.

## Copy-ready opening for the new advisory conversation

Read `docs/project-memory/2026-11-02-chatgpt-context-transfer.md` as the dated TenOps continuity handoff, then consult its authoritative repository links. Resume Product/development coordination using the supplied Product decisions; do not assume access to the retired advisory thread. Distinguish deployed TenDev/backend work, failed conversational acceptance, the separate local workspace candidate and planned Agentic Actions. Preserve active writers' ownership, prepare complete copy-ready scoped prompts, and request fresh evidence only where a decision needs it. This handoff itself authorizes no application, funding, migration, integration or release action.
