# TenOps iOS Web Push Architecture and Implementation Proposal

Status: Awaiting Product and Architecture review. October 20, 2026.

TenOps can deliver native iPhone notifications without a native app, App Store distribution, AI subscription, email, or an always-on server. Reuse `account_notifications` as the event authority, add a small transactional delivery outbox, and send standards-based encrypted Web Push through one Supabase Edge Function. Start with direct messages only. The Home Screen installation foundation already exists; device registration, background handling, delivery processing, and logout safeguards do not.

This is a Tier 3 security and architecture investigation with documentation-only changes. No application implementation, migration application, hosted configuration change, business-data mutation, commit, push, or deployment is authorized. Proposed schema and UX below require separate acceptance. Navigation: [evidence](#1-current-state-and-evidence), [readiness](#3-ios-readiness), [architecture](#4-delivery-architecture), [security](#5-subscriptions-and-authorization), [delivery](#6-lifecycle-and-deduplication), [roadmap](#10-staged-roadmap), [decisions](#11-product-decisions), [implementation prompts](#12-focused-implementation-prompts).

## 1 Current state and evidence

At investigation time, local `dev`, local `main`, and cached origin refs were `051f23b81947577c2f4a91fb863df372342622bb`. Fresh `git ls-remote` confirmed remote main/dev at that same revision. The startup-animation commit follows `af04478658cac754c716e9a66758b12ccb8e8ab9`.

Fresh read-only Cloudflare project API calls returned:

| Target | Canonical deployment | Revision | Status |
| --- | --- | --- | --- |
| TenOps main | `8b3d7b4f-cea2-4547-9059-4e9d38cb2026` | `af04478658cac754c716e9a66758b12ccb8e8ab9` | success |
| TenDev dev | `6e794e8a-175c-41a8-9d3f-76ea442dfd41` | `051f23b81947577c2f4a91fb863df372342622bb` | success |

These are control-plane observations around 19:04 UTC, not a new byte-for-byte served-bundle certification. Release work may advance after this snapshot. Main/dev and both deployments were not fully aligned at this observation. The supplied Production checkpoint remains current in that API response.

Existing untracked work includes `.worktrees/`, `docs/audits/`, and unrelated release receipts. It was preserved. No review server was started or replaced. Reviewed applicable root `AGENTS.md`, project-memory open questions, messaging/notification performance evidence, auth-refocus release evidence, Manpower release evidence, and startup release boundary. Pre-Production/Bid/Sample lifecycle work remains excluded. The canonical advisory thread was not supplied as a connected source; Product intent here comes from Chris's current investigation request.

Database findings below describe repository definitions, including later replacements, not fresh hosted schema/RLS attestations. No private messages or notification bodies were read from hosted databases. Before implementation deployment, narrowly attest actual notification definitions, grants, policies, trigger definitions, extensions, worker configuration, and relevant migration state.

## 2 Existing notification and messaging architecture

| Contract | Repository evidence | Consequence |
| --- | --- | --- |
| Durable personal events | `supabase/migrations/20260818_004_final_compatibility_support.sql`: `account_notifications`, UUID ID, recipient `user_id`, type, metadata, read state, unique `(user_id, notification_key)` | Use the existing notification ID as delivery identity; do not create another notification feed. |
| Recipient visibility | Same migration enables RLS, self SELECT, no anonymous access; RPCs list/mark personal notifications | New delivery privileges must remain separate from participant content access. |
| Direct-message send | `20260831_016_my_work_inbox.sql`: `send_my_work_inbox_message` writes message and `inbox_message` notification in one transaction | Push initiation must follow the committed notification, never the sending browser. |
| Attachment completion | `20260831_017_my_work_inbox_attachments.sql`, `20260925120000_messaging_large_attachments.sql`: draft/ready lifecycle; finalization creates notification only after byte/manifest checks | Do not enqueue from message INSERT: attachment drafts are not delivered messages. |
| Message event identity | Key `inbox-message:<message UUID>`; metadata includes `message_id`, `conversation_user_id`, optional `job_id` | Stable recipient/event deduplication and existing conversation destination. |
| Later messaging lifecycle | `20260925200000_messaging_v11.sql` handles edits/deletion; cleanup migrations remove related notifications | Recheck source existence and ready status before submission; never push edits as new messages. |
| Current permission boundaries | `20261005120000_read_only_messaging_write.sql`, later access extensions, shared Edge RBAC helper | Device preference management must not accidentally grant business/messaging writes or require them for an authorized reader. |
| Job Update mentions | `20260819_001_job_update_account_collaboration.sql`, replaced by `20260821_003_job_update_self_mention_notifications.sql` | Existing `job_update_mention` events can later enter the same delivery path. Preserve current self-mention semantics. |
| Task events | My Work migrations create `shared_task_assigned` and completion notifications | Assignment extension is possible; reminder scheduling is a separate future contract. |
| Realtime | `20260824_003_account_notifications_realtime.sql`; `AccountNotifications.tsx`, `GlobalMessaging.tsx`, messaging awareness | Realtime refreshes live UI; it cannot wake an absent or suspended tab. Filters are not the delivery authorization boundary. |

`AccountNotifications.tsx` reads notification history through `list_my_account_notification_history`, listens for recipient inserts and focus/reconnect, and coordinates arrival attention using `notification-arrival-state.ts`. Arrival state is currently per mounted account/session, not durable push deduplication. `GlobalMessaging.tsx` maintains unread/thread awareness and resets ownership across accounts.

`src/lib/auth.tsx` restores persisted Supabase sessions, verifies `get_my_app_access`, guards stale account requests, and distinguishes continuing sessions. `src/lib/supabase.ts` enables persistence and token refresh. There is currently no push deregistration in sign-out or password-update sign-out paths. A service worker must not copy access or refresh tokens into its own storage.

The frontend is a Next static export (`next.config.ts`), hosted on Pages. There is no discovered application Worker/Pages Functions delivery backend. Existing Supabase Edge Functions provide the stronger reuse point: PDF generation, user administration, messaging cleanup, and shared authorization. `supabase/operations/messaging/cleanup-setup.sql` already describes disabled-by-default Cron/pg_net/Vault dispatch, bounded runs, and count-only operational records. Repository presence does not establish that this setup is enabled on the host.

## 3 iOS readiness

| Capability | Current state | Required pilot work |
| --- | --- | --- |
| Manifest and standalone launch | `src/app/manifest.ts`: `display: standalone`, scope `/`, start `/`, ID `/my-work` | Preserve identity during pilot. |
| Alternate install identity | `manifest-dashboard.webmanifest/route.ts`: ID `/`; `install/my-work` and `install/dashboard` pages exist | Pick one installation path for onboarding; document existing duplicate installations. Do not silently consolidate manifest IDs. |
| Icons and metadata | Root layout declares manifest, Apple web app metadata, 180px touch icon; public 192/512px icons exist for TenOps/TenDev | Confirm actual served icons, manifest MIME type and HTTPS on chosen canonical origin. |
| Background push | No `serviceWorker`, `PushManager`, `showNotification`, or native Notification integration found in `src`/`public` | Add narrowly scoped root service worker, registration and subscription UX. No offline cache is needed. |
| Permission and recovery | No Web Push settings | Explicit enable gesture, status reporting, denial/revocation instructions and registration reconciliation. |

iOS/iPadOS 16.4 introduced Home Screen Web Push using standard Push, Notifications and Service Worker APIs. Permission requests must follow direct interaction. Apple Developer Program membership is unnecessary. Use capability detection and verify the installed context; a normal iPhone browser tab is not the pilot experience. [WebKit platform requirements](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Register `/sw.js` at root scope on HTTPS. Give it an update-friendly cache policy; do not cache authenticated HTML, API responses, messages or attachments. Request permission only after the user taps Enable in the installed app; ensure async setup does not lose the required user gesture. Subscribe with `userVisibleOnly: true` and the public VAPID application-server key. Store the returned subscription through authenticated registration. Never poll Realtime from the worker.

Support denied/default/granted, missing subscription despite granted permission, unsupported environment, subscription registration failure, and revoked OS permission distinctly. On each authenticated startup, reconcile `getSubscription()` and permission with server status. Do not rely exclusively on `pushsubscriptionchange`; subscription expiration can be null and devices can disappear without notice.

Modern WebKit also supports Declarative Web Push, with a visible notification description and fallback when service worker execution fails. Evaluate a compatible declarative envelope during the small runtime feasibility check, while retaining the conventional worker path for the accepted minimum OS. Do not gate the pilot on a Safari-only API. WebKit requires visible notifications for conventional push; silently dropping every push when a foreground tab exists risks permission enforcement. [WebKit declarative behavior](https://webkit.org/blog/16535/).

## 4 Delivery architecture

Recommended flow:

```text
Existing authorized message send or attachment finalization transaction
  -> account_notifications INSERT
  -> narrow trigger records eligible event in push outbox
COMMIT
  -> signed asynchronous wake request, with periodic recovery sweep
  -> Supabase Edge worker claims bounded deliveries
  -> current recipient/source/device checks
  -> encrypted Web Push submission to browser vendor endpoint
  -> device shows generic notification
  -> tap opens authenticated TenOps resolver
```

The outbox and per-device delivery ledger are transport bookkeeping linked to existing notifications, not a parallel notification system. A webhook alone has no adequate durable retry/accounting contract. A trigger must never wait for external push submission. Supabase Database Webhooks use asynchronous `pg_net`; Cron can periodically invoke Edge Functions. [Webhooks](https://supabase.com/docs/guides/database/webhooks), [scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).

| Credible option | Assessment |
| --- | --- |
| Supabase outbox plus Edge Function plus Cron | Recommended. Existing database/event ownership and Edge operational pattern; one new function and small transport tables. Immediate wake is an optimization; sweep ensures recovery. |
| Outbox plus Cloudflare Worker and Cron | Viable fallback if Supabase runtime/library or scheduling proves unsuitable. Adds cross-provider DB credentials, Worker deployment and schedule ownership. Pages static hosting alone cannot send push. |
| Trigger webhook directly sends without ledger | Reject for pilot reliability: missing durable attempts, retry recovery and concurrency accounting. |
| Browser sends on Realtime arrival | Reject: requires a running recipient/sender page and cannot be trusted as delivery authority. |

A significant current constraint: Supabase documents `pg_net` request-header visibility to database roles; Vault encryption does not hide the decrypted queued header. Never place a service-role key, VAPID private key, or reusable broad worker bearer token in that queue. [Supabase security advisory](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357).

Proposed wake authentication: a dedicated HMAC key held in restricted Vault storage and Edge secrets signs a fixed worker purpose, deployment environment, run UUID and short expiration. The request contains only the signature and nonsecret claims, not the key. A private run row is atomically consumed once, with freshness and signature checks before privileged DB operations. The worker derives work from its own ledger; requests cannot specify arbitrary recipients, URLs or payloads. Capturing a queued signed request can at most race the same bounded run, not authorize new content. Confirm PostgreSQL crypto support and gateway behavior in Stage B. If legacy gateway verification is required, a public anon credential can accompany the signed request; it is not worker authorization. Never globally weaken existing Edge JWT settings. Runtime and gateway configuration must be explicit and reviewed.

Use one-minute recovery sweeps initially, batches capped by measured runtime limits, concurrency-safe claims and backoff. Immediate wake can be coalesced and may fail without losing the committed event. A strict outbox insertion failure should roll back the message transaction rather than silently lose its event; keep trigger logic tiny and test failure/kill-switch behavior. Network wake failure must not roll back message delivery.

## 5 Subscriptions and authorization

Proposed append-only forward migrations, prepared only after acceptance:

| Object | Fields and invariants | Access |
| --- | --- | --- |
| `web_push_subscriptions` | ID, owner, trusted environment/origin ID, endpoint and hash, `p256dh`, `auth`, VAPID key version, optional expiration, enabled state, binding generation, created/last-confirmed/revoked times; unique endpoint hash per environment | RLS; owner-safe device summaries only. No subscription/key listing for other users. Worker gets necessary transport material only. |
| `web_push_outbox` | Unique notification ID, recipient, event type, creation/expiry; activation cutoff | Private; trigger-owned inserts, worker-only processing. No browser enqueue. |
| `web_push_deliveries` | Unique `(notification_id, subscription_id, binding_generation)`, state, attempt count, next attempt, lease token/expiry, submission timestamp, sanitized error class | Private; claim/update functions restricted to worker. No routine admin content browsing. |
| Worker runs | Run ID, purpose/environment, expiry/consumed time, aggregate outcome | Restricted operational data, no message text or endpoint logs. |

Use owner-scoped registration/disable RPCs with `auth.uid()` derived identity and active-account checks; reject caller-supplied ownership. Revoke direct browser table writes. Restrict SECURITY DEFINER search paths and EXECUTE grants. Use checked parameter bounds and atomically increment binding generation on revocation/rebinding. A read-only authorized participant should be able to manage personal devices without gaining message-write capability.

Subscription endpoints are capabilities and an SSRF boundary. Accept HTTPS vendor endpoints only from a reviewed exact-host/suffix registry with boundary-aware matching, reject credentials/custom ports/private destinations, disallow redirects, bound keys/body sizes and enforce per-user installation quotas. Do not use an arbitrary URL submitted by a client as worker fetch authority. Allow only configured browser vendors; WebKit documents `*.push.apple.com`. Keep keys/endpoints out of console errors, audit exports and analytics.

Treat a subscription as a browser installation, not a physical-device identifier. Multiple installations on one phone can create multiple subscriptions. Send once per enabled installation intentionally. For ownership changes, require successful local browser unsubscribe and creation of a fresh subscription before binding a new account. A registration collision with another owner's endpoint fails closed; never silently transfer by upsert. Existing queued work keeps the prior generation and cannot be retargeted to the new owner.

Logout must first mark the local binding disabled, close visible notifications, revoke server binding while credentials are valid, and unsubscribe locally. Integrate normal sign-out, account switching, password-change sign-out, session loss and profile revocation; do not put async Supabase RPCs inside its auth callback lock. Network failure must not trap the user logged in: perform local unsubscribe/disable, persist a cleanup tombstone without tokens, and reconcile later. Remote disable of another owned device should be available through a small device list or supportable owner action.

An already accepted vendor push cannot reliably be recalled. Offline logout plus failed unsubscribe cannot establish instantaneous remote revocation. Generic payloads and an authenticated resolver limit exposure, but Product must accept residual generic banners and timing metadata; a stronger zero-post-logout-banner promise is not feasible. Worker-local binding checks are defense in depth, not a silent-drop strategy that contradicts WebKit's visible-push rule.

## 6 Lifecycle and deduplication

1. On notification insert, enqueue only `inbox_message` events after pilot activation. Verify a real ready message and matching recipient. Exclude welcome, announcements, system release communications and historical backfill. Existing system communications can also use inbox notifications, so type alone is insufficient: exclude the canonical system sender using the established system-user identity contract.
2. Freeze eligible enabled subscription IDs and binding generations at event time. A newly enabled device receives future events, not old backlog. Preference disable and binding changes cancel unsent deliveries.
3. Worker claims due rows atomically using short leases and `FOR UPDATE SKIP LOCKED`; completion requires the matching lease token. No long network call inside a DB transaction. Recheck recipient active status, event/source relationship, ready message state, device ownership/generation and current preferences immediately before submission. Skip missing/deleted sources and optionally already-read messages according to accepted Product semantics.
4. Submit small encrypted payload: fixed title `New TenOps message`, generic body, opaque notification ID, schema version and approved same-origin resolver destination. Do not forward existing notification title/body/metadata wholesale; those may contain names, message excerpts, Job names or task titles.
5. On accepted response mark `submitted`, not `delivered` or `seen`. On 404/410 revoke subscription and terminate its pending deliveries. On timeout/network/429/5xx retry with bounded exponential backoff, jitter and Retry-After. Treat authentication/key failures as operational failures, not proof a subscription expired. Stop retrying when event expires; propose one-hour TTL, six attempts, initial 30-second retry and maximum 15-minute delay, subject to Product approval.
6. Recover expired leases after worker failure. Retain compact terminal outcomes for a proposed 30 days, then prune. Never replay submitted rows automatically; retry ambiguous outcomes only within TTL.

Database uniqueness prevents duplicated event/device jobs. It cannot make remote HTTP submission exactly once: a worker can crash after provider acceptance and before committing status. Use stable notification `tag`, best-effort local event tracking and `renotify: false` where supported to reduce repeats. Those mechanisms do not guarantee exactly one banner across OS versions, storage loss or notification dismissal. Do not claim guaranteed presentation, timing, sound, or receipt from a 2xx response. Focus, connectivity and OS policy remain outside TenOps control.

For foreground coordination, let push own the OS banner on enabled installations. Realtime still updates inbox/bell state, but suppress the additional intrusive arrival spotlight for DM events on that installation. Preserve other notification types and disabled-device behavior. Share opaque event IDs through worker messages so tap/open does not create another arrival prompt. Do not suppress the OS push merely because a tab appears active. This deliberately favors reliable background delivery over inferred presence. Product must accept foreground OS banners; there is no race-free cross-channel guarantee using browser presence alone.

## 7 Minimal settings and permission experience

Add one Notifications section to Settings: installation/support status, permission status, `Enable notifications on this device`, `Disable on this device`, and `Direct messages` on/off for this installation. Explain that other installations are independent. Enabling implies DM opt-in; the separate DM switch is useful only if retaining the subscription while muted is desired. The smallest accepted UX can combine them into one control.

Show manual Add to Home Screen instructions when needed; request permission only after opening the installed app and tapping Enable. On denial/revocation, show OS settings instructions rather than repeated prompts. Distinguish permission granted from server registration complete. Do not show mentions, assignments, reminders, quiet hours or AI settings before those capabilities exist. Existing account-preference infrastructure may later host an account-wide type switch, but the worker must read authoritative server state; a frontend JSON flag alone is insufficient.

## 8 Deep links and authenticated opening

Current `GlobalMessaging.tsx` recognizes `?inbox=1` and `?inboxUserId=<UUID>` after active profile resolution, then opens the existing Inbox. `AccountNotifications.tsx` dispatches `tenops:open-inbox` for warm-page opening. Reuse both behaviors.

Prefer a stable URL such as `/?pushNotificationId=<opaque UUID>`. An authenticated owner-only resolver loads the notification and available source, derives the conversation participant on the server, and opens existing Messaging. Do not place sender names, message text, tokens or raw arbitrary destinations in the URL. Preserve the pending UUID across sign-in without exposing prior-account content. Resolve only after verified active access; wrong account, revoked access or deleted source produces a neutral unavailable state. No auto-switching accounts. Mark read only using the existing actual conversation-read behavior, not provider acceptance or notification-click receipt.

`notificationclick` should close the notification, validate same-origin allowlisted destinations, focus/navigate an appropriate existing window or open one. It must work when no page exists. For a warm window, use a validated message bridge or navigation that triggers resolution without replaying startup. Test multiple windows and duplicate install identities. Future Job mentions reuse the existing job/update navigation only after normal access checks; tasks already have `/my-work?view=shared&taskId=...`. No new Job records or Pre-Production lifecycle behavior is involved.

## 9 Cost and operational continuity

Required services remain Pages static hosting, existing Supabase Auth/Postgres/Edge, and browser vendors' push services, including APNs on Apple. No native-app certificate, Apple Developer membership, paid notification broker or recurring AI API is required. Internet, vendor service availability and installed-device permission remain external dependencies.

Illustrative sizing, not observed traffic: four users, two installations each, 100 recipient DM events/day yields at most 200 initial push submissions/day, about 6,000/month before retries. A one-minute sweep is 43,200 Edge invocations per 30-day month; immediate wakes add at most roughly 3,000 under that example before coalescing. Database polling, row retention, egress and existing workload also count.

Supabase currently lists 500,000 Edge invocations included on Free and 2 million on paid tiers, then $2/million on paid usage. Pro starts at $25/month; existing plan and shared consumption must be checked before rollout. This modest incremental estimate does not establish a zero bill or justify a new plan. [Supabase pricing](https://supabase.com/pricing). If a Worker fallback is chosen, Cloudflare meters dynamic requests/CPU separately from static assets; verify the account's plan and current rates. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

Secrets: VAPID P-256 private/public pair and contact subject, dedicated wake HMAC key/version, and existing server-only Supabase credential inside the Edge runtime. Only VAPID public key is frontend-visible. Keep TenDev/Production keys and subscription namespaces distinct even if the underlying DB is shared. Origin/environment selection must come from trusted configuration, not an arbitrary registration field. Pilot outbound delivery should default off in all environments and previews.

Engineering owner should check aggregate queue age, expired leases, retry/dead counts, 401/403 spikes, invalid subscriptions and Cron heartbeat. Count-only operational inspection must not grant private message-reading access. Define a lightweight daily/weekly check or existing monitoring integration; no email pipeline is required. Provide a kill switch that stops claims and wakes while preserving inbox notifications.

Recovery: fix/redeploy worker, rotate compromised wake key with short overlap, recover only unexpired failed/leased jobs, and verify queue drain. Back up VAPID keys securely; VAPID replacement can require device resubscription, so retain key version and a controlled rotation window. Lost endpoint records require re-enable on the installation. Restore from DB backup with delivery disabled first to avoid replaying historical notifications. Record endpoint revocation and TTL limits; rollback cannot retract already presented banners.

## 10 Staged roadmap

All estimates are rough engineering effort, excluding review queues, authorization and device scheduling. Stage A/B both cross Tier 3 boundaries and need Testing Level 3 for their relevant contracts. This investigation itself needs documentation checks only.

### Stage A PWA readiness and device registration

Likely paths: new `public/sw.js`, `src/lib/web-push.ts`, `src/components/PushNotificationSettings.tsx`; bounded edits to `src/app/settings/page.tsx`, authenticated shell registration, `src/lib/auth.tsx`, and a new narrow migration for subscription storage/owner RPCs. Review manifest/install routes and static response headers only as needed; preserve startup animation and mobile work.

Schema/security: subscription ownership, registration bounds, endpoint validation, generation/revocation; no event delivery enabled. Validate two-user isolation, inactive/anonymous denial, unauthorized ownership changes, duplicate registration, permission denial, expiration, offline logout, account switch, password-flow sign-out and service-worker update. Check TypeScript, targeted lint, diff and Production export, plus focused browser tests using existing fixtures. Use localhost:3000 for Chris's actual candidate review after inspecting process ownership. Localhost cannot certify physical iOS push; that requires a separately authorized HTTPS test origin.

Dependencies: accepted install identity, UX, account lifecycle semantics, migration application, public-key configuration and frontend release each need appropriate authorization. Complexity: medium, approximately 2–4 engineering days. Rollback: disable registration/feature flag and revoke bindings; retain schema/data. Do not abruptly remove an installed worker script without an explicit worker-retirement plan.

### Stage B Direct message delivery

Likely paths: new `supabase/functions/send-web-push/index.ts`, small testable transport/auth core under that directory or `_shared`, new forward migration for outbox/delivery/run objects and narrow notification trigger; reviewed `supabase/operations/web-push/{setup,enable,disable,inspect}.sql`; focused `scripts/verify-web-push-*` verifiers. Add authenticated link resolver and bounded edits to `GlobalMessaging.tsx`, `AccountNotifications.tsx`, `notification-arrival-state.ts`. Do not rewrite messaging send/finalize contracts.

First perform a small non-production Deno/Edge feasibility check of a pinned maintained Web Push library: VAPID signing, encryption, vendor response handling and runtime compatibility. No new extensive test environment. Synthetic push-service responses verify retries without contacting real devices. Add transaction rollback tests, attachment draft/finalization/retry tests, system-sender exclusion, two-account RLS/grants checks, concurrent lease claims, crash-after-acceptance ambiguity, 404/410/429/5xx handling, signed-wake expiry/replay/tamper, SSRF/redirect denial, disable/rebind races, restore cutoff and wrong-account deep links. Reuse existing auth/messaging harnesses; run relevant lifecycle gates, TypeScript, targeted lint, diff and export. Independent adversarial review is justified before deployment, not performed by assumption here.

Dependencies: separately approved migrations/policies/grants, worker deployment, secrets/Vault setup, Cron/pg_net configuration, gateway auth and activation cutoff. Deploy dormant schema and worker first, compatible frontend next, then explicitly enable only allowlisted pilot recipients/subscriptions; no historical backfill. Complexity: medium-high, approximately 3–6 engineering days. Rollback: disable delivery/cron immediately, preserve audit rows and base notifications, cancel stale pending work; forward migration for any DB correction.

### Stage C Physical iPhone acceptance and pilot

Likely artifacts: focused device checklist/evidence and operations runbook in project memory, no new app. Use real supported iPhones on a separately authorized HTTPS candidate backed by safe non-production accounts/data. Test installed cold start, closed/suspended tab, locked screen, sender on another device, offline then online within/outside TTL, Focus/denial, revoked permission, multiple installations/devices, warm tap, expired session/sign-in, wrong account, logout and source deletion. Explicitly record OS/browser versions, submitted versus visually observed counts, latency samples and failures.

Hosted acceptance gates: narrowly attest actual schema, grants, RLS, worker/gateway config, schedule heartbeat, secret presence without values, environment separation and generic payloads. A desktop Chromium permission simulation is not iPhone acceptance. Pilot four existing users through manual onboarding; no QR guide needed. Assign engineering operations owner and Chris's acceptance before expanding. Complexity: low-medium, approximately 1–2 engineering days plus device observation time. Rollback: disable delivery and devices; inbox remains available.

### Stage D Mentions and assignments

Extend the same event eligibility/renderer mapping and owner preferences using `job_update_mention` and `shared_task_assigned`. Likely edits remain the worker event map, settings, resolver and a narrow forward trigger eligibility migration. Inspect event uniqueness semantics first: task notification keys based on task ID may intentionally suppress later reassignment events, so do not promise one push per reassignment without a separately accepted event contract. Validate actual recipient/source visibility and repeat mention behavior. Reminders need a separate scheduling/timezone/due-change/cancellation contract and stay deferred.

Separate Product acceptance, database authorization and deployment gates apply. Complexity: roughly 1–3 engineering days per bounded event type after semantic acceptance. Rollback by event-type flag, leaving DM delivery intact. No automatic inclusion of generic Job Updates, announcements, all task completions or Pre-Production events.

## 11 Product decisions

The following are proposed choices for review, not implementation authorization:

1. Accept DM-only pilot with generic `New TenOps message`, no sender/message/Job detail, and exclusion of system release messages.
2. Choose the canonical install origin/entry and minimum supported iOS version; retain existing manifest IDs and onboard one installation per phone initially.
3. Accept per-installation enable/mute, intentional fan-out to enabled devices, and foreground OS banners with DM arrival spotlight suppressed on those installations.
4. Accept best-effort delivery, possible ambiguous-retry duplicate, residual generic banners around logout, and no device presentation guarantee.
5. Confirm proposed one-hour expiry, six-attempt retry ceiling, no historical catch-up, 30-day outcome retention, and whether already-read messages are skipped before submission. Recommended: skip when actual message is read, not merely bell notification marked read.
6. Approve the subscription/outbox authorization model, signed worker invocation, engineering operations owner and environment isolation, then authorize migration/configuration/deployment separately.
7. Approve physical iPhone acceptance gate and pilot cohort before Production enablement. Mentions/assignments and reminders remain later decisions.

## 12 Focused implementation prompts

Use these only after the relevant Product decisions are accepted. Each prompt should include the accepted contract and exact baseline, preserve unrelated dirty work, and forbid automatic release.

**Stage A prompt:** “Implement only accepted PWA subscription and device-settings contract from the October 20 iOS push architecture report. Tier 3. Inspect current Git and workstreams first. Prepare narrow forward subscription migration and owner-only registration/revocation RPCs; do not apply it. Add a minimal worker with no authenticated caching, explicit user-gesture permission UX and account/logout lifecycle integration. Outbound push remains off. Test ownership, stale account responses, offline failure and password sign-out; present localhost:3000 candidate using safe fixtures. Do not change manifest identity, mobile UX, startup animation, messaging lifecycle or hosted configuration. Return diff, focused evidence and remaining authorization gates.”

**Stage B prompt:** “Implement accepted DM-only transport over existing account_notifications, preserving send/finalization transactions. First prove pinned Web Push library compatibility in a small isolated non-production check. Prepare private outbox/device ledger and signed single-use wake/run contracts; never queue broad credentials in pg_net. Add bounded Edge worker, retries/leases/TTL, endpoint SSRF guards, generic payload, owner-authenticated resolver and foreground attention coordination. Test transaction boundaries, drafts, system-message exclusion, concurrent/crash retries, subscription rebind/logout, signature replay and wrong-account links. Prepare disabled setup/runbook; no migration application, secret installation, hosted changes or release. Return Tier 3 evidence for review.”

**Stage C prompt:** “After explicit authorization for the exact HTTPS non-production candidate, validate on physical iPhones using only named pilot accounts and synthetic messages. Record permission/install/cold-start/lock-screen/session-switch/revocation/multiple-device outcomes and provider-submitted versus visually observed counts. Narrowly attest deployed authorization and schedule state. Stop for Chris's acceptance; Production rollout requires separate authorization.”

**Stage D prompt:** “Investigate accepted next event type against current durable notification uniqueness and recipient access. Resolve reassignment/repeated-mention semantics with Product before changing them. Extend only the existing delivery map/preferences/resolver and focused tests. No reminders or Pre-Production lifecycle work; no automatic migration application or deployment.”

## 13 Investigation validation and stop point

Completed read-only repository inspection, current Git/remote verification, narrow live Cloudflare project/deployment reads, current primary-source platform/security/pricing review, and document link/path/diff checks. No feasibility code or device test was needed to establish the proposed architecture; Edge library compatibility, hosted database state and physical iPhone behavior remain explicit implementation gates. No application build or broad suite is warranted for this documentation-only change.

The persistent artifact is this report. Stop here for Product and Architecture review. It does not authorize application implementation or any Production change.
