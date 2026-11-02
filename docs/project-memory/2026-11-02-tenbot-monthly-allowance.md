# TenBot monthly inference allowance — November 2, 2026

Implemented locally under Chris's **Infrastructure & TenBot Simplification** prompt. This is a mechanism, not spending activation. Separate Advisory context is unavailable; the current explicit prompt governs. The new migration has **not** been persistently applied to any project.

The ordinary hosted path continues using `tenbot_openai_reserve` / `tenbot_openai_settle` and the existing server meter. A single shared allowance replaces overlapping lifetime, daily and per-user daily dollar budgets: **up to $5 per UTC calendar month**. A database constraint rejects higher monthly limits. Each dispatch reserves its maximum bounded cost atomically before the network call; measured usage settles that reservation. Missing usage retains the full amount. Existing settlement mismatch and overrun handling remains unchanged and an overrun disables the provider.

The allowance retains per-request dollar and step limits, global/account minute burst limits, active-account/capability checks, model allowlisting, finite authorization expiry and service-only financial RPCs. The migration configures a maximum $0.25 per request, or preserves an existing lower nonzero cap. Ordinary Job reads do not need one-use evaluation IDs, question allowlists, filesystem locks or per-operation Product approvals. Provider funding still needs explicit authorization.

Old lifetime/day/user-day/open-count/daily-request policy columns remain available as historical configuration but no longer gate ordinary monthly reservations. Unresolved charges continue consuming dollars; they no longer exhaust a permanent concurrency counter and freeze every future request. No operational permissions, write gates, JWT authentication or RLS rules change.

## Historical and unresolved accounting

All existing usage rows and imported cumulative spend are preserved. Current-month measured costs count against the allowance. Prior-month `reserved` and `uncertain` rows remain charged in every new month until supported measurement settles them. Prior-month measured costs remain in lifetime history without consuming a new month's allowance.

`legacy_unresolved_microusd` identifies the unresolved portion already included in imported cumulative spend. It counts every month and is not added twice in the import's original month. It defaults to zero because no unverified journal import occurs automatically. Neither imported cumulative spend nor its unresolved portion can decrease through ordinary policy editing. Reconciliation of imported unknowns needs separately reviewed billing evidence and an explicit narrow accounting change.

The retained [limited Terra evaluation](2026-11-02-tenbot-limited-terra-evaluation.md) records $0.5586785000000006 accounted/reserved, 368 attempts / 367 measured settlements, including one **18,723 microUSD unknown hold**. That hold is not confirmed billed cost. This pass leaves the local journal, closed run, archived/retained lock evidence and those counters untouched. It neither retries the evaluation nor invents a zero-cost settlement.

## One-time activation prerequisites

Paid inference remains OFF. Before approving activation, the owner must:

1. Approve and apply the new narrow migration after normal migration review; its application explicitly leaves the policy disabled.
2. Freeze independent spending clients of the old experimental journal and verify its final accounting/evidence. Import the evidenced aggregate into the existing hosted policy without double-counting an earlier import. The retained snapshot would require **558,679 microUSD cumulative** (rounded up) and **18,723 microUSD unresolved**, with the known October settled-spend date retained. These are reconciliation inputs, not changes performed by this pass.
3. Set a deliberate finite policy expiry, verify the allowed model and current pricing, and provision a valid server-side key through the established private process. Do not put keys in chat or repository files.
4. Explicitly approve ordinary spending, then enable both the server spending flag and the reviewed database policy. Preserve the $5 ceiling and current operational-write controls.

After activation, use the service-only `tenbot_openai_meter_status()` for current month allowance, accounted cost, held amount and remaining funds. `accountedMicrousd` continues to report cumulative history; `totalLimitMicrousd` is historical configuration. `remainingMicrousd` now means remaining monthly allowance. Turning either spending gate OFF stops new dispatches; settlement of already dispatched calls remains possible.

## Validation

- `node scripts/verify-tenbot-monthly-allowance.mjs`: four static migration/interface checks pass.
- `node scripts/verify-tenbot-monthly-allowance.mjs --isolated-free-fixture`: **12 checks pass**, including real PostgreSQL ceiling/remaining-budget rejection, cross-month holds, legacy non-duplication, stale-open recovery, request/burst limits, account revocation, service-only privileges and retained unknown/overrun settlement behavior.
- The established fixed standalone Free fixture is reused. All schema/data changes run in one rollback-only transaction; readback confirms original policy, ledger and reserve/status function hashes. No Production request, provider call, persistent migration or migration-ledger update occurred. Existing cross-instance row locking and its earlier concurrency evidence are reused; this focused delta does not claim a new concurrent or HTTP JWT run.
- `node --check scripts/verify-tenbot-monthly-allowance.mjs` and `git diff --check` pass.

The local Docker fixture was unavailable to a bounded readiness probe, so the existing isolated Free fixture supplied the real database gate. Scratch SQL only is retained under `/private/tmp/tenops-monthly-allowance-*`; no new service, database, branch, worktree or paid resource was created. The broader implementation receipt owns application/browser/build evidence and the final local commit boundary.

## Applied for scoped TenDev acceptance — November 2, 2026

The [real Terra acceptance receipt](2026-11-02-tenbot-real-terra-acceptance.md) supersedes the earlier unapplied/paid-OFF status only for this explicit finite evaluation. Actual stale-open admission proved the existing migration necessary; exact SHA-256 `2336e07e712e0728119d582a05525db45cd180da1707236b516baf62028690c8` was applied at16:27:55UTC, disabled first, preserving all94 prior usage rows, service-only grants/RLS and prior ledger. Two wrapper attempts rolled back; only a catalog alias in the wrapper changed.

The evidenced import remains558679cumulative/18723unresolved microUSD datedOctober29. Policy7 was separately funded, paused on providerquota, then resumed unchanged after Chris added credits. Its conservative cap4213829micros, request250000, Terra-only and18UTCexpiry preserve the effective$5 ceiling including historical costs/holds. Ordinary Production spending remainsfalse and the server gate permits only the authorized owner/exactTenDev. At17:18UTC, configured remaining3984767micros; no reset, refund, unknown settlement or original journal/lock mutation. This grants no ordinary recurring monthly or Production activation.
