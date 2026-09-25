# Messaging operations bundle — prepare/review only

Application frozen at `5cbc69dd67d380baa0bf03b01ae65c9318f7889a`; this separate operations commit adds files only. No Product/transfer implementation changes. The original migration/bucket/CLI worker hashes remain approved and unchanged. No hosted execution is authorized by this document.

## Cleanup runtime and secrets

Dedicated existing-project Supabase Edge Function `cleanup-messaging-drafts`, with `verify_jwt=true` plus a dedicated invocation secret. `index.ts` supplies server-only Supabase credentials to the runtime-neutral core. Core preserves the approved CLI's claim/remove/finish algorithm, adding HTTP auth, deadlines and count-only monitoring. The CLI worker remains byte-for-byte unchanged.

Generate a random 32-byte secret, encoded as 64 hex characters, at authorized provisioning time. Do not put its value in Git, reports, command arguments or routine logs. Provision securely through the platform's secret interfaces:

| Location | Name | Value |
| --- | --- | --- |
| Supabase Edge secrets | `MESSAGING_CLEANUP_INVOCATION_SECRET` | Dedicated random value |
| Supabase Vault | `messaging_cleanup_invocation` | Same value |
| Supabase Vault | `messaging_cleanup_gateway_jwt` | Existing project **anon JWT**, not a publishable-key string or service-role key |

Vault names must each identify exactly one row; update the named entry on retry/rotation rather than creating duplicates. `dispatch_messaging_cleanup` rejects non-anon JWT payloads, and the Edge gateway validates JWT authenticity. Secret comparison hashes to fixed-length digests then uses native `timingSafeEqual`; missing/wrong secrets do not create monitoring rows or touch drafts. The endpoint accepts POST only, ignores caller payloads, and accepts only an optional authenticated run UUID header for monitoring—not a bucket/path/message target.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are existing server-side Edge environment values. The service credential bypasses RLS and is not bucket-scoped: this is explicitly a trusted maintenance endpoint. No extra user/Admin/anonymous grants are added. Dedicated invocation credentials allow only this fixed operation. The service key is never placed in Vault cron headers, browser bundles or client configuration. Avoid logging request headers; maintain platform/operator access controls for transient pg_net request queues and secrets.

Run `node scripts/prepare-messaging-cleanup-deployment.mjs` to stage only this function and explicit JWT config under ignored `.tmp-messaging-operations/deploy`. Later authorized deployment uses that workdir and the fixed project ref `vxdxjhazkqhpkwdqtobp`. Do not use `--no-verify-jwt`; do not deploy all functions. No code in the preparer accesses hosted services.

## Scheduler and monitoring

`cleanup-setup.sql` enables pg_cron/pg_net, requires existing Vault and the application cleanup RPC, creates restricted operational monitoring, and installs **one initially disabled** job:

- name: `tenops-messaging-abandoned-drafts`
- owner: applying privileged operator (`postgres` in the reviewed workflow)
- expression: `17 * * * *`
- command: `select public.dispatch_messaging_cleanup();`
- timezone must already be GMT/UTC; setup refuses a different global Cron timezone.

Reapplication preserves existing job activation, rejects a different schedule/command/owner, and does not duplicate jobs. Dispatcher endpoint is hardcoded to this project's cleanup function. It decrypts Vault values only inside the privileged function; no public/authenticated/service_role EXECUTE grant is exposed. Secret provisioning, function deployment and job enablement remain separate steps. Run setup as the same privileged owner on every retry.

`messaging_cleanup_runs` stores UUID/timestamps/status, pg_net request ID and claimed/cleaned/failed counts with bounded categories only. RLS is enabled; public/anon/authenticated have no privileges. service_role has SELECT/INSERT/UPDATE only; the dispatcher as owner prunes **these operational records only** after 30 days. No user content, paths, filenames, credentials or file bytes are logged. No routine participant-content bypass is added.

The handler has a 100-second work budget, <=15 seconds per request, then a separate <=5-second status-record attempt. pg_net has a 110-second timeout; Free-plan Edge limit is 150 seconds. HTTP 200 means completed run with no failed draft; 503 means claim/delete/finalize/monitoring/deadline failure. Missing/wrong secret is 401, wrong method 405. Errors are categorical; raw upstream errors are not logged. A monitoring failure prevents cleanup if initial recording fails; failure after cleanup produces 503 and leaves its prior run state visibly stalled if it cannot be updated.

Use `cleanup-inspect.sql` or SQL Editor to inspect last invocation/outcome/counts and last success. Queued/running >5 minutes is shown as **stalled**; no success for two hours means attention required. `cron.job_run_details` alone is insufficient because dispatch success only enqueues HTTP. Edge Function invocation logs provide the count-only result and HTTP status. Run records persist independently of transient pg_net responses.

V1 monitoring is an explicit operator duty, not an unconfigured alert service: Chris/release operator checks the initial authenticated invocation, the next minute-17 invocation, and the inspection output each working day. After any observed failed/stalled run, inspect immediately and retry after correction. No automatic email/Slack/pager notification is claimed. Hourly runs retry automatically; escalate repeated failures or backlog/quota pressure. `cleanup-disable.sql` pauses only this job; `cleanup-enable.sql` requires a successful authenticated run within the last hour and is retry-safe. To verify the endpoint before enabling, privileged operator invokes `dispatch_messaging_cleanup()` and inspects its run's final status. With no stale drafts it is a zero-cleanup run; otherwise it performs authorized cleanup, so never invoke hosted during read-only review.

## Guarded deletion contract

Only drafts with `coalesce(upload_touched_at,created_at) < clock_timestamp()-interval '7 days'` are eligible. Claim limit 50; heartbeats protect active transfers. Idle drafts may be recovered within the grace period; seven-day inactivity deliberately ends retention. There is no arbitrary size/type filter and no expedited deletion of recently failed uploads.

Claim locks and marks canceling, serialized against finalize. Only exact returned paths under the claimed UUID are accepted, only in `my-work-inbox-attachments`, Storage removal batches <=100. Caller payloads cannot select objects. Finalize cleanup only after every Storage request succeeds; the SQL finish RPC independently rejects remaining objects or inappropriate state. Partial/ambiguous deletion leaves canceling state for retry, never deletes finalized metadata. Duplicate requests/claims are safe through idempotency; claim locks are not a durable HTTP lease. No unrelated buckets, ready messages/attachments or raw storage.objects deletions. Incomplete TUS fragments use provider expiry (up to 24 hours), separate from completed draft object cleanup.

## Attachment-only release order

1. Reconfirm frozen app SHA, operations SHA/hashes, current Production base, unused migration version, private bucket baseline, global 52,428,800 ceiling and historical fingerprints. No plan/global/other-bucket change. Prepare the Production-branded client from frozen application SHA in independent ignored release output with real public build configuration; never deploy this worktree's synthetic `.env.local` build.
2. Apply `transition-setup.sql`. Notify users through separately authorized operator communication: attachments briefly unavailable, text/history continue. Apply `pause.sql` to revoke only new legacy attachment-draft creation. Existing uploads retain finalize/cancel rights.
3. Poll `select count(*) from public.my_work_messages where delivery_status='draft';`. Wait for users to finish/cancel. After ten minutes, postpone rather than force-delete. `drain-barrier.sql` takes a short 5s-timeout table lock, rechecks zero and installs a Messaging-only restrictive Storage INSERT barrier. Brief DDL contention is possible; no global app maintenance mode.
4. Run `node scripts/prepare-messaging-transition.mjs`. It hash-checks the frozen migration and prepares `.tmp-messaging-operations/apply-migration-paused.sql`: exact migration body plus guard/revoke/state in **one transaction**. Apply only that reviewed generated SQL; do not also apply the original file. A failure rolls back all new schema/grants, retaining pause/barrier. Immediately verify and record original migration version `20260925120000` through the authorized ledger workflow; never blanket db push against the sparse historical ledger.
5. Apply the exact approved Messaging bucket SQL; verify private 50,000,000 bytes/MIME NULL and unchanged global/other buckets. New transfer-entry remains revoked. Legacy creation remains revoked permanently.
6. Apply cleanup setup (job disabled), securely provision secrets, deploy only the JWT-verified adapter, invoke/verify authenticated endpoint and denied requests, then enable Cron. Ensure monitoring is ready. Do not age real drafts or create hosted fixtures unless separately authorized.
7. Promote/deploy exact application SHA (not operations branch tip). Verify Pages source/deployment ID, Production configuration, text/history and readable 50 MB/200 MB limits. Hard refresh an authenticated browser and verify the new composer. `attest-client.sql` records the independently verified SHA/deployment UUID; it is an operator attestation, not a substitute for browser verification.
8. Apply `reopen.sql`: it requires exact client/refreshed attestation, correct private bucket, active exact-cadence job and recent successful cleanup. It atomically grants new transfer entry and drops the INSERT barrier, leaving legacy creation disabled. Retry is safe. Run only narrow authorized small hosted smoke and historical integrity comparisons; do not rerun large-transfer suites.

No broad text/history grants are revoked at any stage. During the short attachment pause the existing UI surfaces an attachment error; no new maintenance UI is invented. Stale clients must refresh; they cannot use the legacy path afterward.

## Abort and recovery

- Before migration commit: `abort-before-migration.sql` restores only the recorded legacy authenticated EXECUTE grant and removes barrier; repeat is safe. Refuses once new migration exists.
- Migration failure: transaction rollback leaves old schema and barrier; inspect actual state on response ambiguity before retry or safe pre-migration abort.
- Bucket/function/scheduler/client failure after migration: keep new entry closed and barrier installed. Correct forward; do not restore legacy upload contract or lower constraints over persisted rows. Reopen gate refuses missing bucket, scheduler success or client attestation.
- After successful release: `hold-new-uploads.sql` closes new entry and clears deployment attestation while preserving status/heartbeat/recovery/cancel and existing transfers. It does not indiscriminately abort active transfers. For unsafe object completion, install a separately reviewed Messaging INSERT barrier after assessing drafts; do not use the zero-draft drain gate to delete active work.
- Authorization incident: stop new transfers; contain affected reads with a separately reviewed restrictive Messaging policy if needed. Never make Storage public or weaken participant authorization. Already issued signed URLs can remain valid for their 600-second lifetime; do not claim instant revocation.
- Suspect cleanup safety: disable only the cron job/endpoint; preserve drafts/objects for review. Storage errors retry normally and cannot justify broad deletion.

## Git boundary and validation

Keep remote main promotion separate from this operations commit. Use an independent bare promotion repository under ignored output, verify exact base ancestry, and push only frozen app SHA to remote main with an exact expected-base lease after backend readiness. Do not change remote dev, normal checkout refs/index/files, or merge operations into the concurrent Planning tree. Deploy the reviewed operational bundle separately and record both SHAs. Stop on any branch-protection rejection rather than bypassing it or changing candidate identity.

Focused Tier 3 verifiers:

- `node scripts/verify-messaging-cleanup-adapter.mjs`: safe auth, input scope, batch cap, partial deletion failure/retry, deadline and safe logs.
- `node scripts/verify-messaging-operations-db.mjs`: dedicated `tenops-messaging-qa` postgres fixture; actual migration wrapped atomically, pause/drain/abort/failure/reopen/hold guards and text/history continuity; seven-day grace/batch cap/ready/unrelated protection. Reuses the frozen ancestor fixture, no large bytes.
- `node scripts/verify-messaging-operations-local.mjs`: dedicated ignored local Supabase project; tiny objects, real Edge JWT/secret/runtime, Storage cleanup, Vault/pg_net dispatch and real duplicate-safe Cron setup/enable/disable. Hardcoded localhost/port guard inherited from frozen fixture. Local reset never accepts hosted URLs.

No application build or large-transfer suite is needed for added operational files; frozen application Level 3/build evidence remains valid. Final results and operational hashes are recorded in the operations project-memory report/manifest.
