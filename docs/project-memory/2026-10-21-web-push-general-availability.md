# Web Push general availability

Product authorizes diagnostics commit `263142d` and TenOps registration/delivery eligibility for every authorized active account, preserving explicit device opt-in. No new event types, automatic employee test messages, authentication changes or device enrollment are authorized or introduced.

## Candidate and boundary

Based on canonical main/dev `372a7007ada7c79b69278d6beb91d94896d5f953`, also served by both Pages projects before this release. Diagnostics cherry-picked cleanly as `29d1930`. All completed canonical UI/startup/Contacts/UPDATE work remains inherited; no application component or startup source changes. Persistent worktree `.worktrees/web-push-ga`, branch `release/web-push-ga`; other worktrees are preserved.

Forward-only `20261021190000_web_push_general_availability.sql` changes only private `web_push_enrollment_allowed` and `web_push_environment_source`. TenOps Settings/configuration/registration now accept active accounts, including read-only accounts. Source eligibility removes sender, recipient and Job pilot allowlists while still delegating to the existing authoritative DM/mention source/access rules. The original helpers' private grants/search paths are preserved. Deprecated rollout table rows remain intact but no longer restrict TenOps.

The shared Supabase project remains `vxdxjhazkqhpkwdqtobp`. TenDev keeps its separate pilot allowlists, registration/transport off and no Cron. No key/secret changes are required; environment-specific worker aliases and namespaces are preserved. TenOps keeps enabled registration/transport, existing cutoff and scoped `tenops-web-push` Cron (job 2, minute schedule). The migration does not modify subscriptions, generations, preview preferences, flags, cutoff, queue, Cron or historical notifications. Unregistered devices remain off. No historical notification replay/backfill occurs.

Failure-only diagnostics retain the existing 4-second RPC deadline, 5-second provider deadline and retry/recovery contract; no private payload logging. See [diagnostic contract](2026-10-21-web-push-worker-diagnostics.md).

## Focused validation

Tier 3, focused Testing Level 3. Eight narrowly inspected hosted function bodies match released migration definitions, security-definer search paths and expected grants. Seven local PostgreSQL GA delta groups pass using the existing disposable network-isolated fixture; the historical 33-group battery is reused. Covers unchanged devices/functions, noncohort Settings/configuration, owner/idempotent/origin registration, no backfill and unregistered exclusion, noncohort DM/Job eligibility with operational-read checks, inactive/anonymous/private-table rejection, previews and revocation. Existing worker verifier passes 18 groups. TypeScript, targeted ESLint and diff checks pass. Evidence: [database](evidence/web-push-ga/database.json), [worker](evidence/web-push-ga/worker.json).

No frontend behavior change requires repeated physical-device acceptance; existing Production cold DM first-tap and Job Update deep-link acceptance remain applicable. No automatic test notifications are sent. Essential deployment verification will record real project configuration/export/worker state and authenticated-role registration visibility checks, without registering employees' devices or creating accounts.

## Release execution and recovery

Deploy diagnostic TenDev worker and real-config TenDev Pages export first; verify disabled worker and exact served assets. Then release the same candidate to TenOps, preserving active recovery. Apply only the reviewed GA migration and exact ledger version in a bounded atomic transaction with drift checks. Verify all active existing accounts' owner-authenticated Settings/configuration contracts, existing registrations unchanged, source grants/private tables unchanged, TenDev off and exact Cron preserved. Do not run general migration push.

If GA access must be restricted again, restore only the two prior helper definitions in a new forward-only change (existing pilot allowlist rows were retained). Existing device ownership/revocation must remain available. The existing Production transport/worker/registration kill switches remain available; disabling the named Cron is an additional stop control. Do not drop schema or replay delivery records. Final execution evidence and deployment IDs follow in the release record.

## Executed release

Runtime release SHA **`c99316c1ec30463c40333a3f725857b0de6eb9f8`**. Canonical main/dev were advanced atomically after TenDev verification with automatic-build skip markers, preserving deployment order. A subsequent documentation-only audit commit requires no redeployment.

| Target | Pages deployment | Worker version / function ID |
| --- | --- | --- |
| [TenDev](https://tendev.pages.dev) | `bc73f0d1-4938-4d75-b825-fb16b87ec31d` | 26 / `0248da3c-43fe-44e5-84f9-71f35422c401` |
| [TenOps](https://tenops.pages.dev) | `20538973-44e1-4d9e-87bf-52b0b0b66ab1` | 15 / `3449d184-907b-4a78-bb1c-e94f095643ee` |

Both real-config Production builds passed; served root, Settings, manifest, service worker and referenced runtime assets match the exact exports. Service-worker scope, MIME/no-cache headers and absent review routes passed. Project configuration digests and manifest identities are unchanged. Read-only hosted worker-bundle inspection confirms failure-only diagnostics and the unchanged four-second RPC deadline in both aliases. TenDev returns disabled HTTP 503; enabled TenOps rejects unsigned wakes with HTTP 401. No secrets were installed, rotated or printed.

Only `20261021190000` was applied and ledgered atomically with exact prior-function hashes, active-transport and named-Cron guards. **All seven active existing accounts** passed owner-authenticated SQL-role Settings/configuration probes, without real employee logins or authentication changes. An existing noncohort account reached ordinary `Invalid device ID` validation in the registration function using null ID/empty payload inside a rolled-back transaction; no device was created. Existing three subscription rows (including disabled historical registrations), owners, generations, enabled flags and preview preferences were compared unchanged. Direct subscription-table reads and helper execution remain denied to browser and service roles. No source messages, updates, accounts or employee notifications were created.

Production registration and delivery remain enabled, now for all authorized active accounts with per-device opt-in. TenDev registration/transport remain off and its pilot allowlists untouched. No cutoff, key, dispatcher or Cron command/schedule change. Job 2 `tenops-web-push` remains active at `* * * * *`, command `select public.dispatch_tenops_web_push();`. Scheduled runs at 19:51 and 19:52 UTC succeeded and consumed fresh signed wakes; worker HTTP 200 count-only responses were all zero. Pending work is zero. No speculative timeout/retry changes were introduced and the historical intermittent failure cause remains unproven.

The existing physical iPhone DM first-tap and @mention acceptance is reused; no new physical test or employee test notification was requested. Newly eligible users must explicitly enable each supported device. The disposable local PostgreSQL verifier was stopped after validation. No release blockers remain.

Evidence: [TenDev export](evidence/web-push-ga/tendev-served.json), [TenOps export](evidence/web-push-ga/tenops-served.json), [migration](evidence/web-push-ga/migration-application.json), [existing-account access/isolation](evidence/web-push-ga/hosted-verification.json), [scheduled worker health](evidence/web-push-ga/health.json), [Production diagnostics bundle](evidence/web-push-ga/tenops-worker-source.json).
