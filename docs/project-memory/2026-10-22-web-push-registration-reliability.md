# Web Push registration reliability — local candidate, October 22, 2026

**Implemented locally on dev, not deployed.** Base `28d2a00b46d05c7af4cc71a9c2ee3c808978a90d`. Chris's explicit October 22 Auth Recovery / Registration Reliability requests authorize this correction, read-only status verification and local dev commit only. Separate Advisory thread context is unavailable; no additional Product behavior is inferred. Tier 3 / focused Testing Level 3 because auth, privacy and an owner-status contract change.

## Behavior and security

Temporary auth restoration/profile-verification errors now suspend client push operations and invalidate pending work without deleting the opaque device binding, unsubscribing, or creating a revocation tombstone. A verified same-account recovery resumes the existing binding. Protected app access still fails closed through the existing failed/pending access states. Existing same-login continuity remains intact. Explicit sign-out, actual identity changes, password recovery/update, explicit Disable, permission revocation and confirmed inactive/missing/denied access retain deliberate cleanup. When cleanup follows suspension, the owner is recovered from the binding but the RPC still pins/verifies the actual authenticated owner; another account cannot revoke it. Offline revocation keeps the existing owner-bound tombstone retry behavior.

Settings clears the prior confirmation when a check starts and distinguishes **Checking**, **Registered**, **Unable to verify**, and confirmed **Not registered**. Browser subscription lookup is now bounded. Registered requires granted permission, a local subscription, owner/opaque-ID/generation match, exact origin scope, and matching SHA-256 endpoint fingerprint. RPC errors, unsupported verification metadata and fingerprint mismatches produce unverified state without destroying or replacing the binding. Confirmed missing/revoked server status shows Not registered without mutating the registration during that status lookup. Explicit user recovery remains available; there is no silent enrollment or resubscription. Known browser permission revocation/expiry retains existing cleanup.

No worker, queue, retry, provider, preview-delivery, source authorization, Cron, startup animation or unrelated app behavior changes. Raw endpoints, encryption keys and service credentials are not logged or added to local storage. The fingerprint is computed transiently; server output remains authenticated-owner/exact-origin scoped.

## Prepared migration — NOT applied

`supabase/migrations/20261022160000_web_push_registration_verification.sql` adds `endpoint_hash`, `environment`, and `key_version` to the existing JSON status function, preserving its signature, owner/origin/active-account checks, security-definer search path and restricted grants. It writes **no subscription or configuration rows**. Old clients ignore the extra JSON keys. A new client against the old status contract fails closed as Unable to verify and preserves the binding.

At an approved release, narrowly verify predecessor and existing grants, apply/ledger this exact forward migration **before the new frontend**, then verify scoped status and deploy through the normal TenDev→TenOps flow. No worker redeployment, secret change, device reset or Cron change is needed. Migration application and deployment remain separate Product authorization gates; neither occurs here.

## Focused validation actually performed

- **24 controller groups** in existing `scripts/verify-web-push-stage-a.mjs`: temporary failure/same-owner recovery, suspended-owner sign-out and confirmed denial, account switching, explicit disable, permission/expiry cleanup, offline tombstones, identity mismatch, safe enrollment-key rotation, missing/revoked status, bounded stalled lookup and adjacent existing lifecycle checks. Injected SDK/browser only; zero real provider requests.
- **5 PostgreSQL delta groups**, existing network-none disposable fixture via `WEB_PUSH_DATABASE_FOCUS=registration`: existing row/generation preservation, exact hashed identity output without raw material, wrong-account/origin and anonymous/service-role denial, expiry/transport truthfulness, owner revocation and inactive-account rejection. Hosted schema untouched.
- **12 selected actual-component browser groups**, existing AuthProvider/Settings verifier with local intercepted transport: failure→same-account recovery and same-login JWT session-id rotation, access blocked while failed/fresh verification pending, real account-menu sign-out, identity switching/stale replies, confirmed denial, password recovery, initial verification failure with neutral retry, Checking/Registered/Unable to verify, endpoint mismatch and confirmed server revocation. No page errors, external requests, hosted writes or real account/device enrollment. Existing broad suites were not rerun.
- TypeScript, targeted ESLint, diff checks and isolated Production webpack export passed. The export used dummy loopback configuration and is **not deployable**. Earlier fixture runs needed a complete synthetic service-worker adapter and the current account-menu selector; those were test setup corrections, not application defects.

[Controller](evidence/web-push-auth-recovery/controller.json), [database](evidence/web-push-auth-recovery/database.json), [browser](evidence/web-push-auth-recovery/browser.json), [validation](evidence/web-push-auth-recovery/validation.json).

## Read-only Production status

Snapshot **October 22, 2:14:55 p.m. America/Chicago**. All accounts active and GA-eligible; current registrations below are enabled, generation 1, with no expiry timestamp and no revocation. Source-event authorization and actual iPhone presentation remain separate checks.

| Account | Active devices | Generation | Expiry | Revocation | Delivery eligible | Previews |
| --- | --- | --- | --- | --- | --- | --- |
| Chris (regular) | 1 | 1 | None recorded | No | Yes | On |
| Patrick | 1 | 1 | None recorded | No | Yes | On |
| Marcos | 1 | 1 | None recorded | No | Yes | On |
| Gio | 1 | 1 | None recorded | No | Yes | On |
| Anthony | 1 | 1 | None recorded | No | Yes | On |

Chris's historical generation-2 revoked row remains intact and is excluded from the active count; his replacement is healthy. **No re-registration is presently needed for any of the five.** Production transport and existing minute Cron were verified enabled; no hosted mutation occurred. [Selected status evidence](evidence/web-push-auth-recovery/production-status.json) includes only requested registration metadata, no endpoint/keys/content.

If a future device is genuinely absent/expired/revoked: its owner opens the installed TenOps Home Screen app, signs in normally, uses Settings→Device notifications→Enable and grants permission; after successful verification it should say Registered. A fingerprint mismatch or temporary verification failure should first be retried after connectivity/account verification recovers; do not revoke a healthy registration as a diagnostic action. No impersonation, remote subscription creation or credential reset is used.

## Review boundary and artifacts

Commit locally on dev only. No push, migration application, deployment, Production configuration/data mutation or live test notification. Physical iPhone acceptance of this new client is pending a later approved release; synthetic checks do not establish OS presentation. Existing Production registrations and delivery remain unchanged.

Reused root dev workspace and existing fixtures. Isolated archive/build/browser artifacts are task-owned under ignored `.tmp-push-auth-recovery/`; no new worktree. Internal validation port 3379 was used to preserve the existing localhost:3000 review process; the task-owned server and disposable database were stopped. Previous investigation/Contacts working files remain preserved and excluded from this commit. This record owns the candidate evidence; Current State receives only its own additive candidate pointer, not unrelated uncommitted investigation notes.
