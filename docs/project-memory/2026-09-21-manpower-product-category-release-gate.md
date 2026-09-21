# Manpower Product Categories — final hosted migration/release gate

Status: **STOPPED AT RELEASE GATE.** Tier 3. Product behavior is approved. Hosted reads and disposable local tests only; no hosted migration, business-data mutation, push, deployment or release was performed. This report describes a release candidate, not an already-installed feature.

## 1. Frozen candidate

Branch: `release/manpower-product-categories-20260921`, worktree `/private/tmp/tenops-manpower-release-gate`. The candidate SHA is the commit containing this report and is reported in the delivery message; obtain it with `git rev-parse release/manpower-product-categories-20260921`.

Parent/current main verified remotely: `2e9d472b957a461600623041550f797e35a73538`. The original implementation checkout remains dirty and untouched by candidate staging/commit. The main changes since initial baseline `9ac45208ae2485f6281cfe302b4f45f97aa1eab4` are two already-main Sample UI commits; they are preserved as ancestry, not reintroduced as feature changes. No wholesale dev merge. If main advances again, inspect/revalidate the new release boundary before promotion.

## 2. Exact migration

`supabase/migrations/20260921_001_manpower_product_categories.sql`

SHA-256: `b4df3ccd1f49cbfc32de91582e9b9bc00cd8325069aa4efa2cc4a98b682d0865`

One transaction. It adds the category table, six editable reference records, exactly two role-capability records, audit/validation functions and triggers, category RLS/grants, a nullable UUID FK with **no default**, and supporting indexes. No UPDATE/DELETE/INSERT of historical Manpower, Jobs, Tasks, Workers, Rework or reporting groups. No classification inference/backfill, no Work Order relationship, no existing RLS rewrite.

The nullable/no-default column is additive metadata; existing row values remain NULL and no existing row UPDATE trigger fires. FK/index creation scans/locks existing data but does not rewrite business values. Existing reporting functions/views are not replaced. The application corrects previously truncated labor totals by loading all rows; that display correction is not a data mutation.

## 3. Changed-file boundary

Only these paths differ from the stated parent (the commit diff is authoritative):

- `docs/project-memory/2026-09-21-manpower-product-categories.md`
- `docs/project-memory/2026-09-21-manpower-product-category-release-gate.md`
- `docs/project-memory/evidence/2026-09-21-manpower-product-category-hosted-before.json`
- `docs/project-memory/evidence/2026-09-21-manpower-product-category-release-validation.json`
- `docs/schemas/OPERATIONAL_REPORTING.md`
- `playwright.config.ts`
- `scripts/verify-manpower-product-categories.mts`
- `scripts/verify-manpower-product-category-db.mjs`
- `scripts/verify-manpower-product-category-integrity.mjs`
- `src/lib/rbac.ts`
- `src/modules/manpower/ManpowerWorkspace.tsx`
- `src/modules/manpower/ProductCategoryManager.tsx`
- `src/modules/manpower/ProductLaborSummary.tsx`
- `src/modules/manpower/manpower.ts`
- `src/modules/manpower/pagination.ts`
- `src/modules/manpower/product-reporting.ts`
- `src/modules/manpower/types.ts`
- `src/modules/production/jobs.ts`
- `src/modules/production/snapshot.ts`
- `supabase/inspection/20260921_001_manpower_product_categories_gate.sql`
- `supabase/migrations/20260921_001_manpower_product_categories.sql`
- `tests/e2e/manpower-add-line.spec.ts`
- `tests/e2e/manpower-product-categories.spec.ts`
- `tests/support/manpower-auth.ts`

## 4. Hosted schema/RLS compatibility

Project `vxdxjhazkqhpkwdqtobp`, PostgreSQL 17.6. Read-only SQL catalog capture at **2026-09-21 19:42:08.004506 UTC**, with end-of-gate recheck recorded in the validation evidence.

- Category table/column/functions/indexes are absent. No candidate migration-ledger row or object-name collision.
- Existing entries have UUID Job/Task/Worker/Group links; nullable Rework with the composite `(rework_cycle_id, job_id)` FK; bounded numeric hours. The migration preserves all these constraints.
- Installed `has_app_capability(text)` and `require_app_capability(text)` are postgres-owned SECURITY DEFINER functions with `pg_catalog, public` search path, checking `auth.uid()` against active `app_users` and the role-capability table. Actual function definitions/ACLs were inspected; the rehearsal executes the captured definitions.
- `app_users.user_id` is a UUID primary key compatible with category actor FKs. Role checks permit `lead` and `admin`; `(role, capability)` is unique. Existing `readOperationalData` grants cover all five active application roles. Marcos is an active Lead; there are 4 active Leads and 1 active Admin. No personal promotion/grant is needed.
- Only Lead/Admin receive `manageManpowerProductCategories`. Category INSERT/UPDATE require it through RLS; active operational accounts may SELECT. No public/anon category access, and no authenticated DELETE/TRUNCATE grant. Created identity/actor fields are server controlled; renames retain IDs. The existing broad Manpower policies do not apply to the new category table.
- The entry BEFORE INSERT/UPDATE guard rejects missing/NULL/inactive categories on new entries or changed assignments and requires an active operational account. Unchanged historical NULL/inactive assignments remain editable. Clearing a classified row is rejected. `FOR SHARE` serializes assignment with category deactivation.
- Installed entry/reference triggers only stamp `updated_at`; none exist on the role-capability table. Inspected DDL event-trigger definitions handle extension grants/placeholders and PostgREST cache notifications, not business-row mutation.
- Existing permissive anonymous/authenticated Manpower entry policies remain unchanged. In particular, this feature does not make all unrelated historical entry edits/deletes Lead-only. Category management and new/category-changed writes gain their own guards; broader Manpower RBAC remediation is outside this boundary.

**Verification distinction:** installed schema, grants, actor role and helper definitions were verified hosted, read-only. The exact migration was applied only to disposable PostgreSQL 17.6 with captured hosted authorization functions, all relevant policies/grants, matching labor column shapes/constraints, and synthetic business fixtures. Direct SQL and real local PostgREST JWT requests passed the anonymous/inactive/Guest/Member/Developer/Lead/Admin matrix, lifecycle, duplicate/reserved names, audit spoofing, NULL/clearing/inactive enforcement and two-session deactivation race. No post-migration hosted enforcement claim is made before authorization/application.

## 5. Historical integrity baseline and comparison

The baseline uses one **REPEATABLE READ, READ ONLY** transaction, UTC, canonical PostgreSQL JSONB text. SHA-256 every complete protected row; for entries exclude only the future `product_category_id` field. Aggregate fixed-length row hashes in ID order, then relation hashes in relation-name order. This includes timestamps, notes, all hours and identity/link fields. A separate reporting digest groups Job/Task/Rework/Group counts and AM/PM/total hours. Only hashes and entry IDs are stored, not raw historical row content.

| Baseline | Count | Hours |
| --- | ---: | ---: |
| All Manpower | 1,674 | 7,200 |
| Job-linked | 955 | 4,059 |
| Unlinked | 719 | 3,141 |
| Rework (subset of linked) | 35 | 119 |
| Classified historical entries | 0 | — |

18 Jobs have labor. Protected relations contain 40 Jobs, 25 Tasks, 21 Workers, 38 reporting groups and 1 Rework cycle. Labor dates span 2026-03-05 through 2026-09-17.

- Complete protected-data digest: `b8e1d2db88cd962f359c53bd1af59f8f39cf6261d8eebef35b7c591d7ae542f5`
- Complete entry-row digest: `6d0dd262c3c0f4bab10dffe566cbd20ce7257308f1e7ee053ce745398113a1d6`
- Reporting digest: `167f00c5a8a37c60dc88bfa4916e8a5588e93c4c0ac6a213d7e6655a5082a2db`

Evidence: [hosted baseline and schema/RLS metadata](evidence/2026-09-21-manpower-product-category-hosted-before.json). The read-only capture is `supabase/inspection/20260921_001_manpower_product_categories_gate.sql`. Comparison is `node scripts/verify-manpower-product-category-integrity.mjs BEFORE.json AFTER.json`; it fails on changed digests/counts/manifest, non-NULL history, incorrect grants or missing guard/column. The disposable migration produced identical pre/post row/reporting hashes and exercised both passing and failing comparisons. **The actual hosted post-migration digest is pending; none was fabricated.**

At cutover recapture a fresh baseline under a confirmed write pause. Today's digest proves today's state, not that operators cannot legitimately change data before release. Compare immediately after migration and before smoke writes/reopening work. Pause writes to all six protected relations during this short comparison window; unexpected differences block reopening and require investigation, not backfilling or rewriting data to make hashes pass.

## 6. Rollback strategy

Before COMMIT, any migration failure rolls back the transaction; keep the preceding client in place. Use a short session lock timeout (for example 5 seconds) so a busy database causes an aborted attempt instead of an indefinite queue; investigate and retry only within the approved window.

After COMMIT, retain the additive schema, categories and all assignments. Prefer a compatible forward fix while writes remain paused. A client-only rollback to pre-feature main cannot restore entry creation because that client omits the required category. Do not drop the column/table, delete classifications, disable the guard or change historical hours/links as routine rollback. Any temporary compatibility migration requires separate review and Chris authorization. Record the previous client deployment and have a confirmed recoverable backup before beginning; backup availability/restore readiness was not verified in this gate. Never restore over unrelated concurrent business changes as an automatic rollback.

## 7. Coordinated migration + client release

1. Chris authorizes the exact candidate SHA, migration hash, Production push/deployment and bounded smoke/cleanup. Reconfirm remote main, project identity, candidate cleanliness, hash, unapplied state, backup recovery readiness and the operator write pause. Prepare the Production-branded client artifact from the approved SHA before touching hosted state. Record current deployment ID.
2. Coordinate a brief write pause with operators/background writers, including all six protected relations for the digest window. Capture a fresh pre-migration file using the inspection SQL. Do not proceed with unresolved activity/lock contention.
3. Apply **only** the named/hash-verified migration to the named project through the established targeted SQL path with stop-on-error and bounded lock wait. Do not run broad `db push`, apply pending migrations wholesale, or apply the superseded RBAC migration. Record this exact migration in the migration ledger using the established ledger convention; if the targeted runner does not record it automatically, reconcile the ledger deliberately after successful COMMIT (not a second SQL application).
4. After PostgREST cache reload, capture post-migration metadata and run the integrity comparator against the fresh baseline. Require all historical categories NULL, unchanged row/reporting digests/counts/hours, six active seeds in approved order, only Lead/Admin management grants, expected category RLS/privileges and the enabled guard. Verify function definitions and nullable FK match the frozen file. Stop on any discrepancy.
5. Promote only the approved candidate to main and push/deploy its Production client to existing `tenops` Pages, preserving current-main ancestry. If main push automatically deploys, perform that push only after step 4. Otherwise publish the exact built artifact via the established Pages path. No Edge function deployment is required. Record resulting Git/deployment identities and confirm the served client matches.
6. Refresh/reopen all Manpower tabs; stale pre-feature clients cannot insert. Run narrow deployed-client read checks for complete 1,674/7,200 loading (or the fresh authorized baseline), Uncategorized history, filters/pivots/reconciliation, independent Job totals and desktop/narrow layout. Under separately included explicit smoke authorization, test authenticated category lifecycle and required active-category entry saves with disposable records, deny lower roles/anonymous/inactive, then remove only the test records using authorized cleanup. Do not edit/reclassify historical entries or fabricate Jobs. A fresh pre-smoke baseline and post-cleanup integrity comparison must match; document zero residue.
7. Reopen operations only after integrity/client checks and any authorized smoke/cleanup pass. Capture the actual hosted post-release evidence and deployment IDs. No external announcement is authorized by this gate.

## 8. Validation and blockers

See [validation evidence](evidence/2026-09-21-manpower-product-category-release-validation.json) and [implementation acceptance](2026-09-21-manpower-product-categories.md). The isolated current-main candidate passes the Production-branded build, TypeScript, targeted ESLint, focused product/pagination/Rework/monthly-snapshot verifiers, captured-contract PostgreSQL/PostgREST tests, and migration integrity comparison. Final browser acceptance: **11 passed in 44.1 seconds, exit 0**, using the matching Playwright headless shell. Earlier system-Chrome worker shutdown failures are recorded in the evidence. Desktop and 390px screenshots were inspected. The matching headless browser exposed a viewport-dependent test baseline: the taller Product summary caused checkbox auto-scroll and shell-header compaction before Add New Line was clicked. The regression test uses a 1280×1100 desktop viewport to keep these controls visible and isolate the action being tested, retaining the exact no-scroll-change assertion. No application change was needed. The separate 390px layout coverage is unchanged.

No migration/schema compatibility blocker was found. Release remains blocked on **Chris's exact authorization, confirmed backup/recovery readiness and coordinated write-pause window**. Installed post-migration DML/client behavior necessarily remains pending actual authorized cutover. The old/new client incompatibility makes an uncoordinated migration unsafe operationally.

Two broader legacy source verifiers have previously confirmed baseline-stale assertions (`verify-production-pipeline-integration.mjs`, `verify-rbac.mjs`); neither was changed to hide failures. They are disclosed, not claimed green. Feature-specific reporting/group/role/RLS/API checks passed. Pagination guards missing/duplicate/changing-count pages but is not a multi-request transaction snapshot; this existing architectural limit is documented and does not justify historical backfill.

## 9. Exact authorization required from Chris

“Authorize candidate **[full candidate SHA in delivery]**, based on main `2e9d472b957a461600623041550f797e35a73538`, for coordinated Production release: apply only `20260921_001_manpower_product_categories.sql` with SHA-256 `b4df3ccd1f49cbfc32de91582e9b9bc00cd8325069aa4efa2cc4a98b682d0865` to project `vxdxjhazkqhpkwdqtobp`; promote/push only that candidate to main and deploy its matching Production client after integrity checks. Confirm backup readiness and coordinate the required write pause. Authorize narrowly scoped authenticated hosted category/entry smoke with disposable fixtures and complete cleanup, without editing historical business rows, creating Jobs or changing existing roles. Stop on any failed integrity or compatibility check.”

The smoke scope must be made concrete with the existing approved test identities and fixture/cleanup plan before executing writes; new users, roles or persistent business changes are not implied. If Chris authorizes release but excludes disposable hosted writes, use read-only deployed verification and explicitly leave hosted DML smoke pending. No authorization has been assumed from this gate request.
