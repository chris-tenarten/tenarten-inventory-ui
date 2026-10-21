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
