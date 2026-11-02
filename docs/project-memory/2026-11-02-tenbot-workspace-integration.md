# TenBot Workspace and agentic actions — local integration, November 2, 2026

**Implemented locally; Product review pending. No staging or release performed.**

Chris's attached **TENDEV — INTEGRATE AGENTIC ACTIONS & TENBOT WORKSPACE**
accepts backend `afa4bfa47319f5a74101e202a1b675ecf471a1b3` and Workspace
`262c25f714592edfa8834053b8c1f76112bbc37a` as integration inputs. This pass is
Tier 3 / Testing Level 3 because it crosses authentication, private history and
canonical persistence boundaries. The supplied current Product contract governs;
the separate Advisory conversation is unavailable. Authority covers focused
local integration, existing isolated-fixture operations, proportionate validation
and one scoped local commit. It does not cover push, migration application,
deployment, shared operational writes, paid inference or new provider funding.

## Source and ownership

Integration uses root `dev` at `/Users/chrisngo/source/repos/tenarten-inventory-ui`,
starting at accepted backend `afa4bfa`. The resulting commit is the local commit
containing this receipt; its exact SHA is supplied in the completion response.
No branch merge or wholesale promotion of `dev` occurred. Forty explicit paths
were selected from the Workspace delta `b5f7f66..262c25f` (Workspace commits
`5cb71fb` and `262c25f`): global launcher/panel/mobile, shared conversation/draft,
Messaging transition, action/capability-request presentation, focused verifiers
and their dated evidence. The patch applied without conflicts. The separate
Workspace checkout remains at its accepted commit and is unchanged.

Task-owned glue affects existing `AuthProvider`/Supabase storage, the shared
conversation controller and action bridge/adapter/contract. Focused corrections
affect the Proposal preparation default and global overlay stacking. New local
review scripts are operator-only, not application or deployed Edge imports.

Eight preexisting dirty paths were preserved byte-for-byte and excluded from
the commit: documentation index, Current State, execution standard, limited Terra
receipt, scoped-budget support/verifier, generic agent verifier, and
`supabase/functions/_shared/tenbot-agent.ts`. The latter's unrelated removal of
an authorization call is not part of this candidate. The review loader and
isolated build explicitly pin that module to accepted `afa4bfa`, while using
current integrated source elsewhere. Task provenance, selected patch and initial
hashes remain in `/private/tmp/tenops-workspace-integration-20261102`.
Concurrent memory/Workspace work, historical evidence and other worktrees were
not cleaned, staged or rewritten. The dirty execution standard/Current State
remain with their existing owner; this scoped receipt supplies the handoff.

## Connected employee behavior

The existing global header launcher, right panel, expanded workspace and mobile
fullscreen reuse the accepted conversation/history/draft controller. Messaging
retains its TenBot entry and ordinary DM/group paths. No new conversation store,
agent framework, model tools or employee-question router was introduced.

Trusted cards render only from verified ordinary ask/history `actionStatuses`.
The frontend does not parse model prose to authorize actions or infer success.
Corrections send the exact server reference as `supersedes`; document selection
reuses the existing private original upload service and sends `documentIds`.
New OCR/extraction is not added: an unfamiliar newly uploaded document can lack
the required attested text. The local Pending scenario uses the exact existing
attested synthetic original. Optional capability-request persistence/reporting
remains disconnected as accepted.

The adapter requires explicit `NEXT_PUBLIC_TENBOT_ACTIONS_ENABLED=true` plus
exact TenDev hostname, or explicit localhost with a matching loopback project
and review endpoint. Production/default builds remain disconnected. Server and
database controls remain independent. Proposal receipts mean saved drafts,
not issuance. Pending receipts mean queued receivals, not Inventory receipt.
Full canonical operation results are validated before completion or navigation.

## Authentication and action integrity

Confirmation uses the existing account password through the trusted backend
action channel and actual Supabase Auth. Passwords are uncontrolled ephemeral
DOM inputs, cleared before submission and on lifecycle changes. They do not
enter ordinary chat/model requests, drafts, browser storage, history or logs.
No separate assistant password, role or permission is created.

The same SDK storage performs a one-use synchronous compare-and-set at the
session write. Original owner/token/access generation, actual stored session,
incoming owner and exact target JWT must match. Expired-target rotation and
refresh-error cleanup cannot overwrite or remove a newer login. Normal logout
remains token-bound. Normal SIGNED_IN invalidates and rechecks account access;
the old permission decision is never carried forward. A visible global panel
restores after that same new session is verified. No private confirmation
response or token is retained by the action bridge.

Fresh status precedes confirmation; references bind revision/hash/expiry.
Cancel/confirm consume cached confirmability. Durable status/history, rather
than optimistic UI, recovers completed or failed outcomes without replaying
business writes. A lost private Auth response may still require ordinary
sign-in and explicit status recovery. Independent source/security review passed
after both session-overwrite and implicit-deletion safeguards were corrected.

## Demonstrated corrections

1. The first actual browser save reached real password authorization but failed
   canonical SQLSTATE `23502`: disabled tax had a null rate. Proposal preparation
   now uses the existing disabled-tax rate `'0'`, visible in the review. Unknown
   customer line prices remain null. The failed action stayed failed/consumed;
   it was reconciled, not blindly retried. No schema change was made.
2. The existing Proposal panel at z-index 120 intercepted Workspace Send at 115.
   Global panel/expanded/mobile layers now use 136, above Proposal/Estimating
   and below the existing DocumentViewer. No forced clicks or modal redesign.
3. Same-owner password login correctly remounts the access-gated header. The
   bridge now restores an already-visible global panel only after authoritative
   access/history recovery for that exact new session.

Automation-only races (launcher toggle during reappearance and an assertion on
the wrong Proposal tab) were corrected in the verifier. Successful canonical
receipts were retained and resumed without retrying their action. One bounded
fresh Proposal review was already running before resume support was added;
its separate committed record is retained and disclosed in browser evidence.

## Validation and actual local review

Focused validation, not a repeat of the accepted full campaigns:

- Action adapter: 16 groups pass, including immutable `afa4bfa` parity,
  malformed canonical receipts, reference/owner/session races and safe results.
- Auth storage: six groups pass using the installed Supabase SDK and in-process
  Auth HTTP doubles. Deferred getUser, expired-target refresh and refresh-401
  cleanup leave newer account/session B untouched and emit no stale Auth event.
  The SDK's expired-target refresh failure also rejects an internal Deferred;
  the verifier explicitly observes that safe rejection rather than calling it
  a successful handoff. These race tests are not real hosted Auth certification.
- Proposal operations: 19 groups pass, including the disabled-tax regression.
- Full project TypeScript, targeted ESLint (including explicit backend file
  lint), diff whitespace and development-branding structural checks pass.
- Isolated Production Webpack build passes, 25/25 pages. Runtime/config hashes
  stayed frozen. TenDev title/manifest verified; packaged knowledge integrity
  checks pass with the existing snapshot unchanged. Build uses synthetic
  loopback public configuration, not deployable credentials.
- Accepted backend 36 continuation offline and 12 real isolated database groups, plus
  Workspace 12 action and 10 adjacent browser groups, are reused at their
  recorded boundaries. No broad repeated security/regression campaign.

The actual application runs at **http://localhost:3000/proposals**. Before
replacement, port 3000 was verified as the obsolete root static export server
PID 83974, with old output and no active connections; only that process was
stopped. The new Next dev server belongs to this task. The loopback bridge at
55598 uses only existing isolated Supabase `jltgxcfiprocydhbrahz`, never shared
TenOps. It calls the real hosted constructor, ordinary discovery/tools,
owner-private history/Storage, trusted password action transport and canonical
services. The provider transport is explicitly scripted: **zero model calls,
zero real tokens, zero paid charges/reservations**. Actual provider selection,
natural-language quality and hosted integrated employee acceptance are not
established by this pass.

The [browser checkpoints](evidence/2026-11-02-tenbot-workspace-integration/browser.json),
[read-only database reconciliation](evidence/2026-11-02-tenbot-workspace-integration/invariants.json),
[focused validation](evidence/2026-11-02-tenbot-workspace-integration/validation.json)
and [build receipt](evidence/2026-11-02-tenbot-workspace-integration/build.json)
distinguish real execution from scripted planning. Actual outcomes:

- Proposal `672adc49-7976-46a6-92b3-d88124307c31`: exact review/PDF, rejected
  wrong password, explicit status recovery, correct existing-account password,
  a different real SDK session, committed receipt, actual library/deep link and
  persistent receipt after reload. Draft total $25, no Job, not issued.
- Earlier distinct Proposal `523b2402-59f5-4b0c-a012-07486bb5ef41`: same $25/no-Job
  draft, retained after the bounded harness rerun. No same-action execution was
  replayed. Failed tax action `012e2eaa-0a0e-4ad6-bdf3-08318b44ed83` created no
  record and remains failed/consumed.
- Expanded Workspace and Messaging share the same draft. Real cancellation
  reaches durable revoked status; an ordinary correction creates an immutable
  replacement reference at revision 2.
- Pending `733564a4-b4e0-48f7-96c0-b1ff578ed8c0`, action
  `7dbb272d-d6f5-4192-9574-3d8dc51457ee`: ordinary paperclip dedupes the exact
  attested original, real hosted discovery invokes document/catalog/preparation
  adapters, correct password commits one canonical result. Mobile displays the
  completed receipt, reload performs zero confirm calls, and its queue link
  opens the actual expanded canonical row with the separate Receive button.
  Expected two Bags, received zero; Receive was not clicked.
- Final 19:23:41Z readback: one Pending private dispatch, one canonical execution
  audit and one document claim; original retained; execution Auth session live
  and distinct from the preparation session. Stock fingerprint remains
  `fd40258c7ba30c10250877be0e68bf93`, Inventory transactions zero, profiles,
  capabilities and Proposal allowlist unchanged, fault triggers zero.

Initial browser sign-in is a genuine fixture Auth session installed
in standard SDK storage; password confirmation and session replacement then run
through the actual UI/SDK. This is a real synthetic account, not an impersonated
TenOps employee. Native PDF surface plus exact server-generated bytes establish
generation/transport; headless Chromium does not establish native-plugin visual
fidelity. The fixture lacks `work_task_attachments`, so full My Work library and
live Messaging Realtime are not newly certified. No fixture DDL or fake table
response was added. Accepted adjacent Messaging evidence is reused.

The existing fixture conversation lacked its companion agent-history row. The
harness inserted only that missing empty canonical row, retained existing turns
and recorded the bootstrap separately. No schema, grant or permission reset was
needed. Synthetic business records and immutable action receipts are retained.

Manual review: choose Proposal or Pending at **http://localhost:55598/review**,
then use the exact displayed question in TenBot at localhost:3000. Pending must
attach that page's identical synthetic PDF. Sign in and confirm using only the
existing synthetic account in owner-only
`/private/tmp/tenops-tenbot-integrated-review-20261102/review-login.private.json`.
Do not use a real TenOps password in the fixture. The guide is in that directory.
The isolated execution window expires **2026-11-02 20:11:18 UTC (14:11:18 CST)**;
the bridge restores baseline OFF controls on expiry/shutdown. Restarting the
owned review entry with an explicit finite isolated-execution option is needed
for a later write review. Normal SDK Auth storage is the only credential store.

Only targeted headless Playwright and local images were used in this pass;
no macOS desktop/screen-capture session was started. An earlier workstream's
unverified capture teardown remains unverified; this pass did not access that
context or claim to have released it.

## Hosted state and exact proposed staging boundary — not executed

No push, Pages/Edge deployment, shared migration/configuration change, Production
operational write, role change, paid inference or accounting reset occurred.
Last accepted Pages boundaries remain TenDev
`278165095eb000b69610f903424e951ce320acdb` / deployment
`1dde420f-8072-4a5d-b4bd-6ad056ab8441`, and TenOps Production
`e71bd981a583e0a4e706f9953c6cc1fcc4d576e1` / deployment
`eb191ab7-6e40-4275-b0a1-c616044b89a5`. Shared Edge49 ACTIVE/JWT ON and
source `da0da6e8599c52e56329b2cb827a3bcd7a5f667a` remain the retained backend
receipt. The 18:30:36Z shared check records ordinary spending, preparation,
pilot and execution OFF, new action flag absent/default OFF, and no action
objects/migrations below. This pass does not claim fresh hosted attestation.
The earlier 18:32Z Pages metadata refresh failed HTTP401; do not silently infer
served SHAs from public HTTP200 titles or local source. Credentials were not
refreshed. Historical holds, including $0.018723, remain untouched.

If Product authorizes staging, prepare an exact selective candidate from
TenDev `27816509` and deployed Edge source `da0da6e8`, containing only accepted
`665cbb3`/`afa4bfa` backend paths, `5cb71fb`/`262c25f` Workspace paths and this
integration delta. Do not deploy root `dev` wholesale: exclude unrelated
knowledge, Inventory and canary work. Reverify exact deployment metadata,
release proof, served assets, origin/CORS and environment branding using existing
release procedures. Production Pages stays unchanged.

Required existing migrations, **disabled first**, in dependency order:

1. `20261102120000_tenbot_reviewed_actions.sql`
2. `20261102130000_tenbot_action_canonical_receivals.sql`
3. `20261102140000_tenbot_operation_history.sql`
4. `20261102150000_tenbot_canary_deferred_record_boundary.sql`

They are applied only in the preexisting isolated fixture, not shared Supabase.
Monthly allowance `20261102100000` is already shared-applied; do not reapply it.
Preflight existing Auth/history/Proposal/invoice signatures and grants. Migration
150000 requires predecessor function-body MD5
`1a33c77b396cd951f390239a157541b4`, preserving owner/ACL/configuration. Its
shared legacy deferred guard is a real shared-backend blast radius. Reuse the
accepted compatibility/database evidence and inspect the exact predecessor.
Migrations remain forward-only; no down migration or reset is proposed.

Stage a matched Edge bundle with JWT verification ON and TenDev Pages with
existing TenDev branding plus `NEXT_PUBLIC_TENBOT_ACTIONS_ENABLED=true`.
Existing server credentials/PDF services suffice; no new secret is inherently
required. Separately approve activation of both
`TENBOT_REVIEWED_OPERATIONS_ENABLED` and `TENBOT_REVIEWED_ACTIONS_ENABLED`,
database Proposal/receival controls, and the existing finite Pending
pilot/execution/employee/enrollment/permit gates. Exact TenDev origin,
hosted/model-directed mode, verified session and persistent history remain
required. No gate implies ordinary Production spending or stock receipt.

Smallest subsequent true model/employee acceptance: two bounded preparation
objectives (Proposal and Pending), existing attested original, real employee
review/PDF/password/session handoff, actual IDs/library links and reload/status,
one cancellation/revision and Messaging/account-isolation smoke. Recommend a
**separately authorized finite maximum $0.50 total, $0.25/request**, conservatively
inside existing overall allowance/holds. No expired evaluation window is renewed
by this receipt. Do not expand the registry, add question handlers or new OCR.

Disablement turns both Edge gates and database action controls OFF plus existing
Pending execution/pilot gates, lets permits expire and retains receipts/holds.
Rollback uses only matched compatible Pages/Edge artifacts; append-only database
history is preserved. This plan is reviewable scope, not release authorization.

Recommendation: accept the integrated local candidate and decide whether to
authorize selective, disabled-first TenDev staging. Actual hosted Terra/action
employee acceptance remains required before Production consideration. Stop for
Product review; no automatic further implementation pass or deployment.
