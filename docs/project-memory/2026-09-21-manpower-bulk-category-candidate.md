# Combined Manpower polish + Bulk Product Category candidate

Local review candidate only. Continue from approved `3d437db75329a59a78a6627af7a9982446b04c25`, based exactly on Production `840672811841c9376d44568841dc8689a7fe461b`. The new commit containing this record is the combined candidate; do not release `3d437db` separately. No push, deployment, release, hosted mutation or new migration/RPC/RLS change was performed.

Branch: `candidate/manpower-reporting-polish-20260921`.
Worktree: `/private/tmp/tenops-manpower-reporting-polish`.
Risk: Tier 2 client addition, with focused direct API/transaction/concurrency testing because bulk assignment changes persisted attribution when a human explicitly invokes it.

## Bulk behavior and scope

Product Category dropdown and **Apply Category** are inserted after Date and before Worker in the existing bulk toolbar. Active managed categories only; no inactive or Uncategorized choice. No category names are hard-coded. Historical NULLs can be explicitly classified by a human.

Existing other controls operate on selected rows in their own reporting group. Their scope and write implementation are unchanged. Product Category applies to **all selected row IDs across groups, Jobs and filters**, explicitly labeled with the global selected count and a distinction from other group-scoped actions. Selection through existing checkboxes is unchanged. The toolbar wraps on narrow screens; Job/Label now wraps as a control rather than clipping its button text.

One application is bounded to **100 unique IDs**. More than 100 disables Apply Category and is independently rejected by the API wrapper before network activity. IDs are deduplicated. No automatic chunking and no new RPC are used. The limit keeps the UUID query bounded and returned rows below the hosted response limit.

The only PATCH payload field is `product_category_id`. Work Date, Worker, Task, Job/temporary label, Rework, reporting group, AM/PM hours, Notes, entered_by, created_at and all other business facts remain unchanged. The existing server `updated_at` trigger updates audit metadata normally; that is not a labor-fact change. Local direct API tests compare every returned row field except category and updated_at.

A successful response must confirm exact count, all requested IDs exactly once, and the requested category on every row. Confirmed rows replace local entries and their selection clears. Job filters, Product/Task pivots and totals immediately recompute. Snapshot uses persisted current values on navigation/refresh, preserving its existing Last 30 Days date scope. No auto-classification or inference runs.

## Atomicity, concurrency and failure handling

Discovery: existing `updateManpowerEntries` uses separate per-row requests and `Promise.allSettled`, which can partially succeed. That function is unchanged. The new category-only function uses one PostgREST PATCH (`id=in.(...)`) and one SQL transaction. Any SQL/trigger error, including an inactive category, rolls back all row updates in that statement. The existing category SHARE lock serializes assignment against deactivation. Real disposable PostgreSQL/PostgREST tests prove a later row rejection rolls back the whole statement and a pending deactivation makes the batch wait, then reject without changing any row.

**Limit of this guarantee:** a row deleted or omitted by RLS is not an SQL error; the statement can update eligible rows while returning fewer than requested. A lost response can also leave the client uncertain even if a transaction committed. The client checks the full response contract, never labels either case complete success, retains selections, and reloads complete authoritative labor plus category choices. It does not retry the write automatically. If reconciliation fails, analytics/groups are suppressed with a refresh error until a complete load succeeds; selection survives the retry. This is statement atomicity with explicit handling of omitted/uncertain results, not an unqualified all-requested-IDs existence guarantee. No schema/RPC is required for this bounded operation and honest reconciliation.

An active category that becomes inactive before assignment produces a visible failure and refreshed choices; it disappears from the bulk dropdown. Server-side active-category enforcement is unchanged. Repeated bulk category clicks are guarded in the workspace, and other toolbar apply/delete buttons are disabled while the category request/reconciliation is in flight.

## Approved polish preserved

[Prior review record](2026-09-21-manpower-reporting-polish.md) remains unchanged.

- Groups and entry workflow remain primary; no global lifetime Product dashboard/filter.
- Compact selected-Job totals remain independent of Product/search filtering. Product → Task and Task → Product stay contextual; archived Jobs referenced by labor remain reviewable.
- Snapshot stays compact and period-scoped. Uncategorized is separately visible and excluded from categorized percentages. No invented hours/SF or hours/unit metrics; no Snapshot editor.
- Badge originated in `460759d32caae699801dd96baca732793f00809e`; the Manpower release exposed existing build-flag code. Production branding continues to disallow it even with `NEXT_PUBLIC_EARLY_ACCESS=true`. No global branding redesign.
- Schema, migrations, pagination helper, category-management component, RBAC, Rework attribution and Snapshot implementation are unchanged from `3d437db`.

## Hosted read-only evidence

[Captured before/after evidence](evidence/2026-09-21-manpower-bulk-category-read-only.json): SELECT-only reads at 21:01:52Z and 21:09:03Z on 2026-09-21.

- **1,674 entries / 7,200 hours**.
- **955 canonical Job-linked entries / 4,059 Job-linked hours**.
- **0 classified entries**; all historical entries remain Uncategorized.
- All-column entry-row digest, complete pages ordered by id, identical before/after: `9aa703c3c9531a430ad6052bc5a19120dab9a17a06411c6c2e1d91d462dea94f`.
- This digest uses SHA-256 over JSON serialization of the complete ordered entry result. It is not the earlier SQL gate digest format and does not claim a new all-table hosted digest. No hosted writes were made to any table.
- General / Shared: ID `488e1620-8bb5-4404-a367-454a61a8a59f`, active, **0 real entry references**. Safe to deactivate in the eventual release plan **if a fresh read-only usage check still returns zero**. Do not delete it or rewrite the applied seed migration. Deactivation requires separate explicit hosted-data authorization and was not performed. Leads/Admin continue to manage the vocabulary.

## Verification outcomes

Passed on the combined client implementation:

- Exact Production build: `NEXT_PUBLIC_DEV_BRANDING=false NEXT_PUBLIC_EARLY_ACCESS=true npm run build` (22 pages). Legacy flag deliberately enabled to verify suppression.
- `npx tsc --noEmit`.
- Targeted ESLint: Manpower module, changed Snapshot/branding files, verifier scripts and browser specs; zero warnings/errors on final pass.
- `git diff --check`.
- `node --env-file=.env.local --import tsx scripts/verify-manpower-bulk-category.mts`: actual API wrapper with mocked builder; bounds, deduplication, category-only payload, exactly one request, failures, missing/duplicate/wrong IDs, wrong assignment, missing count. No HTTP mutation.
- `node --import tsx scripts/verify-manpower-product-categories.mts`: 1,674/7,200 complete-loading fixture, failure/change detection, historical edits, both pivots, decimals, Rework, role map.
- `node --import tsx scripts/verify-manpower-rework.ts`.
- `node scripts/verify-dashboard-monthly-snapshot.mjs`.
- `node scripts/verify-early-access.mjs` and `node scripts/verify-dev-branding.mjs`.
- `node scripts/verify-manpower-product-category-db.mjs --hosted-contract docs/project-memory/evidence/2026-09-21-manpower-product-category-hosted-before.json`: full captured-contract local PostgreSQL/PostgREST suite, authorization matrix, management lifecycle, guards, integrity comparator, historical edits, restrictive FK, concurrent deactivation, plus category-only multi-row classification, cross-Job/group/Rework/temporary-label preservation, rollback on a later-row rejection, batch deactivation race, inactive-caller change denial and omitted-ID behavior. Only disposable fixtures mutated.
- Browser: **23/23 tests** across `manpower-add-line`, `manpower-product-categories`, `manpower-snapshot-products`, and new `manpower-bulk-category`. All business/auth requests mocked. Seven new tests cover one historical row, multi-row/multi-Job/multi-group assignment, active/inactive choices, exact payload/fact preservation, unchanged hours, Job pivots/filter reconciliation, Snapshot period classification, stale-category rejection, omitted-row response, uncertain committed response, failed reconciliation/retry selection, and >100 limit. Existing 16-test gate remains intact.
- Desktop and 390px visual review. `tmp/bulk-category/desktop.png` and `tmp/bulk-category/narrow.png` retained in this worktree. Narrow Job/Label button clipping found during review and corrected without behavior changes; final browser assertion checks its text fits.

Test corrections during this pass: TypeScript required an explicit `unknown` cast for the query-builder double. A new DB assertion initially assumed an inactive caller's no-op category PATCH would be omitted. The installed compatibility policy plus unchanged-category trigger branch intentionally allows unrelated/no-op updates; the test now verifies an actual assignment change is denied and preserves all row fields. No authorization policy was altered. Final corrected checks passed.

## Exact changed-file boundary versus Production (19)

Client (8):

- `src/lib/dev-branding.mjs`
- `src/modules/manpower/ManpowerWorkspace.tsx`
- `src/modules/manpower/ProductLaborSummary.tsx`
- `src/modules/manpower/ProductLaborDistribution.tsx`
- `src/modules/manpower/product-reporting.ts`
- `src/modules/manpower/manpower.ts`
- `src/modules/production/snapshot.ts`
- `src/modules/production/components/MonthlySnapshot.tsx`

Verification (7):

- `scripts/verify-dev-branding.mjs`
- `scripts/verify-early-access.mjs`
- `scripts/verify-manpower-product-category-db.mjs`
- `scripts/verify-manpower-bulk-category.mts`
- `tests/e2e/manpower-product-categories.spec.ts`
- `tests/e2e/manpower-snapshot-products.spec.ts`
- `tests/e2e/manpower-bulk-category.spec.ts`

Records (4):

- `docs/workflows/PRODUCTION_PIPELINE.md`
- `docs/project-memory/2026-09-21-manpower-reporting-polish.md`
- `docs/project-memory/2026-09-21-manpower-bulk-category-candidate.md`
- `docs/project-memory/evidence/2026-09-21-manpower-bulk-category-read-only.json`

Incremental boundary from `3d437db`: two client files (ManpowerWorkspace and manpower.ts), the database verifier, new bulk client verifier, new bulk browser spec, this record and read-only evidence. Approved Product reporting, Snapshot and badge code is preserved.

## Release boundary, next Chris action, hygiene

No implementation blocker. Review this new combined candidate and authorize its **client-only** promotion/push/deployment when ready. No migration, RPC, RLS, historical classification or category deactivation is part of that authorization. Do not release `3d437db` separately. A future General / Shared deactivation is a separate, conditional data action requiring explicit approval. Client rollback restores `840672811`; keep the already-applied category schema and any human classifications.

Original VS Code worktree `/Users/chrisngo/source/repos/tenarten-inventory-ui` remains on clean `dev`. Local `dev`, `main`, and `origin/main` all remain `840672811841c9376d44568841dc8689a7fe461b`. All generated evidence is in this isolated worktree or `/tmp`. No Unified/Specialty Catalog, Sample/Tutorial worktree or archived ref was edited. The combined candidate is committed locally with clean tracked/untracked Git status; ignored build/test artifacts remain for review.
