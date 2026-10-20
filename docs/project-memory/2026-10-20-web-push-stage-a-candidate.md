# Web Push Stage A local candidate

Prepared October 20, 2026 for Product and Architecture review. Branch `feature/web-push-stage-a`, persistent worktree `.worktrees/web-push-stage-a`, based on `051f23b81947577c2f4a91fb863df372342622bb`. Local implementation and commit only; no migration application, hosted mutation, deployment, secret installation, push to Git, or outbound device push.

## Current boundary

Fresh remote main/dev were both `051f23b81947577c2f4a91fb863df372342622bb`. Read-only Cloudflare project calls confirmed successful canonical TenOps deployment `2f5e90a3-e120-4cde-9b39-afd29eca703f` and TenDev deployment `6e794e8a-175c-41a8-9d3f-76ea442dfd41`, both at that revision. This updates the earlier investigation snapshot; it is control-plane verification, not new served-byte certification. Other feature worktrees and root untracked release receipts remain intact.

## Implementation and review

Open [Settings review](http://localhost:3000/settings#notifications). The actual exported application runs through the existing synthetic Sample review adapter. A persistent yellow notice identifies simulated permissions/subscriptions. Enable, disable, denial, registration status, retry and mobile installation guidance use the actual `PushNotificationSettings` component and AuthProvider. Review is local only; never deploy this fixture export. Port 3000 previously belonged to the completed Manpower progressive review process; its command and worktree were confirmed before it was stopped. The Stage A review replaces only that process.

The localhost fixture has a synthetic authenticated account, in-memory Sample library and creation, and existing local PDF renderer. Open `/samples` to review those adjacent paths. It blocks hosted requests using the existing CSP and `--fixture-auth` mode. No live account or credentials are needed. Mock subscriptions use inert Apple-shaped URLs and a synthetic public key; no HTTP request is sent to those URLs. Permission prompts and subscription creation are simulated; service worker registration is real. Manual iPhone Home Screen installation and delivery are not certified by this review.

The Settings section reports support, installation and permission independently from successful registration. It offers Enable, Disable and Check again, with recovery instructions. Delivery is explicitly inactive. Permission is requested synchronously from Enable, before asynchronous work. Nothing requests permission automatically. On an unconfigured environment, Enable remains disabled; no secret or configuration was installed to change that behavior.

`public/sw.js` registers at `/` when configured Settings is opened or Enable is selected. It contains install/activation only: no fetch handler, cache, push handler, network dispatch or notification display. `public/_headers` specifies no-cache for worker updates and root scope. Both existing manifest IDs (`/my-work` and `/`), start URLs, icons and startup animation source remain unchanged. Static export succeeded. The worker does not confer offline application support.

## Subscription and authorization contracts

Prepared migration: `supabase/migrations/20261020200000_web_push_device_registration.sql`. It is forward-only and has not been applied anywhere, including a local database.

- `web_push_environments` stores approved exact HTTPS origins, environment names, public VAPID key/version and a registration flag defaulting false. It has no seeded rows. Configuration selection uses the request Origin matched to trusted server rows; browser input alone cannot configure an environment. Origin matching is environment routing, not a replacement for authentication.
- `web_push_subscriptions` stores owner, environment, endpoint/hash, public encryption material, optional expiry, enabled/revoked state and monotonic generation. Unique environment/endpoint hash prevents duplicate rows. Endpoints remain reserved to their original owner even after revocation; account transfer by upsert is rejected.
- RLS is enabled. No direct table privilege is granted to anonymous, authenticated or service roles. A self-only SELECT policy is defense in depth; safe RPC summaries are the client interface. Private subscription material is never returned by those RPCs. Stage B will need a separately reviewed worker access contract.
- `get_my_web_push_configuration()` returns only public configuration for an active account. `register_my_web_push_subscription(uuid,text,text,jsonb)` derives owner from `auth.uid()`, checks active account, configured origin/environment/key, keys, endpoint syntax and optional expiry, and serializes an eight-active-device quota through the owner row lock. It does not grant business or messaging write capability. It returns ID and generation only.
- Duplicate registration for an already enabled endpoint with the same owner/keys/version returns the existing identity/generation. A revoked endpoint requires a fresh browser subscription. Foreign endpoint collisions are rejected.
- `get_my_web_push_subscription(uuid)` returns only owned enabled/expiry status and generation on the matching origin. Foreign/missing IDs both return null.
- `revoke_my_web_push_subscription(uuid,bigint)` supports an authenticated owner even after app deactivation/config disable, updates only a matching active generation, and increments that generation. Missing and foreign IDs are indistinguishable; it confirms no owned active row remains. Client cleanup pins the request to the original verified session and retains its tombstone if that identity is unavailable.

Endpoint registry is deliberately narrow: Apple hosts with a proper `.push.apple.com` boundary, `fcm.googleapis.com`, and `updates.push.services.mozilla.com`. It rejects other hosts, non-HTTPS, ports, userinfo, fragments, query strings, malformed paths, control escapes, overlong payloads, invalid key shape and expired subscriptions. Additional browser vendors or endpoint formats require explicit review. Stage B must repeat validation at send time, disable redirects and apply its own outbound network safeguards; Stage A performs no endpoint fetch.

## Account lifecycle

Only opaque device ID, owner UUID, generation and pending cleanup IDs are stored in browser metadata; no subscription endpoint/keys or auth tokens are copied there. Owner-sensitive RPCs use the verified current session token in an explicit Authorization header to prevent a later account switch from changing the request identity.

Normal bootstrap/reload and continuing token refresh preserve a valid registration. A genuine session change, sign-out, password-related sign-out or denied profile invalidates pending registration immediately. Explicit logout attempts server revocation before dropping credentials. Local cleanup closes existing notifications and unsubscribes, even when the server is unavailable. Cleanup calls have bounded network/browser waits; an unanswered permission prompt does not hold the serial cleanup queue.

Failed revocation leaves token-free tombstones for retry under the original account. Disable retries cleanup; startup reconciles tombstones for the current account. Errors explain when the original account is needed. The new account never silently takes over an endpoint. Invalid/missing/expired subscriptions and revoked permission are reconciled on Settings startup, focus, visibility return and Check again. There is no claim of background detection when the page never runs.

A server timeout can leave an uncertain registration; a provisional UUID is recorded before the request so cleanup can target it. Delayed successful responses are checked against the account generation and cleaned up rather than attached to a new account. Offline logout plus failed browser unsubscribe cannot establish instant remote revocation. No delivery exists here; Stage B must enforce current owner/generation, access and expiry immediately before submission, and Product must accept the already-submitted generic-banner limitation described in the architecture report.

## Validation evidence

Tier 3 implementation, focused Testing Level 3 contract/lifecycle scope, with database execution explicitly deferred. No independent-agent review is claimed. A self-review of the final diff examined permissions, SQL search paths/grants, owner-bound requests, stale work, endpoints and disabled delivery.

- `scripts/verify-web-push-stage-a.mjs`: **16 passed**. Browser/SDK adapters cover explicit gestures, permission denial/revocation, expiry, registration metadata privacy, continuing accounts, generation revoke, offline cleanup/retry, unsubscribe failure, unanswered permission at logout, delayed registration/account switch, independent new account and original-account tombstones. Worker/migration static boundary checks also pass. These are controller tests, not PostgreSQL enforcement tests.
- `scripts/verify-web-push-stage-a-browser.mjs`: **14 passed** against actual localhost Settings/AuthProvider/export. Real root worker, no CacheStorage entries, simulated permission/subscription, enable/disable, failed registration/retry, offline revocation, reload/refocus with same shell, explicit logout, account switch, lost session, profile deactivation, password-recovery sign-out, delayed registration switch, local Sample creation, unconfigured state and 390px mobile navigation. Zero page errors and zero unexpected external requests. No actual device push.
- Existing `scripts/verify-samples-access-refresh.mjs --affected`: **2 passed**, covering Sample library/Inspector revalidation and actual locally generated `%PDF` preview, plus three native tab-switch commands retaining the Inspector. The environment did not emit hidden/visible transitions, so this is not physical tab-suspension certification. Zero hosted writes/page errors; only Chrome's PDF-viewer internal resources were observed.
- Production-mode webpack static export, TypeScript `--noEmit --incremental false`, targeted application/new-script ESLint and diff checks passed. The reused Sample adapter retains exactly its baseline lint findings: one existing `@ts-nocheck` error and five existing unused-variable warnings; an ESLint API comparison confirmed no new findings ([comparison](evidence/web-push-stage-a/fixture-lint.json)). Build used explicit localhost public fixture configuration, not `.env.local`; no application secret was bundled. Review-only browser shims live under `scripts`, not application source or public assets.

Evidence: [controller results](evidence/web-push-stage-a/controller.json), [browser results](evidence/web-push-stage-a/browser.json), [adjacent checks](evidence/web-push-stage-a/adjacent.json), [desktop](evidence/web-push-stage-a/desktop-settings.png), [mobile](evidence/web-push-stage-a/mobile-settings.png).

Prepared SQL was inspected but not parsed/executed by PostgreSQL. Active/anonymous/foreign-user denial, direct table grants, duplicate/collision concurrency, quotas, exact origin matching and all migration statements still require a separately authorized disposable-database application and executable verification before any hosted application. Do not treat fixture or static checks as proof of deployed RLS. No hosted schema attestation was performed or needed for this local-only candidate.

## Stage B and authorization gates

Product review of this local UX/candidate comes first. Then separately authorize disposable database execution/verification, migration application, trusted environment rows and VAPID public-key configuration, and eventual frontend deployment. Neither manifest identity nor cross-environment registration should be changed implicitly. Keep TenDev/Production VAPID keys and environment bindings distinct.

Stage B still needs private outbox/per-device delivery ledger, eligible non-system direct-message events from `account_notifications`, current access/generation checks, secure signed worker invocation, encryption/library feasibility, retries/leases/TTL/deduplication, operational counters/kill switch, authenticated link resolver and foreground attention decisions. No outbox, sender, schedule, server secret or notification handler was added here. A device-list/remote lost-device management surface remains future work; the initial UI manages this installation.

Separate approval is required for every migration/configuration/secret/worker deployment and outbound enablement. Physical iPhone/Home Screen acceptance requires an authorized HTTPS non-production environment before rollout. Existing in-app notification and Messaging behavior is preserved. Stop for Product and Architecture review; this local commit is not release authorization.

Reproduce review from this worktree with the existing dependencies:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://localhost:3000 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-review-only NEXT_PUBLIC_RBAC_MODE=enforced NEXT_PUBLIC_DEV_BRANDING=false npm run build -- --webpack
WEB_PUSH_REVIEW=true ./node_modules/.bin/tsx scripts/start-sample-job-update-review.mts --fixture-auth
```

Use the exact localhost origin. Preserve port ownership discipline before starting. This fixture build must never be deployed.
