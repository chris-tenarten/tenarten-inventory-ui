# Waves 1–4 performance release — TenDev then TenOps

**RELEASED BOTH on October 20, 2026.** Product explicitly accepted all four performance waves and the Manpower selected-period refinement, and authorized canonical promotion and deployment. This acceptance supersedes the pending acceptance/release status in the historical candidate reports.

Canonical local main/dev, remote main/dev, the preserved integration branch and both deployed environments are aligned at **`01e5e839fdba0256023077cf1d85c2d4dd15212c`**. Baseline `da21615ad6f06727e4f18a75c65331a7266d2404` was freshly verified in Git and both hosted projects before promotion. There was no newer conflicting change. Exact fast-forward promotion preserved the accepted integration history, with no additional application edits.

| Target | Deployment | Served revision | Verified branding |
|---|---|---|---|
| [TenDev](https://tendev.pages.dev) | `903e8a1c-80e8-444e-8419-f9d418dc682c` | `01e5e839fdba0256023077cf1d85c2d4dd15212c` | TenDev / RESEARCH & DEVELOPMENT |
| [TenOps Production](https://tenops.pages.dev) | `495fbfac-e142-4230-b6b7-eabe99b9114e` | `01e5e839fdba0256023077cf1d85c2d4dd15212c` | TenOps / OPERATIONS CONTROL |

## Release boundary and safeguards

The approved 90-path delta from baseline includes 31 application paths plus accepted verification/research artifacts. All four waves and the final Manpower refinement were released exactly as accepted. Automatic selected-period records remain available; full historical retrieval is explicit. Messaging Reply to Message remains deferred; no unrelated feature, optimization or cleanup was included.

The integration worktree was clean before release and remains clean. Original Wave 1–4 refs/worktrees, unrelated branches and root untracked artifacts were preserved. Auth source and all Supabase source/migrations are unchanged from baseline. No force push or destructive reset was used.

Local dev was fast-forwarded, main updated from its verified expected baseline, and both branches pushed atomically. The accepted head already carries `[CF-Pages-Skip] [CI Skip]`. All four resulting automatic Cloudflare builds (main and dev on each project) were confirmed **skipped** before manual deployment.

One isolated exact-revision Production-mode webpack/TypeScript build per environment was performed in `.tmp-performance-release/tendev` and `.tmp-performance-release/tenops`. Neither build worktree contained `.env.local` or `.env.production.local`. Existing project public configuration was reused, with the existing Supabase target `https://vxdxjhazkqhpkwdqtobp.supabase.co`. TenOps explicitly set `NEXT_PUBLIC_DEV_BRANDING=false`; TenDev set it true with the established project URL. Mandatory branding structural verification, generated HTML/manifest inspection and review-guard exclusion passed separately. Review scripts and local review runtime were not exported.

The existing installed Wrangler authorization was used without new credentials, scopes, logins or dependency installation. Only the established tendev and tenops Pages projects were deployed. Production deployment began only after TenDev promotion, served-asset verification and all focused smoke gates passed.

## Verification

Risk Tier 3 / focused Testing Level 3. Accepted integration and Manpower refinement evidence was reused; no comprehensive audit, unrelated suite, database mutation probe or migration was repeated.

Each actual public environment served **46 routes/assets byte-for-byte equal** to its isolated export. Checked routes include Production, Samples, Proposals, Purchasing, My Work, Manpower, Inventory, Activity and Material Usage, plus the manifest and their referenced static assets. Actual served HTML/manifest branding was checked, rather than inferred from environment settings. Each canonical deployment reports the accepted full commit and successful status. Final deployment configurations match the pre-release configurations exactly.

Nine focused browser checks passed against each environment's **actual served bundle**:

1. Unauthenticated startup reaches Sign in.
2. Production Job Queue loads and Inspector opens through its accessible keyboard action.
3. Complete Proposal retrieval.
4. Complete purchasing list retrieval.
5. Sample library and unsaved Draft Formulation access.
6. Continuing-session SIGNED_IN revalidation and a separate dispatched focus event preserve the workspace without restoration replay or a profile-request loop.
7. Messaging opens and authorized unread reads settle.
8. Manpower automatically displays 1,201 selected-period fixture records, switches to 1,801 for 90 days with matching totals, and retrieves all 12,001 only after explicit complete-history selection.
9. Initial Inventory quantities and navigation.

Both checks produced zero client exceptions or unexpected external requests. All Auth/Supabase/data traffic was intercepted in isolated synthetic sessions, with **zero backend requests forwarded and zero hosted business-data writes**. These are release-bundle compatibility checks, not live authenticated hosted-data verification, fresh physical multi-tab certification or Production performance measurements. Existing auth/refocus and data-integrity acceptance remains applicable because their contracts/source were preserved. A local artifact run qualified the smoke harness before the first deployment; adjustments were confined to the harness, with no application changes or hosted deployment retry.

## Rollback and retained evidence

- Recoverable baseline: `da21615ad6f06727e4f18a75c65331a7266d2404`.
- Local rollback refs: `rollback/performance-20261020-main` and `rollback/performance-20261020-dev`.
- Previous TenDev deployment: `f547c6af-3d85-44be-80b0-db8176883a03`, [immutable URL](https://f547c6af.tendev.pages.dev).
- Previous TenOps deployment: `5b940dda-5110-4045-8a7c-a18c18a3125b`, [immutable URL](https://5b940dda.tenops.pages.dev).
- Verified complete-history bundle: `.tmp-performance-release/accepted-01e5e83.bundle`, including the accepted candidate and both rollback refs. Its SHA-256 is retained in the receipt.
- Original candidate refs remain at `71f6915`, `8f26471`, `d310e4f` and `1dc57a3`; the integration branch remains at `01e5e83`.

[Secret-free machine receipt, complete asset hashes and smoke results](evidence/2026-10-20-performance-waves-release.json). Isolated exports, build logs, preflight/skip checks and repeatable release verification scripts remain under `.tmp-performance-release/`. The temporary internal artifact server was stopped; the existing localhost Product review was preserved.

No migrations, schema/RLS/permission changes, Edge deployments, Supabase configuration changes, hosted business-data mutations or external announcements occurred. No Production latency gain is claimed. These final release receipts remain local and uncommitted, preserving the exact accepted canonical/deployed revision. No further release boundary or push was created. Stop after the authorized release.
