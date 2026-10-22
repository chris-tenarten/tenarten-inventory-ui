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

## Product acceptance and release-readiness integration — 2026-10-22

**Accepted:** Chris's “TENOPS — GROUP MESSAGING RELEASE READINESS” instruction accepts the participant header and Reply to Message behavior at `695b09b`. That current explicit decision is the Product authority for this pass; no separate advisory-thread content was available or inferred. **Implemented/verified locally:** the focused integration changes below. **Not deployed:** no push, main promotion, hosted migration, worker deployment, live provider notification, or Production authentication change is authorized or performed.

This section supersedes the initial candidate's outstanding *local* Realtime/Storage verification gaps. Historical fixture evidence above is retained and reused for unrelated UI/worker checks. Tier 3 / Testing Level 3 applies to this integration pass.

### Focused results

`node scripts/verify-messaging-groups-db.mjs --integration --prepare-local --with-fix` uses the existing `tenops-permission-review` Supabase stack at `http://127.0.0.1:55481`, with the existing Admin/Member/Lead/Outsider/Support accounts. It has no create-account path; Auth user count is checked unchanged. It installs missing released push predecessors and the candidate migrations **only locally**, without resetting the schema or touching hosted data. Subsequent runs use `--integration` without preparation.

Passed with actual Auth JWTs, PostgREST, PostgreSQL RLS, private Realtime sockets and Storage:

- Existing DMs reject conversion through the group-management RPC, direct authenticated UPDATE and even a privileged UPDATE that exercises the immutable-destination trigger. Adding a third account to a group does not expose the old DM's rows/history. No DM history is copied, linked or backfilled into groups.
- Three authorized accounts receive ID-only private events and can read shared history; an outsider receives no group event and cannot join another account's personal topic. A second authorized session receives read-receipt changes and converges to zero unread.
- Actual upload, manifest finalization, signed download, byte equality and persisted attachment reply work. Draft rows, outsider downloads, removed-member history/new signing and removed-recipient notification resolution are denied.
- Actual outbox fan-out produces one delivery per eligible other-member/device/environment, excludes the sender/outsider and deduplicates repeated enqueue/finalization. Device previews on/off, reading after claim, removal after claim, and owner-only deep links are verified against the real preparation RPC.
- The real worker orchestration consumes a signed local run, claims/prepares/rechecks/finishes deliveries through PostgREST. Encryption/provider submission are **mocked**; no APNs/FCM/Mozilla request occurs. Removed recipients never reach mock submission.
- Existing DM source/destination behavior and the actual Job Update mention notification helper/source/queue/destination pass. TenDev sender/recipient/Job allowlists remain enforced. TenOps GA remains separately governed by current source authorization.

`node scripts/verify-messaging-groups-browser.mjs --integration` passed against the production export at exact `http://localhost:3000` with **no HTTP, Realtime or Storage response mocks**: desktop/mobile send and reply; reload and quote navigation; real browser TUS upload and cross-account signed download; unread convergence; visible history clearing after membership removal; cold group/DM notification entry; wrong-account denial; and the existing @mention Job destination. No page errors or external requests occurred. The minimal local permission fixture lacks unrelated Production reporting/planning tables, so its background Production workspace can display missing-domain warnings; these were not hidden or claimed as full-app validation.

Production build (`node scripts/start-read-only-messaging-review.mjs --build`), TypeScript, targeted ESLint, diff checks and the read-only metadata preflight passed. Existing payload/worker-unit and visual-header evidence was reused. No broad suite or new worktree was created.

### Integration fixes and exact release artifacts

1. **New forward migration:** `supabase/migrations/20261022130000_messaging_group_integration.sql`. The real queue test reproduced TenDev group deliveries being omitted (two TenOps deliveries instead of four across both environments). `web_push_pilot_source` treated every non-DM as a mention. The correction resolves group senders from the canonical message while retaining the existing pilot sender/recipient allowlists. It changes no enrollment, transport, cohort, schedule, key, grant expansion or DM/mention policy.
2. **Client fix:** `GlobalMessaging.tsx` now captures `inboxUserId` before clearing query parameters. The browser gate exposed the old deferred callback reading the already-cleared parameters and opening an unselected Inbox. Both group and DM routing retain the same contract.
3. **Focused harness extensions:** existing group DB/browser verifier entry points accept `--integration`; supporting modules reuse local accounts/services. Private sessions remain only in ignored `.tmp-messaging-groups-review/integration-sessions.json` (mode 0600), never versioned. The review helper accepts `--integration` for the existing local Admin session.
4. **Read-only preflight:** `supabase/operations/messaging/groups-release-preflight.sql` inspects object definitions/hashes, grants, RLS, Realtime, private bucket configuration and transport flags without reading private content. It was exercised locally, not hosted.

For an authorized release, inspect hosted predecessors with the preflight first; compare the actual definitions/policies, not a migration ledger. Apply `20261022120000_messaging_groups_replies.sql` **then** `20261022130000_messaging_group_integration.sql`, each once as appropriate to narrowly verified hosted state. The original migration is unchanged in this pass. Deploy the existing environment-specific workers **`send-web-push-tendev` and `send-web-push-tenops`** with their imports of the candidate shared `send-web-push/core.mjs` formatter. The generic `send-web-push` entry point need not be activated or substituted for those aliases. Preserve their fixed environment/secret namespaces, gateway/HMAC/replay settings, current flags, cohorts, VAPID keys and schedules. Then release the compatible client through the separately approved main → TenDev → TenOps boundary. Neither database migration nor the new client should be released in isolation from its required counterpart. Existing DMs remain compatible while the new group UI is not yet released.

No bucket/config change is introduced. The real Storage tests use small files; the old local permission fixture has a 25 MiB bucket setting. Confirm the previously approved hosted 50 MB/file and 200 MB/message contract and infrastructure ceiling in preflight; this pass does not claim a fresh large-file test or authorize a configuration increase.

### Residual risks and readiness decision

**Inherited signed-URL limitation, actually verified locally:** membership removal denies new signing and message/history reads, but a previously issued signed bearer URL remains usable until its expiry. The client currently requests 600 seconds. The focused check confirmed that an already issued 600-second URL still downloads after removal while a new signing request is denied; membership was restored afterward. Immediate revocation of previously issued URLs is **not** implemented. Already delivered OS banners/copies also cannot be recalled. Product should explicitly accept this inherited expiry window before release, or request a separate revocation requirement.

Hosted schema/configuration and the environment-specific worker bundles are still unverified/unapplied for this change. Physical iPhone notification display/OS delivery and an authorized live-provider group smoke test remain post-approval gates; successful local queue/worker orchestration is not physical-device evidence. No new VAPID/enrollment/transport/schedule authorization is requested implicitly.

**Readiness:** local integration gates pass and the candidate is ready for Product's release decision, conditional on the signed-URL expiry semantics and subsequent hosted/device gates. It is not deployed or unconditionally Production-verified.

[Real-service results](evidence/2026-10-22-messaging-groups-replies/integration-results.json), [real-browser results](evidence/2026-10-22-messaging-groups-replies/integration-browser-results.json), [signed-URL limitation](evidence/2026-10-22-messaging-groups-replies/signed-url-limit.json), [real desktop](evidence/2026-10-22-messaging-groups-replies/real-desktop.png), [real mobile](evidence/2026-10-22-messaging-groups-replies/real-mobile.png).

Task artifacts: current dev checkout only; static review server remains on localhost:3000, real local Supabase on 55481, and the earlier loopback fixture on 55592 is retained. Task-created group/message/attachment fixtures remain local for review; no unrelated local data was reset. Dummy local push transports were disabled in `finally`; no dispatcher/schedule was installed. The original unrelated `.worktrees/` and Contacts cleanup receipt/JSON remain untouched. Hosted work is stopped for Product approval.

## Authorized release stopped by hosted privacy preflight — 2026-10-22

Chris accepted the complete Group Messaging + Replies candidate, explicitly accepted the existing 600-second attachment URL expiry after removal (with immediate denial of new signing), and authorized hosted preflight, migrations `20261022120000` / `20261022130000`, environment-specific workers, and TenDev-before-TenOps deployment. This supersedes the earlier pending Product decision about signed URLs. Chris will personally test iPhone notifications after full Production release and report failures; no automated employee test notifications are to be sent for that test.

**Release stopped before hosted mutation**, following Chris's instruction to stop for genuine migration/security failures. Refreshed canonical remote main/dev both remain `daa79324531476f91e9e2be9e254050335e895c9`; accepted local candidate is `bf86a7147212a8c8fda689f294bf048e45ea8410`. No push, migration application, group creation or deployment occurred.

Hosted function definitions confirmed a real compatibility defect in the accepted `20261022120000` migration: its case-sensitive `replace(definition,'begin',...)` does not match the uppercase `BEGIN` installed by the released read-only Messaging migration in `recover_my_work_attachment_transfer` and `edit_my_work_inbox_message`. The guard injection would silently do nothing. In particular, security-definer transfer recovery could return a removed original sender's former group message body/attachment manifest. The previous disposable verifier did not install the released entry-point body rewrite, and the real integration test removed a recipient rather than checking original-sender recovery. Those passing results did not establish this specific hosted compatibility property.

A narrow **local-only, proposed** forward correction is prepared at `supabase/migrations/20261022140000_messaging_removed_sender_entry_guards.sql`. It performs a case-insensitive first-BEGIN injection, verifies exact per-function prerequisites and installed guard presence, aborts on unexpected state, leaves already-correct guards unchanged, and preserves complete function bodies, owners, signatures, grants and controlled search paths. The two previously authorized migration files remain unchanged. This third migration is not included in the existing hosted authorization and must be approved before resuming release.

Focused validation: `node scripts/verify-messaging-groups-db.mjs --hosted-guard-compatibility` passed in a disposable local database with no Auth accounts. It installs the actual released uppercase-BEGIN rewrite before the accepted migration; reproduces the pre-correction removed-sender recovery leak; then verifies recovery/status/edit denial after correction, continued direct-message draft recovery and current-member history, unchanged ownership/ACL/search paths, and repeat-safe correction application. Targeted ESLint and diff checks pass. No application source changed, so the completed production build and accepted browser evidence are reused; no broad retesting occurred. An independent read-only review identified the original mismatch and checked the correction's narrow scope.

Hosted metadata remains unchanged:

| Target | Pages runtime SHA | Pages deployment | Push worker |
| --- | --- | --- | --- |
| TenDev | `daa79324531476f91e9e2be9e254050335e895c9` | `7ec743a2-d57a-49dd-8bf1-4a23f28bebad` | `send-web-push-tendev` v26 |
| TenOps | `daa79324531476f91e9e2be9e254050335e895c9` | `6cc7ff0f-c77d-4fb9-b579-1fc80638223b` | `send-web-push-tenops` v15 |

Neither authorized group migration is ledgered, and the hosted group tables are absent. The private bucket remains private with a 50,000,000-byte limit. TenOps transport remains enabled at its existing cutoff; TenDev remains disabled. Workers remain ACTIVE with their existing function-specific gateway configuration. A routine expired Cloudflare OAuth token initially caused a metadata-read 401; the existing CLI session was refreshed and metadata reads then succeeded. No credential, key, enrollment or notification setting was changed.

[Sanitized blocked-preflight evidence](evidence/2026-10-22-messaging-groups-replies/release-preflight-blocked.json) records exact hosted definition hashes and deployment/worker metadata. Full metadata definitions are retained only in task-owned ignored `.tmp-messaging-groups-release/hosted-before-private.json` (0600); no private message content was read. Existing unrelated dirty files and local review services remain preserved.

**Next Product decision:** approve adding `20261022140000` after the two already authorized migrations and resume the authorized staged release. Recheck the corrected guard assertions before deploying either client. Physical iPhone results remain pending Chris's post-release test.

## Executed release — 2026-10-22

Chris approved correction `20261022140000` at `17299e2`, all three migrations in the exact order, and resumption of workers → TenDev → TenOps. **Deployed runtime/source SHA: `17299e2f48d24c097f03822529a974955fd5dc3f`.** It contains the complete accepted candidate and correction, inheriting canonical `daa7932` features without unrelated changes. The release receipt is a subsequent documentation-only commit and does not require redeployment.

The three exact migration files were applied and ledgered **in order inside one bounded, drift-guarded transaction**: `20261022120000` → `20261022130000` → `20261022140000`. Combining them atomically prevented the intermediate missing-guard state from becoming visible. Their hashes and actual object/guard checks are recorded in [migration application](evidence/2026-10-22-messaging-groups-replies/migration-application.json). Both originally authorized files and the approved correction remain unchanged. Function owners, ACLs/search paths, device ownership/generations/preferences, private bucket, transport cutoffs and scoped Cron were preserved. The unchanged GA source/enqueue/prepare contracts were verified; no broad migration push was used.

Focused **hosted security checks passed** under real `authenticated` SQL roles for existing accounts in a transaction that rolled back completely: current sender could recover the test draft before removal; removed original sender could not recover its body/manifest, query transfer status, edit its former message, read group message/attachment rows or see its Storage object for signing eligibility. A current member retained shared history. A third group member could not see the private DM, and even a privileged DM destination-conversion UPDATE hit the immutable-destination trigger. Helper/anonymous grants remain denied. No test account, persistent group/message/object, notification or outbox row was committed. This is actual hosted RPC/RLS verification; existing passing real Storage HTTP integration was reused rather than claiming a new hosted upload/signing HTTP test. The accepted expiry of previously issued 600-second bearer URLs is unchanged. [Hosted security evidence](evidence/2026-10-22-messaging-groups-replies/hosted-security.json).

| Target | Pages deployment | Runtime SHA | Push worker |
| --- | --- | --- | --- |
| [TenDev](https://tendev.pages.dev) | `a67bdded-148d-47a7-92c2-270b908741ad` | `17299e2` | `send-web-push-tendev` **v27** (`0248da3c-43fe-44e5-84f9-71f35422c401`) |
| [TenOps](https://tenops.pages.dev) | `950ced7e-ab2a-4860-9839-b9888193a9d2` | `17299e2` | `send-web-push-tenops` **v16** (`3449d184-907b-4a78-bb1c-e94f095643ee`) |

Workers deployed first through the existing aliases. Read-back bundles contain the group-aware formatter, existing failure-only diagnostics and existing RPC deadline; fixed environment namespaces and function-specific gateway/HMAC/replay controls were preserved. TenDev remains disabled (503 on unsigned probe); TenOps remains enabled and rejects unsigned wakes (401). No opt-in, preview preference, device registration, cohort, key or schedule was changed. [Worker evidence](evidence/2026-10-22-messaging-groups-replies/workers.json).

Clean `git archive` exports of the exact accepted commit were built with each current hosted project's real configuration, correct branding and reused dependency installation. No worktree was added. Both builds and source/artifact manifests passed; `.env.local`, review fixtures/ports/credentials and local integration sessions are excluded from runtime artifacts. Only the reviewed archive outputs were uploaded; Wrangler's surrounding-worktree dirty warning referred to preserved unrelated files/evidence, not export content. TenDev was pushed/deployed and verified before main was advanced and TenOps deployed. Each target passed exact byte verification of 28 served assets including changed Messaging chunks, `/my-work`, `/settings`, manifests and service worker; normal mobile authentication gate and service-worker headers passed without login, enrollment or business writes. Project configuration digests stayed unchanged. Local feature/security/browser/unit evidence was reused; no broad retesting occurred.

Normal scheduled Production recovery was observed after worker deployment. One 503 `worker_failed` response occurred at **16:30 UTC (11:30 AM Chicago)**; seven subsequent minute sweeps through 16:37 UTC returned 200 with zero claimed/submitted/failed/skipped and pending=0. The underlying transient cause is not established and no timeout/retry changes were made. This is scheduled-worker health evidence, not physical notification-delivery evidence. [Worker health](evidence/2026-10-22-messaging-groups-replies/worker-health.json).

No live test notifications were sent. Chris will test group messaging and physical iPhone push after the full Production release, as explicitly requested, and report failures for timestamp/interaction correlation. Device display/OS delivery remains unverified in this release pass. The accepted ten-minute existing-URL expiry and the transient worker response are the remaining limitations.

[Final release evidence](evidence/2026-10-22-messaging-groups-replies/release-final.json) includes deployment IDs, worker versions, migration status and recovery references. Runtime rollback refs `rollback/messaging-groups-20261022-main` / `rollback/messaging-groups-20261022-dev` preserve prior SHA `daa79324531476f91e9e2be9e254050335e895c9` and prior deployment IDs. Database recovery remains forward-only; do not delete collaboration history or replay notifications. Task-owned clean exports/private metadata remain in ignored `.tmp-messaging-groups-release`; existing localhost review services and unrelated dirty Contacts files/worktrees remain preserved. Main/dev release refs were aligned at the runtime SHA before the documentation-only receipt commit.
