# Messaging groups and replies — local candidate

Baseline `daa7932`; implemented in the existing checkout on `dev`. Product acceptance is pending. No push, main promotion, hosted migration, deployment, live notification dispatch, Auth account creation, or Production authentication change was performed.

## Accepted scope and behavior

Chris approved creator-managed groups: the creator renames and adds/removes participants; current members share the entire history; removed members lose access, including their own earlier group messages and attachments. Groups require a name (1–80 characters), the creator, and at least one other participant; maximum 30 participants. The creator remains a member. There is no separate administration or threaded-message system.

Groups reuse `my_work_messages`, attachment metadata/private bucket, resumable transfer/finalization/recovery, conversation pages, Inbox layouts and notification infrastructure. Direct and system conversations retain their identities. Group read receipts are per user and per observed message; newly added members can read all historical messages. Existing read receipts survive removal/rejoin.

Replies reference one original in the same DM or group. The server resolves a bounded quote from the current authorized original; edited originals show current text. Permanent deletion clears the FK and keeps an `is_reply` tombstone so no deleted text remains quoted. Tapping a quote validates the original and loads intervening history through the serial pagination stream, then focuses the original. Unsent reply selection is transient; sent references persist in PostgreSQL across reloads/devices. Existing account/conversation-scoped text drafts remain in place.

## Files and security boundary

- Modified: `InboxDialog.tsx`, `inbox.ts`, `GlobalMessaging.tsx`, and existing Messaging awareness, conversation and transfer helpers.
- Modified: Web Push worker payload formatter and its focused verifier.
- New: `supabase/migrations/20261022120000_messaging_groups_replies.sql`.
- New: group/reply PostgreSQL verifier, browser verifier, loopback review fixture, start/open review helpers and this evidence packet.

The migration adds group/membership/receipt tables, destination/reply columns and indexes; extends participant RLS over messages, versions, attachment metadata, previews and private Storage object reads; closes legacy security-definer read paths to group content; preserves Admin cleanup authority without granting routine content reads; and records the group UUID in deletion audit. Group creation/management/sending require `messaging.write`. Nonmembers and inactive users cannot read group content. Group mutation/sending locks serialize membership changes with sending. The server rejects inaccessible, draft and cross-conversation reply originals.

Private personal Realtime topics carry IDs only and trigger authoritative reads. Group content is not broadcast. Group streams do not reuse warm history caches; group intent prefetch is disabled. Owner-only receipts invalidate badges across devices. Membership changes invalidate current and removed participants. No client is granted personal-topic publishing authority.

Group notifications use the existing `inbox_message` type, outbox, subscriptions, rollout controls and dispatcher. Source lookup revalidates current membership and unread state before sending; notification entry revalidates access even after a message is read. Existing generic-preview settings remain respected. The group UUID is the conversation destination in the existing Inbox-open contract.

## Migration and release requirements

The forward migration was applied and exercised only in disposable local PostgreSQL databases, which the verifier removed afterward. It has **not** been applied or verified hosted. Existing DM data is not backfilled or rewritten. Existing pre-upgrade DM attachment manifests remain resumable through the V12 reservation path. Existing applied migrations were not edited.

Before any authorized release: verify the installed predecessor objects/policies/functions narrowly, review/apply the new migration under separate approval, deploy the updated `send-web-push` worker under separate approval, and release the matching client through the approved workflow. Keep dispatcher/rollout settings unchanged. Verify real Realtime authorization, Storage signing/delivery and a controlled physical iPhone notification after separate authorization. The new client requires the V12 RPC migration; do not release the client alone.

## Validation and actual limits

Tier 3 / Testing Level 3 because this changes privacy, persistence and notification source contracts.

Passed:

- `node scripts/verify-messaging-groups-db.mjs`: actual PostgreSQL migration, authenticated-role RLS, members/outsiders/unrelated Admins/inactive users, creator management, DM/group replies, invalid reply scope, unread receipts, system-message reads, attachment metadata/publication/Storage SELECT policies/recovery, removal/rejoin, push source and destination suppression after removal, Admin deletion audit/tombstone, and read-only Messaging permission guards. Uses synthetic `app_users` rows and JWT claims, never Auth login accounts.
- `node scripts/verify-messaging-groups-browser.mjs`: actual production-export application at exact `http://localhost:3000`, desktop 1440px and mobile 390px. DM and group replies, deleted-original fallback, group creation/rename/participant removal, shared attachment send through local TUS fixture, reload persistence, and original navigation beyond the latest 40 messages across an 85-message fixture. No page errors, viewport overflow or external HTTP requests.
- `node scripts/verify-web-push-worker.mjs`: existing transport regressions plus informative group and generic privacy-preserving payload assertions. All provider submissions are mocked.
- TypeScript, targeted ESLint, `git diff --check`, and production build (`node scripts/start-messaging-groups-review.mjs --build`). The sandboxed Turbopack attempt stalled; the same build outside the sandbox passed.

The PostgreSQL verifier uses the actual migration and functions with minimal supporting domain tables, real RLS and captured Realtime calls. It does not prove a real Realtime socket join or a Storage-service network upload. Browser persistence/attachment transport uses a stateful loopback fixture, not hosted Supabase. Physical iPhone/live push delivery was intentionally not exercised. Those are release gates, not claims of completed verification.

[Local results](evidence/2026-10-22-messaging-groups-replies/local-results.json), [desktop screenshot](evidence/2026-10-22-messaging-groups-replies/desktop.png), [mobile screenshot](evidence/2026-10-22-messaging-groups-replies/mobile.png).

## Product review

Review URL: **http://localhost:3000**. `node scripts/start-messaging-groups-review.mjs --production` serves the production export plus the loopback fixture. `node scripts/open-messaging-groups-review.mjs` opens installed Chrome with the pre-existing ephemeral fixture session; it makes no login request and creates no Auth account. Closing that browser discards its session. The fixture is memory-only; restarting it resets review messages/groups. Normal local iteration uses `node scripts/start-messaging-groups-review.mjs`.

The obsolete Contacts review static server on port 3000 was identified by PID, command and checkout before being stopped. Only this existing dev checkout serves the candidate. Original unrelated `.worktrees/` and Contacts cleanup evidence remain untouched.

Requested next step: Product acceptance of the local candidate. No permission to push, promote main, apply hosted migrations, deploy or send live notifications is implied.

## Group-header refinement — 2026-10-22

Group headers now show participant names directly beneath the group name, using “You” for the current user and existing collaborator display names for others. Groups of up to four show all names in one truncating line; larger groups show the first three with a fixed `+N more` count. The full list remains available in the header tooltip and participant details. The entire group header is a keyboard-accessible button opening the existing details/management dialog; the separate Participants link is removed. DM headers, membership contracts and creator-only permissions are unchanged.

Tier 1 / Testing Level 1: production build, TypeScript, targeted ESLint and diff check passed. The localhost browser verifier passed at desktop 1440px and mobile 390px, including visible small-group names, large-group truncation without viewport overflow, keyboard activation, creator editing and noncreator read-only details. The adjacent DM/group messaging regression scenario also passed. Updated small-group screenshots are linked above; see [desktop large group](evidence/2026-10-22-messaging-groups-replies/desktop-large-group.png) and [mobile large group](evidence/2026-10-22-messaging-groups-replies/mobile-large-group.png). No migration/backend change or deployment.
