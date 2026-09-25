# Messaging operational candidate

Status: **Ready for a final read-only hosted release gate**, not released. This is a separate operations commit on `feature/messaging-attachment-operations` in `/private/tmp/tenops-messaging-large-attachments`, directly descended from frozen application candidate `5cbc69dd67d380baa0bf03b01ae65c9318f7889a`. Resolve operations SHA as the commit containing this report. The application branch remains at its original SHA; all its existing files are byte-for-byte unchanged.

No normal checkout modifications, hosted extension/secret/job creation, migrations, attachment pause, business-data mutation, push or deployment occurred. Local test objects were tiny. The original large-transfer suite was not rerun. Ignored test output/secrets are not committed; `.env.local` remains ignored.

## Prepared boundary

- Dedicated `supabase/functions/cleanup-messaging-drafts/` HTTP adapter: platform JWT + timing-safe dedicated-secret check, fixed claim/remove/finish flow, 50-draft cap, bounded work/request timeout, partial-delete reconciliation, safe HTTP status and count-only logs.
- `supabase/operations/messaging/cleanup-*.sql`: real pg_cron/pg_net + existing Vault integration, one initially disabled hourly minute-17 job; rejects wrong schedule/owner/timezone and non-anon gateway JWT; guarded enable/disable and private 30-day run-status monitoring.
- `transition-setup.sql`, `pause.sql`, `drain-barrier.sql`, `abort-before-migration.sql`, `hold-new-uploads.sql`, `attest-client.sql`, `reopen.sql`: explicit attachment-only state/permission controls and independent deployment attestation.
- Two local-only preparers stage the JWT-verified deployment and wrap the exact hash-checked frozen migration body plus entry revoke atomically. They never connect to any database/cloud service.
- Three focused operational verifiers; detailed execution, secret provisioning, monitoring ownership and recovery runbook in [operations README](../../supabase/operations/messaging/README.md).
- Exact hashes in [artifact manifest](evidence/2026-09-25-messaging-operations-sha256.json). Manifest includes the approved application artifacts and generated paused-migration SQL hash for comparison; generated SQL remains ignored, reproducible by the preparer.

## Validation — Tier 3 / Level 3

All below PASS on final executable artifacts:

| Gate | Evidence |
| --- | --- |
| Adapter deterministic tests | Valid/wrong/missing secret, wrong method, no auth-side effects, caller paths ignored, fixed bucket/UUID validation, 50 cap, safe logs, claim failure, partial second-batch deletion failure blocks finalize, retry/duplicate safety, deadline stops further deletion. |
| Actual disposable PostgreSQL | Reused frozen ancestor fixture; zero-draft pause, active-draft drain refusal, repeated pause/barrier, safe pre-migration abort, actual migration body rollback on injected failure, atomic new-entry revoke, fail-closed duplicate migration/unsafe abort, bucket rollback, missing scheduler/endpoint/client gate denial, successful repeated reopen, repeated post-release hold, text/history usable, >7-day selection/<7-day grace, active heartbeat, max50, ready/unrelated protection. |
| Real disposable Supabase | Actual Edge runtime compiled and ran the final adapter with native timingSafeEqual; JWT gateway rejects invalid tokens; wrong/missing invocation secret denied without run rows. Tiny real Storage draft retained during active grace then cleaned when aged in the disposable fixture; finalized historical PNG retained; retry no-op safe. |
| Real scheduler infrastructure | Actual Vault values and pg_net request reach the local authenticated Edge; non-anon gateway credential rejected. Actual pg_cron setup repeated without duplicate job, initially disabled, repeated enable/disable safe; reapplication preserves activation. Service-role DELETE on monitoring table denied; user SELECT denied. |
| Static/self-review | Targeted ESLint including function source, JS syntax, diff whitespace, hash checks and original-file immutability pass. Supabase runtime compilation provides changed-function execution evidence. Frozen application's prior TypeScript/build/browser/transfer Level 3 results reused; no unrelated app rebuild needed. |

The initial real scheduler retry exposed a PL/pgSQL variable/table-name ambiguity; corrected and the final repeated-setup gate passed. Monitoring privileges were tightened to explicit SELECT/INSERT/UPDATE for service_role, and real tests confirmed no DELETE privilege. Test server teardown was corrected to terminate its owned process group; no unrelated process was targeted.

Disposable verifier run results are retained under ignored `.tmp-messaging-operations/`. Actual local Supabase uses only `127.0.0.1:55431`; helper refuses other host/port. The local scheduler verifier substitutes ONLY its disposable endpoint with `http://kong:8000`; released SQL retains the fixed hosted project URL. No real hosted service-role key or user data was needed.

## Operational readiness / remaining gates

The prior missing runner/transition implementation blocker is resolved locally. Production installation is intentionally pending: fresh read-only compatibility/integrity gate, explicit approval of this operations SHA/hash manifest alongside the frozen app SHA, secure secret provisioning, migration/version recording, endpoint/Cron setup, verified Production client/refresh and final reopen. V1 monitoring is database/Edge logs plus explicit operator review, not an unconfigured automatic alert service. Free-plan Storage/egress quotas remain finite and need operational monitoring; no upgrade/global/other-bucket change is required.

Promote **only application SHA 5cbc69dd…** to canonical remote main after backend readiness. Deploy this separately reviewed operational bundle without merging it into normal dev or changing the Planning checkout. Independent bare-promotion repository prevents shared checkout ref/index updates. Existing branch-protection requirements must be respected; stop if exact-SHA promotion is rejected. Record both deployed app SHA and operations SHA.

## Final read-only release-gate instruction

Reconfirm frozen application `5cbc69dd67d380baa0bf03b01ae65c9318f7889a` and the operations commit containing this report against the artifact manifest. Recheck current Production/main `a76f4f83e66a1d3b149ff31bff44874a39c1b6f3`, global ceiling 52,428,800, private old Messaging bucket, unused application migration and unused operational object/job names (or exact known compatible state), Vault/extension availability, intended participant authorization and unrelated bucket settings. Capture fresh content-free historical fingerprints. Review the now-implemented secret/runner/monitoring/pause/drain/atomic-migration/reopen/recovery procedure and exact-app-SHA Git promotion. Reuse passed operational and application validation; no large-transfer rerun absent relevant drift. Return PASS/BLOCKED with exact application/operations SHAs and release authorization text if PASS. Do not apply hosted changes, set secrets, pause uploads, push/deploy or touch the normal checkout during that gate.
