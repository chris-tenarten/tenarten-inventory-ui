# Manpower progressive-history release — completed

**Final status: RELEASED BOTH; performance optimization initiative complete.** Canonical local/remote main and dev, TenDev, and TenOps are fully aligned at `af04478658cac754c716e9a66758b12ccb8e8ab9`. Earlier blocked/partial sections below are historical records superseded by the final verification.

| Target | Deployment | Branding | Verified served routes/assets | Focused smoke |
|---|---|---|---|---|
| TenDev | `f20e4894-b098-49da-842a-3659d66056ca` | TenDev / RESEARCH & DEVELOPMENT | 46 | 7 passed |
| TenOps | `8b3d7b4f-cea2-4547-9059-4e9d38cb2026` | TenOps / OPERATIONS CONTROL | 46 | 7 passed |

The failed smoke locator assumed a default selected-period view. Inspection established that `historyView` starts true; the conditional toggle therefore reads “Selected-period groups only.” “Show all groups” appears only after switching to the period-only view. It is a display filter, not a manual retrieval action. The smoke now waits for automatic complete coverage, verifies the default all-groups view and all 12,888 fixture records, and retains complete-group totals and archived historical-action checks. Installed `tsx` resolves the existing TypeScript fixture imports. A focused read-only permission check verifies editing, Job reassignment and group creation remain disabled. These are test-only corrections in the local release adapter; no application change or new canonical commit was introduced.

Seven focused checks passed against each actual served bundle: startup/sign-in; recent complete groups and selected-period/cross-date totals; automatic older groups with responsive search and accurate coverage; continuing authentication/focus without restoration replay or profile loop; full record coverage and archived historical-action availability without saving; period analytics and settled retrieval; read-only permission affordances. Zero client exceptions, unexpected external requests, forwarded backend requests or hosted business-data writes. All Auth/data calls were intercepted with existing synthetic fixtures. This verifies served-bundle compatibility, not live authenticated Production business data, physical multi-tab certification, backend RLS enforcement, or measured Production latency gains. Existing accepted integrity/permission/edit-persistence evidence was reused.

The original successful TenDev build and asset verification were reused after fresh deployment/configuration drift checks. One required isolated TenOps build used the exact accepted revision, existing Supabase configuration, and explicit `NEXT_PUBLIC_DEV_BRANDING=false`. Actual Production branding and 46 served files matched that export byte-for-byte. Final Cloudflare configuration comparisons passed unchanged for both projects. TenDev passed all gates before TenOps was deployed. No comprehensive suite, unrelated build, migration, policy change, hosted mutation or unrelated application work occurred. Risk Tier 3 release discipline; focused Testing Level 2 application-behavior gates plus isolated branding/asset/configuration verification, reusing accepted evidence.

Rollback: `rollback/manpower-progressive-20261020-main` and `rollback/manpower-progressive-20261020-dev` both preserve `01e5e839fdba0256023077cf1d85c2d4dd15212c`. Verified bundle `.tmp-manpower-release/accepted-af04478.bundle` remains preserved. Previous deployment IDs: TenDev `903e8a1c-80e8-444e-8419-f9d418dc682c`, TenOps `495fbfac-e142-4230-b6b7-eabe99b9114e`. Existing earlier rollback refs, branches, worktrees and review-only dirty work were preserved. No further optimization work initiated. Receipts remain local/uncommitted to preserve exact approved canonical/deployed SHA.

[Final machine receipt](evidence/2026-10-20-manpower-progressive-release.json).

---

Product authorized release of accepted commit `af04478658cac754c716e9a66758b12ccb8e8ab9` on October 20, 2026, TenDev first and then TenOps.

Status: **BLOCKED — no promotion or deployment performed.** The mandatory Cloudflare baseline read returned HTTP 401 using the existing authorization through the established release helper. No hosted retry, new credential request, or permission request was made. Current deployed revisions and branding therefore remain unverified in this release attempt. Historical receipts report baseline `01e5e839fdba0256023077cf1d85c2d4dd15212c`, TenDev deployment `903e8a1c-80e8-444e-8419-f9d418dc682c`, and TenOps deployment `495fbfac-e142-4230-b6b7-eabe99b9114e`; those are historical evidence, not a fresh confirmation.

Preflight confirmed local and remote main/dev at `01e5e839fdba0256023077cf1d85c2d4dd15212c`, accepted candidate ancestry, no changes to Supabase or auth source, and no application modifications in the candidate worktree. The candidate includes four Manpower application paths plus accepted fixture, verification and evidence artifacts. The later uncommitted populated-review adapter change remains outside the approved commit and is preserved.

The first adapted preflight invocation had a local checkout assertion targeting the baseline rather than the candidate worktree. This script configuration was corrected before any hosted call. The subsequent hosted read returned 401 and release work stopped.

No builds, exhaustive tests, Git promotions, pushes, migrations, deployments, hosted business writes, or new rollback refs were performed. Existing refs, worktrees, historical receipts and deployments were preserved. The accepted validation evidence remains reusable. Risk Tier 3 release preflight only; release-specific build, served-asset and browser gates were not reached. The initiative cannot yet be marked complete.

Chris explicitly authorized one retry after opening the Cloudflare dashboard. The same existing-authorization preflight again returned HTTP 401. No promotion, push, build, deployment or hosted business-data mutation occurred. Dashboard browser sign-in did not resolve the release helper authorization failure. Release remains blocked.

## Focused authentication recovery — October 20, 2026

**Authentication restored; release remains unperformed.** Investigation established that the release helper reads `oauth_token` directly from the existing Wrangler default configuration and does not invoke OAuth refresh. The stored access token expired at `2026-10-20T16:04:40.187Z`; investigation occurred after `18:16 UTC`. No credential override environment variables were present. A stored refresh token was available.

Used installed Wrangler 4.141.0 with `CI=true WRANGLER_SEND_METRICS=false` and the read-only `pages project list` command. Its built-in OAuth refresh succeeded without interactive login, new tokens created manually, new scopes, or Cloudflare settings changes. Renewed expiration was `2026-10-20T19:17:13.549Z`; stored scopes remained identical. Secret values were not printed or recorded. This normal renewal of the existing OAuth session was the only credential-store update.

Reran only the failed established read-only preflight: PASS. Local and remote main/dev and both canonical deployments remain at `01e5e839fdba0256023077cf1d85c2d4dd15212c`. TenDev deployment remains `903e8a1c-80e8-444e-8419-f9d418dc682c`; TenOps remains `495fbfac-e142-4230-b6b7-eabe99b9114e`. Approved candidate remains `af04478658cac754c716e9a66758b12ccb8e8ab9`. The preflight refreshed only local boundary/configuration receipts under `.tmp-manpower-release`.

No implementation, builds, test suites, promotion, merge, push, deployment, rollback-ref changes, Cloudflare settings changes or hosted business-data mutation occurred. Authentication blocker resolved. Future raw-helper use after access-token expiration requires normal Wrangler refresh first. Stopped after authentication verification as requested.

## Authorized release resumed — partial release, stopped at smoke runner gate

Canonical local/remote main and dev were fast-forwarded/pushed atomically to exact accepted commit `af04478658cac754c716e9a66758b12ccb8e8ab9`. Existing rollback refs were preserved; added `rollback/manpower-progressive-20261020-main` and `rollback/manpower-progressive-20261020-dev` at prior baseline `01e5e839fdba0256023077cf1d85c2d4dd15212c`. Verified recovery bundle: `.tmp-manpower-release/accepted-af04478.bundle`. Four automatic Cloudflare builds were confirmed skipped.

One isolated TenDev Production-mode build passed, preserving existing Supabase configuration, excluding local env/review runtime, and verifying TenDev / RESEARCH & DEVELOPMENT branding. TenDev deployed as `f20e4894-b098-49da-842a-3659d66056ca`, immutable URL https://f20e4894.tendev.pages.dev. Its canonical revision is the accepted full SHA; 46 actual served routes/assets matched the isolated export byte-for-byte.

Mandatory focused browser smoke did not start: `node .tmp-manpower-release/smoke.mjs tendev` raised `ERR_MODULE_NOT_FOUND` resolving the extensionless `scripts/support/sample-batch-first-fixture` import from the existing `production-blend-fixtures.mts`. This is a runner/import failure, not evidence of an application defect. Browser/startup/auth/Manpower post-deployment verification is uncompleted. Stopped at that gate as directed, without retrying or proceeding to TenOps.

TenOps was not built or deployed and remains at the freshly verified pre-release baseline, deployment `495fbfac-e142-4230-b6b7-eabe99b9114e`. Previous TenDev deployment `903e8a1c-80e8-444e-8419-f9d418dc682c` remains a rollback target. Main/dev and both sites are not fully aligned. Initiative remains incomplete. No migration, configuration/policy change, hosted business-data mutation or unrelated application change occurred. Accepted tests were reused; no exhaustive suite repeated. Receipt: `evidence/2026-10-20-manpower-progressive-release.json`.

## Browser smoke resumed — stopped at mandatory locator gate

Invoked the existing smoke adapter using installed `tsx` instead of plain Node. This resolved the TypeScript fixture import without changing application or fixture source. Four focused checks passed against the actual TenDev bundle: unauthenticated startup; recent complete groups with correct period and cross-date totals; progressive older groups with responsive search and incomplete-coverage notice; continuing authentication/focus without full-page restoration replay or profile loop.

The history-complete assertion passed, then the smoke failed with `locator.click: Timeout 15000ms exceeded` waiting for `getByRole('button', { name: 'Show all groups', exact: true })` at `.tmp-manpower-release/smoke.mjs:47`. Remaining complete-coverage/search/historical-action/period-switch/request-settling checks did not complete. A locator timeout alone does not establish an application defect. No corrective implementation or test retry was attempted after this mandatory failure.

Fresh narrow drift checks confirmed canonical local/remote main/dev at `af04478658cac754c716e9a66758b12ccb8e8ab9`, TenDev still deployment `f20e4894-b098-49da-842a-3659d66056ca` at that SHA, and TenOps still deployment `495fbfac-e142-4230-b6b7-eabe99b9114e` at baseline `01e5e839fdba0256023077cf1d85c2d4dd15212c`. Both Cloudflare deployment configurations match the retained pre-release configurations. Prior TenDev build and 46-asset verification evidence was reused. No build, deployment, application edit, hosted business mutation or rollback-ref change occurred during this resume. Stopped at the mandatory gate. Sites remain unaligned; initiative incomplete.
