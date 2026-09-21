# Manpower reporting polish — local review candidate

Status: locally frozen for Chris's review; **not pushed or deployed**. Base: `840672811841c9376d44568841dc8689a7fe461b`. Branch: `candidate/manpower-reporting-polish-20260921`. The commit containing this record identifies the frozen candidate. Isolated worktree: `/private/tmp/tenops-manpower-reporting-polish`.

## Approved direction and discovery

Chris requested Job-focused Product labor reporting, a compact Monthly Snapshot summary, and removal of the unapproved Production Early Access badge. Tier 2: bounded client/reporting work with focused authorization and data-preservation regression checks.

Existing Production Queue/Table hours and Snapshot Top Jobs already link to `/manpower-reporting?job=<id>`. Manpower already filters entries by that canonical Job ID. Reuse this interaction; no new Job model or schema. Snapshot currently has one period, **Last 30 Days**, rather than a period picker. New analytics use its exact inclusive work-date bounds and complete paginated labor result.

## Behavior

- Main Manpower view retains reporting groups, individual Product fields, and category management. No global Product filter or lifetime Product/Task panel.
- Job review selector reuses loaded canonical Jobs plus archived Jobs referenced by labor. Entry-target choices remain unchanged. URL navigation/back/forward works; changing Job clears the Product filter.
- Selected Job shows total labor across all dates/products, plus hours matching the current search/Product filter. Product/Task details start collapsed; Product is the default orientation when expanded. Product filtering lives inside this Job context.
- Product distribution shows categorized hours and separate Uncategorized hours. Percentages use only categorized hours; historical volume cannot dominate that denominator. Expand a Product for Tasks, or use By Task for its Products (including Uncategorized). Original and Rework hours contribute exactly once.
- Snapshot uses the same compact distribution for the selected period. At most five Products initially; Show all exposes the rest. Inactive categories are labeled; unknown reference labels remain honest; stable IDs prevent distinct Tasks with the same name from merging. Empty/all-Uncategorized scopes display no fabricated percentages. No quantity/efficiency metric.

## Early Access forensic findings

- Badge element: `src/components/EarlyAccessBadge.tsx`.
- Current rendering: `HeaderEnvironmentIdentity` and `LoginBrandIdentity` in `src/components/AppBranding.tsx`.
- Introduced in `460759d32caae699801dd96baca732793f00809e` (2026-08-03, “Add environment-gated Early Access identity and Planning bulletin”). Centralized by `8001107c86b61c5602614b591b4447d039a82ce7` (2026-08-04).
- Both predate the Manpower release. `840672811` changed none of AppBranding, EarlyAccessBadge, early-access.mjs, or dev-branding.mjs.
- The existing helper reads build-time `NEXT_PUBLIC_EARLY_ACCESS` and enables only exact `true`; Production branding previously allowed it. Local release environment has that flag set to `true`.
- Read-only immutable deployment HTML comparison on 2026-09-21:
  - Prior Production `https://ca07bac0.tenops.pages.dev/manpower-reporting`: no badge title; SHA-256 `b92e900961e25efc4a952438f51919afc2c84ef4fee88615558710bd71b59d3e`.
  - Retained automatic build `e16e17b7` HTML: no badge title; SHA-256 `a7235322e7c2dfd7d96a1ffce5918d18803037a05b3020ab5ab46b0fa7714242`.
  - Released local artifact `https://6f9ad8e3.tenops.pages.dev/manpower-reporting`: badge title present; SHA-256 `519bea5d618bd0c4b81e4d500b786957c25fcbb1c82af297e8666e932a14e831`.
- Conclusion: the release exposed existing environment-gated code through the local build configuration; it did not introduce badge source. Repository flag documentation establishes capability, not explicit approval for Production display. Chris's current instruction removes it.
- Narrow correction: Production `allowEarlyAccessBadge=false`. This suppresses both header and login badge even with the legacy flag enabled. TenDev artwork, themes, Planning flag and application permissions remain unchanged. Legacy flag helper/component retained dormant; no unrelated cleanup.

## Preservation and validation

No hosted mutation, migration application, push or deployment performed. Read-only hosted verifier returned **1,674 entries / 7,200 total hours / 4,059 Job-linked hours**. This is an actual hosted count/sum check, not a claim of a new full hosted integrity digest.

Schema/migrations, Manpower write API, category manager, RBAC, entry enforcement, pagination helper, Rework attribution and Production jobs loader are byte-identical to the base. No entry assignment or protected record is written by the new analytics. Migration SHA-256 remains `b4df3ccd1f49cbfc32de91582e9b9bc00cd8325069aa4efa2cc4a98b682d0865`.

Passed:

- `npx tsx scripts/verify-manpower-product-categories.mts`: equivalent 1,674-row / 7,200-hour fixture; full loading, failure/change detection, decimals, both pivots, historical edits, Rework and role map.
- `node --env-file=.env.local --import tsx scripts/verify-manpower-product-categories.mts --hosted-read-only`: hosted SELECT-only counts/hours above.
- `npx tsx scripts/verify-manpower-rework.ts`.
- `node scripts/verify-dashboard-monthly-snapshot.mjs`.
- `node scripts/verify-early-access.mjs` and `node scripts/verify-dev-branding.mjs`.
- `node scripts/verify-manpower-product-category-db.mjs --hosted-contract docs/project-memory/evidence/2026-09-21-manpower-product-category-hosted-before.json`: disposable PostgreSQL/PostgREST replay of captured hosted contract. Anonymous/inactive/Guest/Member/Developer/Lead/Admin matrix; management, guards, immutable assignments, historical edits, concurrency, preservation digests. No hosted DML.
- Production build: `NEXT_PUBLIC_DEV_BRANDING=false NEXT_PUBLIC_EARLY_ACCESS=true npm run build`. Build deliberately enables legacy flag to prove suppression. Exported root/Manpower HTML and browser branding have no badge.
- `npx tsc --noEmit`; focused ESLint on all changed TS/TSX/MJS files; `git diff --check`.
- Playwright: **16/16 passed** across `manpower-add-line`, `manpower-product-categories`, and `manpower-snapshot-products`. All authentication/business endpoints mocked. Covers required selection, historical null edit without assignment overwrite, manager lifecycle and role visibility, full Job totals versus filtered hours, URL navigation, archived Job review, responsive layouts, Snapshot inclusive period edges, 1,002 in-period rows across three pages, same-name/different-ID Tasks, Rework, all-Uncategorized/empty states and later-page failure without partial analytics. Two affected tests rerun after adding Job layout/screenshot coverage.
- Desktop and 390px screenshots visually reviewed; retained under ignored `tmp/` in the candidate worktree (`manpower-groups-primary.png`, `manpower-job-products-desktop.png`, `manpower-job-products-narrow.png`, `manpower-snapshot-products-desktop.png`, `manpower-snapshot-products-narrow.png`).

Initial browser run: 15/16 passed; the test-only write detector incorrectly counted existing read-only RPC POSTs and HEAD requests. Corrected explicit read classification; final run passed. Sandbox initially blocked Turbopack/tsx local sockets; approved unsandboxed reruns passed.

## Exact changed-file boundary

Client (7):

- `src/lib/dev-branding.mjs`
- `src/modules/manpower/ManpowerWorkspace.tsx`
- `src/modules/manpower/ProductLaborSummary.tsx`
- `src/modules/manpower/ProductLaborDistribution.tsx` (new)
- `src/modules/manpower/product-reporting.ts` (shared reporting input types only; aggregation/selection logic unchanged)
- `src/modules/production/snapshot.ts` (read projection and derived Product summary)
- `src/modules/production/components/MonthlySnapshot.tsx`

Verification (4):

- `scripts/verify-dev-branding.mjs`
- `scripts/verify-early-access.mjs`
- `tests/e2e/manpower-product-categories.spec.ts`
- `tests/e2e/manpower-snapshot-products.spec.ts` (new)

Documentation (2): this record and `docs/workflows/PRODUCTION_PIPELINE.md`.

## Review/release boundary

No schema or data work is necessary. Rollback is client-only to `840672811`; retain the already-released Product Category migration/data. Future push/deployment requires Chris's authorization. No known implementation blocker; Product review of the local UI remains the intended next gate.

Normal VS Code workspace stays clean on `dev`; `dev`, `main`, and `origin/main` remain `840672811841c9376d44568841dc8689a7fe461b`. Existing isolated branches/worktrees, including both Unified Catalog candidates, were not edited.
