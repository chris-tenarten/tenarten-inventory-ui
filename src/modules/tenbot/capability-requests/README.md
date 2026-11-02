# Contextual capability suggestions

This folder owns presentation only. No classifier, hosted API, persistence,
report automation, or new authorization rule is implemented here.

`CapabilityRequestCard` renders only for an explicit `automation-gap` signal
whose producer confirms useful assistance has already been provided. It never
infers a missing automation from employee text, `suggestionAllowed`, ordinary
answers, permission errors, temporary failures, or information requests. Render
it after the useful answer/manual workflow. Key it by the owning account and gap
so dismissal and optional context remain private to that session.

The card shows the exact capability, original objective and identified existing
TenOps workflow before the employee chooses Yes or No. Optional context is the
only extra input. Nothing is submitted automatically; the transcript is excluded.
The default adapter is unavailable. The explicit synthetic presentation fixture
returns `preview`, never a persisted receipt or a fabricated success message.
There is no backlog/dashboard UI.

`CapabilityRequestProvider` is an optional account-scoped injection seam. Without
it, `CapabilityRequestSlot({ownerId, accessKey})` renders nothing. A slot accepts a
provider signal/adapter only when both the nonblank owner ID and access key match;
it never reads a different account's signal or one bound to previous access.
Use `JSON.stringify(auth.profile)` as the access key for both provider and slot.
The card key includes owner, access key and gap ID, resetting its private state
when any changes. A missing adapter stays unavailable. The conversation engine
and shared API response type do not change.

For explicit local Product/browser review only, a development build on the exact
`localhost` hostname with `?tenbotCapabilityPreview=1` renders the clearly labeled
synthetic fixture and useful example manual-workflow assistance. Production builds
and other hosts never select this preview. The fixture performs no API, model,
schedule or persistence action and can only show the unsaved preview result.

## Minimum integration contract

The backend owner must provide:

1. An authenticated, owner-bound capability-gap signal with an opaque gap ID,
   requested capability, original employee objective, optional existing TenOps
   feature/workflow, and confirmation that useful existing-workflow assistance
   has already been delivered. The server owns classification and exclusions.
2. A submit adapter accepting the reviewed capability/objective/workflow and
   optional context plus the bound gap ID, only after explicit Yes. Derive the
   requester and submission date from the authenticated server context. Keep the
   minimal private record; do not attach or retrieve the transcript. Recheck
   owner/access and deduplicate retries server-side. Return a real durable record
   ID before the UI can report success. Errors and ambiguous outcomes must not
   become a success, and No must make no persistence request.
3. A consolidated private daily report for Chris only on days containing new
   requests, preferably through existing Messaging/notifications. A manual report
   is acceptable until automation exists and does not block this frontend rollout.
   No daily empty report, reviewer dashboard, broad Admin transcript access, or
   employee notification is implied. Backend owns scheduling, identity, delivery
   and privacy enforcement.

The existing generic `submit/list/review` feedback API is not wired here. Its
`suggestionAllowed` flag is not a capability-gap classifier, and its listing gate
uses `manageUsers`; it cannot establish the requested private Chris delivery
contract. Integration may adapt existing storage/services when the backend owner
confirms those semantics, without changing this presentation interface.

Never put requester identity, bearer tokens, conversation history or request
drafts in local/session storage. The integration must keep a signal bound to its
original access key, rather than rebinding an old signal after access changes.
Parent conversation ownership must prevent stale adapter responses from being
shown to a different owner.
