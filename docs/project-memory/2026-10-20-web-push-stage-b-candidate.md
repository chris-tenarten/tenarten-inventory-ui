# Web Push Stage B local candidate

Prepared for Product and Architecture review on October 20, 2026. Branch `feature/web-push-stage-b`, persistent worktree `.worktrees/web-push-stage-b`. Local implementation, disposable database execution and local commits only. No hosted migration, remote push/merge, deployment, installed production secret, Cron enablement or live device notification.

## Boundary and Product direction

At investigation, fresh remote main/dev were `00c4fca4a1433eae0120f7103244721c6f1d2fb9`, including accepted Mobile Early Access. Both Cloudflare canonical deployments still reported startup revision `051f23b81947577c2f4a91fb863df372342622bb`: TenOps `2f5e90a3-e120-4cde-9b39-afd29eca703f`, TenDev `6e794e8a-175c-41a8-9d3f-76ea442dfd41`. These are read-only control-plane observations, not served-byte certification. Other release work can advance afterward; recheck before any promotion.

Final read-only boundary check at 20:30 UTC found that the separate startup workstream had advanced local main/dev and both canonical deployments to `8f549d57bdfad25355787ccf0f3788436f38b23e`. TenOps deployment is now `4c3286a8-a04a-4357-91c2-80e54fb9617a`; TenDev is `c4c8c52a-e53f-49ae-8404-b54deea6178c`, both successful. This candidate was not rebased or promoted. It preserves this request's 1.85-second ordinary hold; the separate canonical hold change requires explicit reconciliation at integration review. The review URL returned HTTP 200 after the final commit check.

This worktree starts from canonical `00c4fca` and carries Stage A `3e10d65` as local commit `55fbafc`. The original Stage A branch/worktree, Mobile and startup workstreams, root dirty records and main/dev were preserved. Stage B follows Chris's updated decision: **both direct messages and Job Update mentions**, with informative previews defaulting on when a device is enabled. That decision supersedes the investigation's generic-only DM pilot recommendation.

## Stage A database verification

The exact Stage A migration ran in a new disposable PostgreSQL 17.6 container with Docker networking disabled. Ten focused real-role checks verified read-only active registration, idempotent duplicate registration, direct table denial to authenticated/anonymous/service roles, anonymous EXECUTE denial, cross-account summaries and takeover denial, foreign revoke isolation, generation/idempotent revocation, expired/key/endpoint rejection, inactive-account denial with owner revoke retained, restricted search paths and helper execution. No Stage A migration correction was needed. [Evidence](evidence/web-push-stage-b/stage-a-database.json).

These are real PostgreSQL grants/RLS and RPC executions, not browser mocks. The test uses a narrow synthetic supporting schema and repository source functions rather than recreating every historical migration or claiming hosted parity. Stage A remains unapplied to hosted Supabase. Production verification must attest actual source policies/functions/extensions and grants narrowly before deployment.

## Transport and authorization

Prepared forward migration: `supabase/migrations/20261020210000_web_push_transport.sql`. It adds server-owned per-installation `show_previews`, an owner/generation-scoped preference RPC, safe registration status, private transport configuration, outbox, device delivery ledger and signed-run state. Transport flags default false, require an activation cutoff, and have no seeded configuration.

`account_notifications` remains the event authority. A narrow AFTER INSERT trigger accepts only canonical `inbox_message` and `job_update_mention` sources. It inserts an outbox event and freezes enabled device IDs/generations in the same transaction. Unfinished attachment drafts never qualify. The actual repository attachment finalizer creates the notification only after ready/bytes checks. Message edits do not re-enqueue; canonical system sender UUID, `sender_kind=system`, release announcements and other notification types are excluded. Existing notifications are never scanned/backfilled. Strict transactional policy: an outbox insertion failure rolls back the originating transaction; a synthetic failure test proves no message remains. The trigger makes no remote HTTP request.

Mention synchronization creates durable `job-update-mention:<update UUID>` keys, unique per recipient. Repeated refresh/edit/replay, or removal followed by re-addition, does not create another notification/push for the same recipient/update. Existing explicit self-mention behavior is preserved. Routine updates, assignments, tasks/reminders and Intake collaboration remain outside scope.

Browser roles have no direct transport or subscription-table privileges. Private source/enqueue helpers cannot be called by browser roles; worker claim/prepare/finish/run/prune functions are service-role only. Preferences and destination resolution derive the owner from `auth.uid()` and verify active access. Source preparation checks recipient, ready/current source, current canonical mention membership, current operational read capability for Job Updates, device enabled state, generation, expiry and environment. DM conversation `read_at` suppresses submission; bell read state does not. Source deleted/access denied means no submission; missing sender/excerpt context has a safe generic fallback. No notification metadata is blindly used as payload or destination.

The current source authorization model is active-participant DM access and role capability `readOperationalData` for Job Updates, matching the inspected repository contracts. If later hosted policy adds narrower project membership/field visibility, that must be reflected in this private source gate before activation. No existing policy is broadened by this migration.

## Worker and payload contract

One implementation under `supabase/functions/send-web-push` uses pinned MIT `web-push@3.6.7` to generate VAPID/encrypted requests and native fetch to prohibit redirects, validate a narrow vendor endpoint registry and bound requests. The installed Supabase Edge Runtime 1.74.3 executed the encryption probe: `aes128gcm`, 132 encrypted bytes for its small synthetic probe, no plaintext in the encrypted body, VAPID authorization generated and zero push-service requests. The actual worker entry point also booted locally with no installed secrets and returned disabled. [Compatibility](evidence/web-push-stage-b/edge-compatibility.json).

Authenticated wakes use dedicated HMAC-SHA256 over version/environment/run/expiry, short freshness, one-time DB consumption and no reusable credentials in `pg_net`. The prepared SQL signer and JavaScript verifier were cross-tested using synthetic Vault rows and a recording net stub in the network-isolated database. Periodic recovery is one proposed minute; no schedule is enabled or immediate network call added to message transactions. Function-specific gateway/authentication and configuration requirements are in the [worker runbook](../../supabase/functions/send-web-push/README.md).

Claims use `FOR UPDATE SKIP LOCKED`, unique event/device/generation keys, five-row batches and 90-second leases. Processing has a 45-second deadline; remaining leases recover. There are six attempts maximum, one-hour event expiry, jittered exponential backoff, Retry-After and 15-minute retry-delay cap. 404/410 disable only the matching device generation; 429/5xx/network errors retry; auth failures do not invalidate subscriptions. Provider acceptance is stored as `submitted`, never device-delivered/read. Terminal records retain 30 days; worker-run maintenance prunes them. Long-disabled environments need separately authorized retention maintenance.

Version 1 payloads contain opaque event ID, kind, title/body, fixed same-origin resolver URL and stable tag. Body previews strip HTML, basic markup and control/bidi characters, normalize whitespace and truncate to 140 Unicode characters. Names/context are separately bounded. Examples below are synthetic fixture data, not hard-coded production identities:

| Event | Informative title | Body |
| --- | --- | --- |
| DM | Alex Operator · Direct Message | Can you check the revised color plate before tomorrow? |
| Mention | Mentioned by Blair Lead · 26-1042 | Please verify material readiness before production. |
| Attachment-only DM | Sender name · Direct Message | Sent an attachment |
| Previews off | New TenOps message / New TenOps mention | Open TenOps to view this notification. |

The installation checkbox **Show message previews in notifications** defaults on for newly enabled devices. It updates the owner/generation-scoped server preference. The worker rereads source/device/preference after encryption and before submission; if these changed it skips that attempt instead of sending stale content. Client state is not delivery authority. The subscription endpoint and encryption material never appear in resolver output, URLs, normal logs or operational outcomes.

## Deep links and startup

The service worker always displays a visible notification, using stable event tag and `renotify:false`; it does not suppress push because a browser is open. No authenticated fetch cache is introduced. Click data contains only `/?pushNotificationId=<UUID>`. External/arbitrary click destinations are rejected. A warm window receives a same-origin message and focuses without a reload; a cold click opens the resolver URL.

`PushNotificationEntry` retains only the opaque ID across sign-in, waits for verified active access, pins the RPC to the current session, and rejects a response if account identity changed. The owner-only resolver returns an existing conversation peer or Job/Update ID. It reuses `tenops:open-inbox` and `openProductionJob`; it never exposes message bodies or credentials in a URL. Wrong-account/deleted/revoked cases show a neutral unavailable state with Retry/Dismiss, without silently switching accounts. Read state follows existing actual conversation behavior, not push acceptance or click.

`WelcomeHero` has a narrow notification-entry guard and warm-entry event. Only decoration is bypassed; AuthProvider/access and normal content-loading checks remain unchanged. Ordinary fresh launch retains the accepted 1.85-second crest hold. No authentication restructuring or hold-duration change was made. A malformed/unavailable notification cannot bypass access checks; it can only request decorative bypass, which is not an authorization boundary.

For server-confirmed delivery-enabled installations, DM/mention arrival candidates are treated as push-owned, using existing stable notification IDs and arrival bookkeeping. Bell counters/history and Realtime still update. Other event types and installations with push disabled keep existing in-app attention. A notification whose setting changes while in flight can still have an OS banner; neither tags nor 2xx responses prove exactly one presentation.

## Product review

Open [actual Settings review](http://localhost:3000/settings#notifications). Enable the simulated device, then expand **Simulated push review** at the bottom right. Simulate DM or Job mention to inspect a banner; click that banner to open actual Messaging or the Job Update Inspector. Toggle the preview checkbox and simulate again for generic content. **Normal fresh launch** demonstrates the ordinary animation. Cold entry can be reviewed by loading the last simulated opaque notification URL in the same tab. The permanent notice distinguishes the fixture from actual OS delivery.

The existing Sample review adapter serves the actual exported app with synthetic auth, source events, per-device state, in-memory library/creation and real local PDF rendering. The banner uses the worker's payload builder. Server-side real-role authorization is verified separately in PostgreSQL; the browser review is a representative fixture, not a live Supabase integration. No actual browser Push API subscription or OS/device push is sent. The Stage A review process was confirmed by worktree and replaced on port 3000; other workstreams were not stopped.

## Validation and evidence

Tier 3 implementation and focused Testing Level 3 database/lifecycle/security gates. No full historical audit/suite or independent-agent review is claimed. The final diff received a self-review for privacy, roles, entry races, signed wakes and delivery disabled defaults.

- **33 database groups** passed, including Stage A's 10: actual roles, outbox transaction rollback/failure, real source send/empty-body attachment begin/finalize/mention functions, system exclusion, repeat mention deduplication, source deletion, edit/unrelated-event exclusion and recipient/preview checks, private transport denial, two real concurrent claims, retry/lease/six-attempt behavior, expiry, invalidation, 30-day retention and SQL/JS signed-wake compatibility. [Results](evidence/web-push-stage-b/database.json).
- **14 worker policy groups** passed: payload sanitization/fallback, endpoints, response classes 201/404/410/429/500/403/302, signature tamper/expiry/environment, disabled behavior, replay and disable-during-encryption. Mock submit functions only. [Results](evidence/web-push-stage-b/worker.json).
- **6 service-worker simulations** passed: no fetch cache, stable tags, malformed fallback, external-click rejection and warm/cold navigation. No real notification presentation. [Results](evidence/web-push-stage-b/service-worker.json).
- **16 inherited controller groups** passed against Stage B client changes. [Results](evidence/web-push-stage-b/lifecycle/controller.json).
- **8 Stage B actual-app browser groups** passed: informative/generic server preference, warm DM, mention Inspector, cold readiness/decoration bypass, wrong account, expired-session sign-in, unavailable source, push-owned attention and disabled-device attention fallback. Zero page errors/unexpected external requests. [Results](evidence/web-push-stage-b/browser.json).
- **14 inherited actual-app device/account browser groups** passed, including offline retries, reload/refocus, logout/account switch, access revocation, password recovery, delayed registration, unconfigured state, safe Sample creation and mobile fit. [Results](evidence/web-push-stage-b/lifecycle-browser/browser.json).
- **2 existing Sample/PDF checks** passed after resetting disposable fixture data left by the creation test: real local PDF preview and mounted Inspector/refocus preservation. Native tab commands did not emit hidden/visible events in this environment; this is not physical suspension certification. [Results](evidence/web-push-stage-b/adjacent.json).
- Existing normal startup full-sequence verifier passed the 1.85-second hold and continuously mounted shell. [Results](evidence/web-push-stage-b/startup/TenOps-full-results.json).
- Production webpack static export, TypeScript, targeted changed application/test lint and diff checks passed. The inherited Sample fixture's pre-existing `@ts-nocheck`/unused-variable lint findings are tracked separately; no new application lint suppression was added.

The source fixture omits unrelated schema and hosted configuration. It does not certify every hosted source RLS policy, an actual scheduled pg_net request, APNs behavior, device display, physical iPhone suspension or a hosted Edge deployment. Browser permission/subscription behavior is simulated. These are explicit pilot/release gates, not claims established by inspection.

## Cost and operations

Illustrative small-team assumption: 100 recipient events/day and two enabled installations per recipient yields about 6,000 initial submissions/month before retries. Adding mentions increases that proportionally. A one-minute sweep means 43,200 worker wakes/month plus roughly three DB RPCs per empty wake and three per prepared delivery, around 150,000 RPCs/month under that example. No idle always-on server is required. Indexes and bounded claims keep small-team queue work modest; measure hosted query time and oldest-due age before expanding.

Typical versioned JSON payloads are a few hundred bytes, with capped Unicode previews keeping them below Web Push's practical 4 KiB envelope. Encrypted overhead adds roughly a hundred bytes; measure actual vendor responses during pilot. At this scale, a month of run/delivery records is on the order of tens of MB including indexes, depending on fan-out/retries. Terminal retention is 30 days, not indefinite content storage.

Current [Supabase pricing](https://supabase.com/pricing) includes 500,000 Edge invocations on Free and 2 million on paid plans, then $2/million paid usage; existing plan/quota/egress and DB load must be checked before activation. Existing base hosting charges remain. No AI API, broker subscription, new dedicated server, App Store distribution or email path is introduced. Browser-vendor push services, network and OS policies remain dependencies.

Engineering owns oldest-due/failed/retry counts, heartbeat, auth/key failures and invalid subscriptions. Logs/inspection are count-only. Lost VAPID keys need controlled resubscription; restore databases with transport disabled and verify cutoff before reactivation. Kill switches stop new claims; rollback cannot retract informative banners already accepted by the vendor/OS. Preview content may have reached the lock screen before logout/access/preference revocation, which Product's informative-preview choice must accept.

## Remaining authorization and pilot gates

1. Product/Architecture review of this exact local candidate, informative lock-screen exposure and preview preference.
2. Separately authorized hosted schema/source-policy attestation and exact Stage A/B migration application. No applied migration is edited.
3. Approved environment/public-key configuration, distinct TenDev/TenOps VAPID versions/keys, dedicated HMAC/Vault values and server-only credentials. Nothing is installed here.
4. Function-specific signed-wake gateway configuration, worker deployment disabled, compatible frontend/service-worker release and disabled Cron setup. Do not merge dev wholesale or deploy the local fixture export.
5. Authorized HTTPS non-production physical iPhone pilot, covering install identity, denied/revoked permission, closed/suspended/locked/offline device, actual banners, multiple installations, account changes and expired-session taps. The code is ready for that separately authorized integration phase; physical iPhone delivery is not yet accepted.
6. Explicit activation of the approved environment/cohort, transport cutoff, worker flag and named periodic recovery schedule after all gates. No historical replay. Re-attest current canonical/release drift first.

Stop for Product and Architecture review. No remote push, merge, deployment, hosted migration, installed production secret, enabled Cron or live delivery occurred.


## Reproduce local validation

The database verifier resets only the purpose-created `tenops-push-stage-b-db` container. Start it with `postgres:17.6` and `--network none` as in this session, then run `node scripts/verify-web-push-database.mjs`. Do not point these fixtures at a hosted database. Pure worker/service-worker tests are `node scripts/verify-web-push-worker.mjs` and `node scripts/verify-web-push-service-worker.mjs`. The Edge encryption probe is `supabase/functions/_tests/web-push-edge-probe`, executable with the installed Edge runtime; it generates only ephemeral synthetic keys and does not send.

For the local review, build with explicit `NEXT_PUBLIC_SUPABASE_URL=http://localhost:3000`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=local-review-only`, `NEXT_PUBLIC_RBAC_MODE=enforced`, `NEXT_PUBLIC_DEV_BRANDING=false`, then start `WEB_PUSH_REVIEW=true ./node_modules/.bin/tsx scripts/start-sample-job-update-review.mts --fixture-auth` from this worktree. The fixture export must never be deployed. Run the Stage B browser verifier against this exact localhost origin. Stateful fixture creation persists until this review server is restarted; reset it before verifiers that require the original single Sample.
