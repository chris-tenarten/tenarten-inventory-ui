# Samples restoration-loop incident — local correction

Base/canonical main/dev: `a79e13dadee7a3489cb05fdc3ea0c129edb810aa`. Local branch: `fix/samples-access-refresh-loop`. Persistent worktree: repository `.tmp-sample-auth-loop/source`. Local implementation only; no push/deployment authorized.

## Confirmed cause

The pre-existing SampleWorkspace effect calls `auth.refreshProfile()` on mount and when its selected draft ID changes. Authentication hotfix a79e13d changed explicit refresh to call `beginResolution`, clearing the verified profile and setting access pending. The shell then unmounts Samples. A successful profile response remounts Samples, whose mount effect repeats the refresh. This is a provider/shell/consumer feedback loop, affecting the entire Samples workspace, including its Inspector/Generator, rather than a calculation, redirect, Suspense, PDF or backend failure.

Both hosted /samples routes reproduced 20 profile requests in approximately three seconds with repeated restoration-screen transitions and zero client exceptions, using the actual served bundles and intercepted Auth/data responses in isolated synthetic browser sessions. No real account/session or hosted data was changed. Cloudflare readback: TenOps deployment `4218a587-63f5-4a3b-a560-415d30cd4d77`; TenDev deployment `cfe83a86-ebc8-4cdd-879c-0ec7b8ca9714`; both serve a79e13d. TenDev's separate deployment was created October 16 at 20:21 UTC and retains development branding. Current remote main/dev also match a79e13d. Detailed diagnostic evidence remains in the persistent ignored incident directory; diagnostic logging is not added to the application.

## Narrow correction

Only `auth.refreshProfile` changes application behavior. Explicit revalidation retains the last verified allowed decision for the exact unchanged current Session while the read is in flight, so the caller remains mounted. Its callback identity remains stable across successful profile replacements. Initial restoration, auth/session changes and unresolved/denied/failed access still use pending and stay closed. Every refresh advances the existing generation; stale results cannot apply after a newer request/session/identity change. Revalidation denial, missing profile, mismatch or failure still removes access immediately when resolved. Backend RLS and capability enforcement are unchanged and remain authoritative throughout. No timeout, animation workaround, mount suppression, lifecycle change or auth rollback.

## Focused verification

Tier 3, focused auth/consumer lifecycle coverage. Seven browser groups covered stable Samples mount, held same-session revalidation, Inspector opening and unsaved input retention, existing Working Sheet PDF preview via the existing local renderer (%PDF, saved Sample unchanged), direct Inspector/Generator route, refresh, My Work and Toolbox navigation back, fresh local sign-in, inactive/missing/failed revalidation, and a changed session during an in-flight background refresh. No repeated restoration or request loop after resolution; no protected access after denial/failure/session change; no client exceptions, external requests or hosted writes. The passed Inspector/PDF group was reused after correcting obsolete verifier locators; only unfinished checks were continued. Existing ten-case startup/security evidence is reused for unchanged session-resolution behavior.

One isolated local Production-mode webpack/TypeScript build passed. Established branding verifier and actual export inspection passed: TenOps / OPERATIONS CONTROL, NEXT_PUBLIC_DEV_BRANDING=false, no .env.local. Targeted ESLint and diff check passed. This build uses a synthetic localhost API and must not be deployed. TenDev branding source remains unchanged; no TenDev or Production deployment occurred. No generator calculations, formulations, issued snapshots, labels/DYMO, Post to Job, approval rules, PDF implementation, accounts, schema or permissions changed.

## Review and release boundary

Use existing `node --import tsx scripts/start-sample-spotlight-review.mts` in this worktree for normal-account authentication with disposable in-memory business data and the existing hosted-auth/read guard. Manual URL: http://localhost:3000/samples?open=00000000-0000-4000-8000-000000710001. Automated fixture variant adds `--fixture-auth`; the focused verifier is `node scripts/verify-samples-access-refresh.mjs`.

Product acceptance and explicit deployment authorization are required. A future Production artifact must use actual verified Production public configuration (not this review export), mandatory branding gates, skip markers, served verification and explicit TenDev preservation. Canonical main/dev and hosted deployments remain unchanged. STOP FOR PRODUCT REVIEW.
