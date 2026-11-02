# TenBot Workspace interactive actions — November 2, 2026

**Later integration boundary:** Chris accepted this Workspace at `262c25f` as an
input to the [focused root integration](2026-11-02-tenbot-workspace-integration.md).
That receipt supersedes the disconnected/local-port gaps below only for its
verified local candidate. The original source and synthetic validation claims
remain historical; no hosted rollout is implied.

**Status: implemented locally; pending Product review.** Chris's attached
**TENDEV — TENBOT WORKSPACE INTEGRATION & INTERACTIVE AGENT ACTIONS**
provisionally accepts Workspace `5cb71fb52ffe784715b9ae5d8bb95a14ac6df395` and
authorizes focused implementation, validation and an owned local commit. The
separate Advisory thread is unavailable. No shared-dev merge, push, migration,
deployment, hosted write activation, business write or inference occurred.

## Exact scope and ownership

Reused the existing clean worktree `/private/tmp/tenops-tenbot-global-workspace`
and branch `feature/tenbot-global-workspace-20261102`, starting at accepted
Workspace `5cb71fb`. No second worktree, rebuild of the assistant UI or new
framework was introduced. Root `dev` was observed at backend foundation
`665cbb3751c136e9872d22a48b68fe26fbeaa3aa`, with ongoing backend/session/migration
work and older unrelated dirty files. Those files, the shared index and active
port 3000 were not edited or staged by this pass.

Owned new runtime files are `src/modules/tenbot/actions/ActionReviewCard.tsx`,
`ActionWorkspaceBridge.tsx`, `contract.ts`, `adapter.ts`, `presentation-fixture.ts`
and the module README. Small integration changes affect `src/app/layout.tsx`,
`src/modules/tenbot/GlobalTenbotWorkspace.tsx`,
`src/modules/tenbot/TenbotWorkspace.tsx` and
`src/modules/my-work/InboxDialog.tsx`. New focused verification is
`scripts/verify-tenbot-action-adapter.mts` and
`scripts/support/tenbot-actions-browser.mjs`; the existing Workspace browser
verifier adds an `--actions-only` route reusing its established synthetic
Auth/history setup. Documentation/evidence and scoped memory additions belong
to this task. No backend, AuthProvider, RBAC, provider, spending, Job-tool or
migration source is modified.

The project instructions and current root technical inventory/context-transfer
documents were read. `docs/schemas/README.md` and the later backend completion
report do not exist on this older isolated branch. They were inspected on root
and via immutable Git source; they were not copied into another inventory or
overwritten. Backend integration should add the frontend pointer to its owning
technical index when reconciling this delta.

## Implemented employee behavior

The accepted global launcher, panel/expanded workspace, full-screen mobile,
Messaging entry, ordinary conversation/history and existing text drafts remain.
Both presentations now host the same interactive proposed-action component:

- Human-readable summary, read-only proposed fields/material details, effects
  and missing/blocking issues. Corrections return focus to ordinary conversation
  for a newly validated review; no local editing under an old reference.
- Exact-reference Proposal PDF request using existing `DocumentViewer`. Missing
  pricing remains unknown and does not invent a full document. Old object URLs
  are revoked on hide, expiry, reference changes and relevant access/session
  changes. Nested preview Escape leaves the assistant open.
- Existing-account password confirmation in a separate trusted action channel.
  Initial status must be verified; expired, blocked, cancelled, changed or
  unavailable actions cannot be confirmed. The uncontrolled password input is
  cleared before dispatch and on relevant lifecycle changes; it never enters
  chat, drafts, model requests, storage, analytics or diagnostics.
- Cancel and explicit status reconciliation. A rejected/uncertain response
  consumes cached confirmability and cannot cause automatic resubmission.
  An already dispatched confirmation is allowed to finish its guarded private
  Auth handoff even if its view closes; stale UI responses are ignored.
- Success requires a strict, operation/reference-bound committed receipt.
  Proposal draft success is distinct from issuance. Native actual-ID anchors
  reuse existing Proposal deep links even from an already open Proposal page.
  The observed Pending result has only queue navigation, clearly labeled
  **Open Pending Receivals**, with explicit zero on-hand Inventory impact.

Historical completed receipts stay read-only. The original unsaved summary is
not misleadingly repeated as current state after a committed result. Prepared
history never enables password or preview controls without a fresh status check.
The existing lightweight capability-request interaction and its disconnected
private-record/daily-report contract are unchanged; no dashboard was added.

## Contract and live integration boundary

The baseline is the actual accepted `665cbb3` `tenbot.actions.v1` contract,
including its trusted confirmation envelope with private refreshed session,
not only the illustrative naked receipt in the Product prompt. The frontend
projection is strict and covered against immutable baseline fixtures.
[The module contract](../../src/modules/tenbot/actions/README.md) documents the
adapter and integration seams.

The live adapter is **disconnected by default and has no enabled caller**.
Infrastructure must supply a verified, atomic expected-session installation
through existing Supabase Auth. A new password login changes `session_id`;
existing Auth correctly rechecks access and hides navigation during that check.
This pass does not weaken that behavior or install an unchecked SDK shortcut.
Valid completed, failed and uncertain responses hand off their verified fresh
session before business-receipt validation; malformed receipts never mean
success. Wrong outer reference, owner, AAL or concurrent session changes fail
closed. A lost response after login replacement can still require normal
sign-in and status recovery.

Infrastructure must reissue action publications for the new session after
authoritative status/history hydration. An old injected publication remains
hidden under strict session binding. The outer bridge retains no password,
token or private response and does not by itself provide reload discovery or
real post-reauth receipt recovery. These remain live integration dependencies.

While this pass ran, the backend owner added uncommitted canonical Pending
enforcement and persistent action history. Two bounded compatibility paths use
only shapes directly observed in that source:

1. `answer.actionStatuses`, at most one strict `ActionStatus`, is read only from
   existing persistent, verified history. It can show a committed read-only
   receipt even with mutation transport disconnected. No model-text parsing or
   replacement action protocol was invented.
2. Pending navigation requires the complete observed draft result, unique actual
   created IDs, explicit `onHandChangedByCreation:false` and exact
   `/inventory#pending-receivals`. It is a queue link, not an individual-record
   deep link. The accepted foundation blocks Pending execution; the fixture
   preserves that block. New canonical enforcement is not certified here.

Those additions are **provisional source compatibility, not acceptance of the
concurrent backend candidate**. [Exact source pins](evidence/2026-11-02-tenbot-interactive-actions/contract-source-pins.json)
distinguish accepted commit bytes from observed dirty bytes. Reconcile the final
backend candidate before connecting, including its database/concurrency gates,
session installation and history publication. No hosted behavior is inferred
from source or migration presence.

## Actual validation

Card presentation uses Tier 2 / Testing Level 2. Credential/session handling is
reviewed at Tier 3 with focused frontend contract, privacy and race checks; this
is not real Auth, database, RLS or transaction certification. [Validation summary](evidence/2026-11-02-tenbot-interactive-actions/validation.json):

- Fifteen focused adapter groups PASS: accepted-contract parity, unavailable
  default, owner/token/access races, operation/reference binding, blockers,
  safe links/PDF/no-store, error redaction, review-cache consumption and valid
  same-owner session handoff for all outcomes, including malformed receipts.
  Worker execution was reused; reviewers inspected it without repeating it.
- [Twelve actual-application action browser groups](evidence/2026-11-02-tenbot-interactive-actions/browser.json)
  PASS with synthetic Auth/history/action adapters at exact `localhost:3100`.
  Review, PDF surface, missing price, rejected/uncertain confirmation,
  cancel/expiry, hidden credential cleanup, Messaging reuse, mobile Back,
  synthetic same-owner session replacement and additive historical receipts were
  exercised. The preview explicitly says no authenticated record was created.
- [Ten adjacent Workspace browser groups](evidence/2026-11-02-tenbot-interactive-actions/workspace-regression.json)
  PASS on the final source after integration touched both conversation views.
  Draft/history/navigation/owner-switch/access-loss behavior is preserved.
- Full TypeScript, targeted ESLint, `git diff --check` and Production-mode
  Webpack build PASS; all 25 pages exported. Synthetic loopback build variables
  are not a deployable hosted configuration. Knowledge prebuild retained the
  existing snapshot unchanged.
- Independent focused Tier 3 source/security review PASS, including the additive
  history and Pending queue-link compatibility. No duplicate deterministic test
  campaign or hosted verification was claimed.

Zero page errors, unapproved outbound origins, hosted calls, provider calls,
auth writes or business writes. A native embedded PDF surface and valid exact
reference bytes were checked; headless Chromium does not establish visual
fidelity of its native PDF plugin or the real server-generated document. Manual
PDF/real-session acceptance remains with the coordinated functional review.
An initial harness clock installed after timer creation and retained test
history caused corrected test-setup failures; the [retained superseded checkpoint](evidence/2026-11-02-tenbot-interactive-actions/superseded-browser-checkpoint.json)
is not the final result. The malformed-fixture TypeScript cast was made explicit
without weakening assertions.

Selected sanitized views: [mobile confirmation](evidence/2026-11-02-tenbot-interactive-actions/actions-mobile.png),
[Pending review](evidence/2026-11-02-tenbot-interactive-actions/actions-pending.png)
and [historical receipt](evidence/2026-11-02-tenbot-interactive-actions/actions-history-receipt.png).
Only synthetic input was used. No real account password was entered.

## Handoff

Stop for Product review. This is a local, reviewable frontend candidate, not a
claim that employees can execute actions on TenDev. Do not merge shared `dev`,
push, deploy, apply migrations or enable hosted writes from this thread.

Port 3000 remains the active root checkout's PID83974. Internal checks used 3100
to preserve that work; the task-owned server is stopped at handoff. Chris's
actual `http://localhost:3000` manual review requires coordination with that
owner and a safe functional data source. Raw scratch/browser/build outputs and
the shared ignored node_modules symlink remain in the existing isolated
worktree; selected sanitized evidence is retained above.
