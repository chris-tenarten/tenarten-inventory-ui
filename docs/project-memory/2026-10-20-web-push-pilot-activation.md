# Controlled TenDev Web Push pilot — hosted registration ready

2026-10-20. Tier 3 / focused Testing Level 3 hosted integration. Product explicitly authorized exact A/B/pilot migrations, fresh scoped keys, TenDev frontend/worker deployment, the existing account cohort, supervised physical iPhone delivery and shutdown. No company-wide activation or persistent Cron is authorized. No new login accounts, credential changes or login UI modifications are permitted.

## Canonical reconciliation

The prior Contacts stop checkpoint was superseded by fresh Cloudflare evidence: both TenDev and TenOps now successfully serve canonical `5e73284ece13f69016efa1c85c6a8befe66f76bb`. Main/dev refs match that revision. Pilot candidate `800f414dceaf6c65aa8cd980e53437b4f13b24fb` already has that ancestor; no source drift or new application implementation was needed. Production deployment and both project configurations remained unchanged during this activation.

## Approved existing cohort

Read-only inspection unambiguously identified recipient Chris Ngo (regular admin account) and sender chris developer (developer account), both active with Messaging/write and operational-read capabilities. Existing unarchived Job `DEV-20260803` / `chris-dev-test` is the one pilot Job. Product's explicit existing-account instruction supersedes the readiness runbook's dedicated-test-account wording. No new accounts or Jobs were created. No private conversation content was read. The private server allowlists contain exactly those two accounts and that one Job; no other account is enrolled.

## Applied and deployed

- The three reviewed SHA256-verified migrations were applied in one transaction in order: `20261020200000`, `20261020210000`, `20261020220000`, together with only their migration-ledger entries. No general migration push or legacy migration was used.
- Hosted RLS and direct grants, owner configuration boundaries, exact cohort, validated TenDev-only constraints, disabled transport and absence of push Cron all passed focused checks.
- Fresh TenDev-only VAPID and HMAC material generated and installed in only `TENDEV_WEB_PUSH_*` settings and the two scoped Vault entries. The VAPID contact is the existing regular account's company email URI. No private secret values are included in evidence. Existing project runtime service credentials remain server-only and unchanged.
- `send-web-push-tendev` alone deployed with its reviewed function-specific JWT exception and custom HMAC/replay authentication; generic/Production worker not deployed. Private SQL dispatcher installed without any Cron.
- With registration and transport disabled and no subscriptions/deliveries, the worker handler was temporarily enabled solely for hosted authentication integration. Missing/tampered/wrong-environment/expired signatures returned 401; oversized body 400; a Vault-signed single-use zero-queue run returned 200 with claimed=0/submitted=0; replay returned 409. The handler was restored disabled in finally, verified by HTTP 503.
- Real TenDev export built from exact candidate using actual public Supabase configuration and TenDev branding authority. No local review adapter/login/CORS changes or private worker references in exported JS; manifest identity unchanged. Existing normal authentication remains intact.
- TenDev deployment `89b370b1-07e2-4561-a059-34d60ce71aa3` serves the exact approved index, Settings, service worker, manifest and referenced runtime assets. Service worker MIME/root-scope/no-cache headers verified. Review routes return 404. TenOps deployment and configuration digest unchanged.

## Current safe waiting state

Pilot URL: https://tendev.pages.dev/settings . Registration is enabled only for the approved TenDev cohort; Production configuration remains null. Transport is disabled, worker flag is false and no push Cron exists. No actual push submission or notification-creating test event has occurred. The one consumed run was a zero-queue authentication check, not delivery.

The iPhone holder was asked to open TenDev in Safari, Add to Home Screen, launch that installed app, sign in with the existing regular account, and explicitly enable device notifications in Settings. Wait for actual device registration and the holder's readiness before enabling any delivery. A desktop/simulated subscription is not physical acceptance. No authentication changes or synthetic login UI are allowed.

On readiness, inspect only safe owner/count metadata for the real iPhone subscription; do not print endpoint or keys. Follow the already-authorized supervised sequence, fresh cutoff, only approved sender/recipient/Job, minimal manual wakes, and physical observation. No broad rollout. If Cron is used at all, disable it before ending the pilot. After tests disable transport, worker and registration and revoke pilot devices per the runbook. Already submitted OS banners cannot be recalled reliably.

Evidence is under `evidence/web-push-pilot-activation/`. Original 33-group database and local lifecycle/encryption/browser evidence was reused; only hosted integration, release build and exact served artifact checks were run. Physical iPhone delivery and display remain pending, not accepted from simulation.

## Supervised physical pilot in progress

The holder reported successful iPhone registration and readiness. Safe subscription inspection confirmed exactly one enabled Apple subscription, owned by the approved regular account, generation 1, TenDev key version, previews enabled. Delivery was activated with a fresh cutoff; worker enabled only after cohort/isolation checks and readiness. Cron was never created.

Test events are initiated through the existing Messaging/Job Update functions under an authenticated SQL role and the explicitly approved developer identity claim, retaining current account/capability/source checks. This is a trusted administrative test invocation, not proof of a fresh interactive developer login. No auth users, credentials, login UI or access policies were modified. No prior conversation content was read.

The first DM was created in the activation transaction; its transaction-start notification timestamp predated the clock-time activation cutoff. The no-replay guard correctly excluded it (eligible source/cohort, zero queue, zero submissions). It was retained and never backfilled. A fresh DM in a later transaction queued exactly one delivery, accepted on attempt 1; worker counters claimed=1/submitted=1/skipped=0/failed=0. The holder confirmed the actual iPhone banner appeared; tap/preview details remain pending. Provider acceptance is distinguished from physical observation.

## Tap/reload lifecycle stop and correction

Physical holder reported an initial connection/retry notice on notification tap. Owner-scoped SQL resolution returned the correct developer destination; anonymous REST probe returned expected function permission denial (RPC is in the API schema). User Retry opened the correct conversation and explicitly confirmed no decorative startup. Record first-tap recovery as an observed limitation, not a clean first-tap pass.

Transport and worker were disabled during investigation. A subsequent guarded mention setup found the device had been revoked (generation 2) during reload/recovery; its transaction stopped before any mention was created, and its catch restored both kill switches. No second device notification was sent. No Cron exists.

Code inspection identified a same-login SIGNED_IN/TOKEN_REFRESHED event arriving while bootstrap profile verification is pending as a device-cleanup race: existing code classified it as a session boundary solely because no profile had yet been accepted. A narrow push-only exception now preserves the stored binding when the pending session is demonstrably the same login. It does not preserve the profile/access decision: normal verification, generation invalidation, password flows, real new sessions and account switches remain unchanged. Nine focused browser lifecycle checks, including delayed bootstrap and same-user/different-login negative cases, passed; TypeScript, targeted lint, diff check and build passed. No database contract changed or broad database battery rerun. Physical re-registration and reload preservation still need verification after TenDev redeployment.

Corrective candidate `77a8d6e768f661bec69b571601207f69b01183e6` passed all nine targeted lifecycle and eight existing notification-entry browser groups, plus build/TypeScript/targeted lint/diff. A new real TenDev export was built and deployed only to TenDev (`1627fe4f` URL; full deployment ID in corrected served evidence). Exact served assets and unchanged TenOps/configuration verified. No additional migrations or worker code changes. Device registration is available for the cohort, but worker and transport remain disabled and no Cron exists while the holder re-registers and verifies close/reopen preservation.

## Corrected physical observation — resume diagnosis

The holder corrected the initial “still registered” response: after reopening the UI looked unconfigured / like first-time setup. **Do not count registration persistence as passed.** The temporary “pause” instruction was clarified as “hang on,” followed by “proceed.” The attempted pause-verification command was rejected before execution; no claim that it changed hosted state.

Fresh read-only hosted verification on resumption: registration remains enabled for exact TenDev origin, cohort=2, Job=1, transport=false, active push Cron=0. The original device row is revoked generation 2; the newer regular-account row remains enabled generation 1. Thus the corrected observation does not demonstrate another server-side revocation. It may reflect client verification/installation state; exact visible Installation/Permission/registration labels were requested before further physical delivery. No further notification or mention was created. Worker was last successfully set false by the mention setup catch.

## Final clarification and mention authorization gate

The holder clarified the reopened state: Enable is greyed out and Settings says “Registered on this device” / “Delivery is inactive in this environment.” This is the expected registered state under the transport kill switch. Supersedes the earlier impression of unconfigured UI; do not present it as a confirmed configuration-loss defect. No speculative Settings patch was made. The newer server registration remains enabled, matching this observation.

The next mention attempt passed the exact-device/pending-work guards but was rejected by the existing create_job_update_with_mentions function: `42501`, `postJobUpdate`. Its transaction rolled back before creating the update/notification/delivery; catch disabled transport and worker. Read-only effective checks confirmed developer messaging.write=true, developer postJobUpdate=false, regular postJobUpdate=true. Earlier broad capability inspection did not attest this source-specific post permission; retain the existing authorization boundary. No grant, role, credential or authentication change was made. Product was asked only whether to use the already-approved regular account for a self-mention on the existing approved Job, plus current phone readiness. No more push until that choice/readiness is known. Cron remains absent.

## Explicit developer posting authorization

Chris explicitly approved enabling @mention posting on his existing developer account. New append-only `20261021090000_account_job_update_posting.sql` follows existing per-account capability patterns: a false-by-default `app_users.job_updates_post` flag, constrained by active-account and read-only restrictions; original role permissions remain unchanged. The owner-only access response appends the flag with its authenticated/service grants preserved. The client understands the optional field; older responses default false. Only the approved developer account will be set true through separate targeted, audited SQL, not seeded by the generic migration. No edit/assignment/admin capabilities, role-wide grants, credentials or login UI changes. Because both apps share the database this is an account-level posting permission; Production push remains disabled and no Production frontend is deployed.

Eight focused real-database/client permission groups passed on the existing network-none PostgreSQL fixture: default-off, exact-account scope versus unrelated developer, no implied privileges, inactive/read-only denial, owner-only profile compatibility, anonymous/direct-update denial, client/server matching, and revocation. TypeScript, targeted lint and diff check passed. Original transport database battery was not rerun.
