# Reviewed action presentation

Frontend owner of `tenbot.actions.v1` review, preview, status, cancel,
confirmation and receipt UI. The accepted wire baseline is backend commit
`afa4bfa47319f5a74101e202a1b675ecf471a1b3`; inspect its
`supabase/functions/_shared/tenbot-actions.ts`, `tenbot-action-auth.ts` and
`tenbot-action-transport.ts` with `git show`. No backend files are copied or
enabled by this module. See the [integration receipt](../../../../docs/project-memory/2026-11-02-tenbot-workspace-integration.md)
for the local connection and its verification boundaries.

## Connection and current boundary

`ActionWorkspaceProvider` accepts a trusted `ActionPublication` containing the
authenticated owner, current access fingerprint, opaque session discriminator,
strictly parsed cards and an `ActionAdapter`. Publication is separate from chat;
the frontend does not invent an ask/history response field or parse model text
as instructions. The default is disconnected. `ActionWorkspaceBridge` lives
outside the header's transient account-access gate without keying/remounting the
application shell. It never stores a password, token or private confirmation
response. A publication with mismatched owner, access or session is hidden.

`createTrustedActionAdapter` is disabled unless Infrastructure explicitly enables
it and provides the existing TenOps function URL plus a trusted Auth interface:

- Read the current owner/token/access snapshot inside the trusted adapter.
- Verify the fresh session owner using Auth.
- Install the fresh session atomically only if the expected original snapshot
  still owns the session. Use existing Supabase Auth storage; do not add another
  credential store or change `AuthProvider` continuation semantics.

The integrated `AuthProvider` uses guarded normal SDK storage for `setSession`.
The new password login has a different `session_id`; existing Auth rechecks
access and temporarily hides the header. Authoritative status/history hydration
reissues the same-owner action against the newly verified session. Strict session
matching means an old injected publication does **not** automatically become
valid for the new login. Reload/card discovery also belongs to backend history
integration, not local storage.

The trusted response contains `{contract,reference,status,receipt,session,
recovery,error?}`. All valid completed, failed and uncertain responses install
the verified refreshed session. A malformed business receipt cannot become a
success; a valid outer-bound fresh session is still handed off first to avoid
stranding a single-session account. Bad owner, outer reference, AAL or concurrent
session changes fail closed. A network failure after Auth minted a login may
require ordinary sign-in and status reconciliation. No frontend retry can
manufacture that missing private response.

## Card behavior and credential handling

Fields are read-only under their server-issued reference. A correction is an
ordinary employee request for a newly validated review, not a local edit under
the old hash. Initial cards must pass a fresh status check before password or
preview controls activate. Blocking issues, disabled confirmation, changed,
revoked or expired actions cannot be confirmed. Status checks consume stale
cached confirmability; confirm/cancel consume it before dispatch. Failed or
uncertain results require an explicit status check, never automatic resubmission.

`ActionInteractionProvider` supplies visibility separately for global Workspace
and Messaging. Hiding either presentation unmounts credential UI. Passwords are
uncontrolled DOM input values and are cleared before submission and on close,
cancel, expiry, blur/hidden state and owner/access/session/reference changes.
They never enter conversation, drafts, storage, analytics or logs. A confirmation
already dispatched remains alive when its UI closes so a valid private session
handoff can finish; stale UI generations cannot display it to a different owner.

PDFs use the existing `DocumentViewer` with an exact-reference server preview
request. The adapter requires `application/pdf`, `Cache-Control: no-store`, a
bounded valid PDF signature and the same current session. Object URLs and old
previews are revoked on relevant visibility, reference or expiry changes.
Unknown pricing is shown as missing and cannot produce an invented full PDF.

Only a strict, operation/reference-bound committed receipt establishes success.
Proposal receipts distinguish a saved draft from issuance. Safe actual-ID links
use native navigation so existing mount-time Proposal deep links also work when
the current page is already `/proposals`. Existing page-hide draft flushing and
server history restoration are reused.

## Accepted backend compatibility

The accepted backend provides two additive fields alongside the original wire
contract:

1. Reauthorized persistent `answer.actionStatuses` contains at most one
   `ActionStatus`. `ConversationActionReviews` reads it only when existing
   history is persistent and `verified`. A validated historical completed
   receipt can display read-only with its safe link even while the mutation
   adapter is disconnected. Initial prepared/authorized history never enables
   credentials or preview by itself. Missing fields preserve existing behavior.
2. The proposed Pending receipt includes `draftId`, `hash`, unique created record
   IDs, catalog records, execution time/idempotency, explicit
   `onHandChangedByCreation:false` and exact `/inventory#pending-receivals`.
   Navigation appears only after those fields validate, labeled **Open Pending
   Receivals**. This is the existing queue view, not a new per-record deep link.
   Backend `afa4bfa` binds execution to the canonical Pending service; rendering
   this result neither enables its independent gates nor receives stock.

No migration, hosted activation, provider call or write is implied by this
presentation contract. The earlier Workspace receipt retains its original
provisional findings; the integration receipt supersedes those local gaps.

## Explicit local fixture

In development on exact hostname `localhost`, use
`?tenbotActionsPreview=1`; optional `tenbotActionCase=pending|incomplete|expired`
selects a synthetic case. The fixture uses in-memory review/status only and is
always labeled as a preview. Use synthetic test text, never a real password.
No authentication or business persistence occurs. A simulated receipt says no
authenticated record was created and offers no fake created-record link.
Production query activation is disabled.

Focused checks: `scripts/verify-tenbot-action-adapter.mts` and the existing
`scripts/verify-tenbot-global-workspace-browser.mjs --actions-only`. The browser
flag reuses established synthetic Auth/history fixtures and adds action checks;
it does not reach the trusted live transport. Existing capability-request UI and
its separate minimal private-record/report contract remain unchanged.


## Integrated candidate continuation

The accepted Workspace `262c25f` and backend `afa4bfa` are selectively combined in root `dev` for Product review. `ActionWorkspaceBridge` supplies the live adapter only when `NEXT_PUBLIC_TENBOT_ACTIONS_ENABLED=true` and the host is exactly `tendev.pages.dev`, or explicit `localhost` with the project and review endpoint sharing a loopback origin. Production/default builds remain disconnected. The normal controller reads verified `actionStatuses` from ordinary ask/history; no raw model calls or second conversation store is used.

The existing Auth SDK installs a verified same-owner session through guarded normal Auth storage: owner/token/access-generation and the currently stored session are checked synchronously at the SDK save. Rotated/expired-target saves and implicit refresh-error deletion cannot overwrite/delete a newer login; explicit normal sign-out stays token-bound. Normal SIGNED_IN handling still invalidates/rechecks account access. The visible global panel restores only after that same new session is authorized; credentials remain ephemeral.

Corrections select an exact server reference for `ask.supersedes`. Ordinary attachment controls reuse owner-private original upload/download and send `ask.documentIds`; unavailable new-document text remains unavailable because no new OCR/provider path is enabled. Canonical Proposal/Pending result fields are validated before completion or navigation, not only when displaying a link.

The local review harness is explicitly scripted for preparation, with real isolated Auth, private history/Storage, canonical actions and unchanged Proposal PDF rendering. It is not Terra reasoning or a deployed feature. See the scoped integration receipt for actual source/runtime/evidence and staging boundaries.
