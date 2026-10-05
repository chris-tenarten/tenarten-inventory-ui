# Read-only TenOps with Messaging participation — local candidate

Date: 2026-10-05. Base: `4c81212` on `dev`. Status: local candidate only; no hosted migration, account assignment, push, deployment, or release.

## Permission contract

Visibility continues to come from the existing role, active membership, separate visibility grants, and participant policies. The accounting/support assignment is **Guest + Read-only outside Messaging + Allow Messaging write**. Neither flag grants financial visibility or Intake financial access.

| Account | Business writes | Messaging participation |
| --- | --- | --- |
| Restricted Guest, Messaging assignment enabled | Denied | Send/reply, edit own messages, attachments, transfer recovery/cancellation, typing; existing ownership rules still apply |
| Restricted Guest, Messaging assignment disabled | Denied | Read accessible conversations; no send/edit/upload/typing publish |
| Unrestricted Guest/Member/Lead/Developer/Admin | Existing role/action permissions | Existing participation preserved |
| Inactive or unauthenticated | Denied | No participation |

The original Guest bundle was not a complete read-only boundary: some business RPCs use `readOperationalData` to authorize mutations, and Messaging historically permits any active account. The new restriction is explicit rather than silently changing every existing Guest. Restricted assignment is limited to Guest; no custom roles or identity-based authorization were introduced.

Reading can still mark received messages and the account's own notifications read. Messaging can generate its normal recipient notifications. These exceptions cannot mutate business records. Persisted account settings and business configuration are denied.

## Implementation

- `app_users.read_only` and `app_users.messaging_write` default to false; `messaging.write` is evaluated through the existing `has_app_capability` boundary. The UI evaluates the equivalent account permission contract.
- `writeBusinessData` is an additional restriction gate, **not** a replacement for action capabilities or row ownership. Unrestricted roles retain their prior gates and policies.
- Shared business controls disable record editing/actions across the business modules. Timeline mouse/keyboard scheduling is blocked while record inspection remains available. Proposal hydration does not create missing Estimate data for a restricted reader.
- The new forward-only migration adds statement guards and restrictive write policies to existing public business tables. This also blocks legacy `SECURITY DEFINER` RPC writes and zero-row mutation attempts. Messaging content/attachments/history retain existing participant checks and additionally require `messaging.write`; content RPC entry guards cover no-op/transfer operations.
- Storage objects require the corresponding Messaging or business write gate; bucket configuration remains a business operation. Realtime publishing requires Messaging write while receiving retains participant authorization.
- Sample/Proposal PDF services deny generate/delete before using service credentials. Next write requests and shared Edge authorization require authenticated capability checks, including in compatibility configurations. Removing the bearer token does not reopen business writes.
- The first-Admin bootstrap and final-active-Admin safeguard remain intact. New Admin assignment is atomic and cannot be self-granted by a restricted user.
- Existing applied migrations, financial visibility functions, canonical Job semantics, calculations, and document snapshot semantics were not edited. The superseded wholesale RBAC migration was not used.

The table guards cover tables present when this migration runs. Later business tables need equivalent guards/policies; new Messaging tables need explicit classification and participant boundaries. This is not a database event-trigger framework.

## Admin assignment workflow

At `/settings#admin`, an Admin selects Guest, checks **Read-only outside Messaging**, checks **Allow Messaging write**, leaves Active enabled, and saves. The invitation form can provision the same combination. No specific person's UUID/email appears in authorization code.

Uncheck Allow Messaging write to revoke participation while retaining read-only access. The database enforces changes on the next request; an already open target session refreshes its UI permission snapshot on reload or sign-in. The old Admin access RPC preserves restriction fields; the new RPC updates role/restriction/Messaging choices together.

## Verification and evidence

**Tier 3 / Testing Level 3**, because this changes capabilities, RLS/Storage/Realtime boundaries, privileged service paths, and persistence authorization. Focused checks only:

- `scripts/verify-read-only-messaging.mjs`: actual isolated Supabase JWT/PostgREST/RPC/RLS/Storage; permitted reads; business table and business Storage denials; actual My Work creation denial; representative legacy read-capability RPC denial; Messaging send/reply/edit/receipts/attachment lifecycle; unrelated conversation and attachment access denial; ordinary roles; atomic assignment/revocation; independent Proposal visibility; anonymous bypass denial; first/last Admin safeguards; installed business-table guard coverage.
- `scripts/verify-read-only-messaging-browser.mjs`: actual TenOps at exactly `http://localhost:3000`, no API mocks; restricted My Work controls; normal Member task creation; Messaging send/reply/attachment; reader composer disabled; actual Admin Edge/UI assignment and revocation; Admin unavailable to the reader; functional read-only Phase Library; direct Next and Sample/Proposal Edge write denials; successful read-only PDF preview; no browser exceptions or hosted Supabase requests.
- TypeScript, targeted ESLint, `git diff --check`, and Production build.

Sanitized results are in [the evidence directory](evidence/2026-10-05-read-only-messaging/). The business fixtures intentionally have permissive legacy policies so the new guards must deny writes independently. The task and Messaging fixtures use actual repository migrations, including the Messaging V1.1 prerequisite checks. This is not a claim that every business module's complete hosted schema was reproduced or that hosted authorization was verified. TenOps currently has one application membership scope rather than a separate tenant-ID model; existing account/participant isolation was exercised.

## Local review

Open **http://localhost:3000/my-work** for the restricted account and **http://localhost:3000/settings#admin** for assignment review. The running app uses only the disposable local Supabase project on port 55481.

Local-only accounts: `permission-support@example.invalid` (restriction + Messaging), `permission-reader@example.invalid` (restriction only), `permission-member@example.invalid`, and `permission-admin@example.invalid`. Password for these local fixtures: `Local-permission-review-2026!`. These credentials are not hosted accounts.

For a fresh local reproduction:

```sh
node scripts/start-read-only-messaging-review.mjs --prepare
npx --yes supabase@2.110.0 start --workdir .tmp-permission-supabase
node scripts/verify-read-only-messaging.mjs --reset-local-fixture
npx --yes supabase@2.110.0 functions serve --workdir .tmp-permission-supabase --env-file .tmp-permission-review/edge.env
# In a second terminal, after inspecting localhost:3000 ownership:
node scripts/start-read-only-messaging-review.mjs
node scripts/verify-read-only-messaging-browser.mjs
```

The reset option affects only this explicitly named disposable local project. Review artifacts, local sessions, and the PDF preview remain under ignored `.tmp-permission-review/` paths.

## Release boundary

No release is authorized. A future rollout needs Chris's approval, narrow hosted schema/capability preflight, the new migration before the candidate UI/Edge functions, and coordinated updates to the changed services. Hosted role assignment is a separate approved action through Admin after review. Promote the candidate delta selectively; do not merge the unrelated `dev` history wholesale.
