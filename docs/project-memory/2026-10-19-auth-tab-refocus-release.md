# Tab-refocus authentication hotfix release — 2026-10-19

RELEASED to TenDev first, then TenOps after TenDev gates passed.
Canonical main/dev and both served SHA: da21615ad6f06727e4f18a75c65331a7266d2404.
Baseline f9230b9606d629567caea28a61401ba592951882 reconciled by exact fast-forward.
Only src/lib/auth.tsx, scripts/verify-samples-access-refresh.mjs and
 docs/project-memory/2026-10-19-auth-tab-refocus.md were promoted.
Accepted candidate preserved in persistent worktree and verified Git bundle.

The failed preflight read expired Wrangler OAuth directly. Existing installed
Wrangler refreshed the existing authorization automatically; no environment API
token override, browser approval, new scopes or dependency updates. Both existing
Pages project/config reads then passed; final deployment configs are unchanged.

One isolated build per environment, no .env.local, unchanged hosted Supabase public
configuration. Mandatory branding verifier and generated export checks passed:
TenDev / RESEARCH & DEVELOPMENT (true), TenOps / OPERATIONS CONTROL (false).
Review-only guards absent from exported runtime. Skip-marked atomic main/dev
promotion produced four confirmed skipped automatic builds. Separate manual
artifacts deployed to the correct existing projects. Both served exports and
32 assets per target verified byte-for-byte, with correct branding.

Tier 3 authentication risk: reused accepted 16-scenario local evidence and Product's
manual physical tab-switch acceptance. Focused actual-served-bundle release smoke
passed on each target: direct/refresh each two profile calls and one restoration;
simulated continuing SIGNED_IN exactly one extra profile call, no restoration
replay, no page errors. All backend auth/data requests intercepted; no hosted
business writes or real account/session changes. Release smoke is simulated
auth-event testing, not new physical tab-focus testing or live-account testing.

No migrations, Edge deployments, RLS/permissions/configuration changes or backend
contract changes. iTenify untouched. Local release receipts remain uncommitted;
no additional release boundary or push.

Evidence: [secret-free receipt](evidence/2026-10-19-auth-tab-refocus-release.json).
