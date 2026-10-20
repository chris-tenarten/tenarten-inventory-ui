# TenOps Web Push worker

Stage B local candidate. Outbound delivery defaults off. Do not deploy or install configuration from this candidate without separate authorization.

`index.ts` uses pinned MIT-licensed [web-push 3.6.7](https://github.com/web-push-libs/web-push/tree/v3.6.7) only for VAPID signing and RFC 8291 `aes128gcm` request generation. It never calls that library's HTTP sender. Native fetch validates the vendor endpoint, rejects redirects, and times out after five seconds. `core.mjs` holds testable policy and the bounded handler. The installed Supabase Edge Runtime 1.74.3 successfully generated encrypted requests; the actual function also booted with no installed secrets and returned disabled. This verifies local runtime compatibility, not hosted configuration or APNs delivery.

## Authentication and execution

A request contains `v`, `environment`, `run_id`, integer Unix `exp`, and hex HMAC-SHA256 `sig`. The canonical signed bytes are `v1\n<environment>\n<run_id>\n<exp>`. Reject expired or more-than-120-second-future signatures, environment mismatches, malformed bodies and requests larger than 2 KiB. Body reading has a two-second limit. The database must atomically consume the matching unexpired run once before claims. Capture of a queued signed request permits only a race for that same bounded run, not arbitrary recipients/content or replay.

The prepared SQL dispatcher signs with a dedicated restricted Vault value and sends only short-lived claims/signature. It never queues a reusable worker secret, service-role key or VAPID private key. Its only HTTP action is a periodic scheduler request, outside the message transaction. No immediate network wake is performed by the notification trigger. A one-minute recovery sweep is the initial design, so submission latency can include up to one sweep interval before vendor/OS delays.

Gateway JWT verification must be configured **only for this function** to permit the custom signed-run handler (the dispatcher deliberately supplies no reusable bearer credential). Review a function-specific `verify_jwt=false` deployment option together with the HMAC/replay gates; do not change any other function or global gateway settings. Merely disabling gateway verification without these handler checks is not a valid deployment. No gateway configuration was changed here.

Five claims per invocation, 90-second leases, 45-second processing deadline, four-second database RPC timeout and five-second endpoint timeout bound work. Unprocessed claims recover after lease expiry. Six maximum attempts, one-hour event expiry, 30-second initial exponential backoff with jitter, Retry-After and 15-minute delay cap are enforced. A 2xx response means submitted, never proven device display. 404/410 revoke the matching subscription generation; 429/5xx/timeouts retry. Authentication failures do not revoke devices. Sanitized outcomes carry no message text, endpoints or provider response bodies.

## Configuration required later

- Existing Supabase runtime URL/service credential remains server-only.
- `WEB_PUSH_ENABLED`: literal `true` only after explicit activation; absent means disabled.
- `WEB_PUSH_ENVIRONMENT`: one trusted environment key, matching the signed wake and DB configuration.
- `WEB_PUSH_WAKE_SECRET`: dedicated random HMAC secret, at least 32 characters, never frontend-visible; matching restricted Vault value `web_push_wake_<environment>`.
- `WEB_PUSH_VAPID_KEYS`: JSON mapping approved key version to `{publicKey,privateKey}`. Retain old versions while subscriptions require them; no private keys in source or queues.
- `WEB_PUSH_CONTACT`: approved VAPID contact URI.
- Vault `web_push_url_<environment>`: exact trusted HTTPS Supabase worker URL.
- Approved `web_push_environments` rows: exact origin, matching public key/version and registration flag. No rows are seeded by migrations.
- Approved `web_push_transport` rows with explicit future activation cutoff. Keep disabled until validation. No trigger backfill or historical replay.

TenDev and TenOps must have distinct origin/configuration bindings and VAPID versions/keys. If hosted Edge function configuration is shared, explicitly select a single environment or separately authorize deployment topology before activating both; do not silently reuse one environment's signing/VAPID configuration for the other. This is one worker implementation, not a requirement to give it authority over every environment.

## Activation and recovery gates

1. Review Product's local UX and preview exposure, then authorize exact migrations for the target database. Stage A/B definitions and grants were tested locally; hosted source tables/policies, extensions and function gateway still need narrow attestation.
2. Authorize dormant schema and operations setup separately. Require `pg_cron`, `pg_net`, `pgcrypto` in `extensions`, Vault and necessary grants. `operations/web-push/setup.sql` prepares a private dispatcher but does not create/enable Cron.
3. Authorize keys/configuration installation and function-specific gateway settings. Deploy the worker disabled. Verify its environment, public-key correspondence and negative authentication gates without live recipients.
4. Deploy the compatible frontend/service worker through the approved release boundary. Perform a separate physical iPhone HTTPS non-production acceptance using explicit pilot authorization.
5. After acceptance, authorize a disabled one-minute Cron schedule and then explicitly activate registration/transport, cutoff, worker flag and named schedule for the approved cohort/environment. Confirm no historical catch-up. Do not infer enablement from deployment alone.

Kill switch: disable the target transport row first, then worker flag and named Cron. Keep in-app notifications and historical records intact. Inspect count-only outcomes/oldest due/heartbeat via `operations/web-push/inspect.sql`; a run consumed without queue progress needs engineering investigation. Reclaim only unexpired leases/retries after repair. Never reset submitted deliveries wholesale. Terminal records prune after 30 days when the worker runs; if delivery remains disabled, separately approved maintenance must perform retention rather than enabling delivery for cleanup.

Backups/restores start disabled; verify cutoff and prevent replay before reactivation. Wake-key rotation needs synchronized Vault/Edge changes. Lost VAPID private keys require controlled device resubscription. Roll back through kill switches and a reviewed frontend/worker candidate; schema corrections are forward-only. Already submitted OS banners, including informative text, cannot reliably be recalled after logout or later preview/access revocation.
