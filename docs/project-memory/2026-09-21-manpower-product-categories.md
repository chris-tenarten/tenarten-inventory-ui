# Manhour Product Category — approved local implementation

Status: local candidate frozen on current main `2e9d472b957a461600623041550f797e35a73538`; initially implemented on `9ac45208ae2485f6281cfe302b4f45f97aa1eab4`. See [the final release gate](2026-09-21-manpower-product-category-release-gate.md) for the authoritative boundary and hosted inspection. **Not applied or released.** Tier 3. Chris approved the Product clarifications and local implementation on September 21, 2026; hosted migration, hosted Manpower mutation, pushing, deployment and release remain unauthorized.

## Accepted contract

- Each new labor row explicitly selects one active Product Category, immediately after Date. No automatic category default.
- Global managed vocabulary: Base, Slabs, Cove Base, Stairs, MISC., General / Shared. These are seed records, not enums.
- MISC. means another product/deliverable. General / Shared means labor not reasonably attributable to one product. Uncategorized is an unassigned historical NULL, not a managed record.
- Stable category IDs; renames update every display, including history. Different meanings require deactivating the old category and adding a new record.
- Lead and Admin receive `manageManpowerProductCategories`. No Marcos-specific grant or Admin promotion.
- Add, rename, numeric reorder, deactivate/reactivate, show inactive. No user DELETE/TRUNCATE privilege or UI deletion.
- No historical classification backfill. Historical null or inactive assignments survive unrelated edits; a classified entry cannot be cleared. Unchanged category fields are omitted from row updates so another session's classification is not overwritten by an unrelated edit.
- Category assignment preserves canonical Job, Rework, reporting group, task and hours. No Work Order field or speculative quantity metrics.
- By Task and By Product use the same facts, group by IDs and calculate in integer hundredths of an hour. Total Job Hours remain independent of product/text filters; Matching Hours and group MATCHING totals reflect filters.
- Group identity derives from all its rows. Whole-group Job changes and creation of empty groups require clearing filters. Visible-row bulk actions retain their existing explicit selection scope.

## Implementation

`20260921_001_manpower_product_categories.sql` adds the reference table and nullable FK, six seed records, name/order constraints, audit fields/triggers, narrow capability grants and authenticated RLS. Existing permissive Manpower entry/reference policies are not globally changed. New category assignments require an active operational account; category management is independently enforced for Lead/Admin.

The entry guard permits unchanged historical assignments, rejects NULL on insert or clearing, and locks a category FOR SHARE while checking active state. This serializes assignment with deactivation. The manager uses `updated_at` compare-and-set to avoid overwriting another manager's changes.

Manpower, Production labor summaries and monthly snapshot labor reads use 500-row pages, exact counts and a unique final ID order. Count changes, duplicate IDs, failed or short pages fail the load instead of publishing a partial report. These paginated requests are not a cross-request database snapshot; a refresh obtains newer edits.

Category-only refresh on selector focus/window focus preserves entry drafts. Local saves reload the category list. Category names are resolved from the current vocabulary. Initial/failed full loads do not publish zero/partial summaries.

## Evidence

- Hosted **read-only** verification using the new pagination helper: 1,674 entries / 7,200 hours; 955 Job-linked entries / 4,059 hours. Hosted schema and data were not changed.
- Logic verifier: equivalent 1,674-entry / 7,200-hour fixture, pagination failures, both pivots, decimal reconciliation, inactive/null rules, renames and Rework preservation.
- Disposable PostgreSQL tests: anonymous/inactive/Guest/Member/Developer/Lead/Admin matrix; add/rename/reorder/deactivate/reactivate; duplicate/reserved/blank names; audit spoof prevention; history preservation; required category; clearing rejection; FK deletion restriction; actual two-session deactivation race.
- Disposable PostgREST tests: signed local fixture JWTs and real HTTP requests validate direct read/insert/update/delete attempts and entry category enforcement without relying on browser controls.
- Final browser acceptance: **11 passed, exit 0**, including failure-to-load behavior; desktop and 390px screenshots inspected. An earlier run hit a Playwright worker-shutdown timeout after all assertions passed; the final run exited successfully. Browser fixtures use local mocked requests only; no hosted mutations. Tests cover management, entry edits, remote category refresh with a dirty draft, both pivots, filters, Job totals, role visibility, existing add-line/group behavior and 390px layout.
- Existing Manpower Rework and dashboard monthly-snapshot verifiers passed.
- Final TypeScript, targeted ESLint, `git diff --check` and Production build all passed.

Two broader legacy source verifiers have pre-existing stale assertions: `verify-production-pipeline-integration.mjs` expects a `sortedGroups.filter(...)` expression absent from baseline, and `verify-rbac.mjs` expects the retired header `operationalFirstName(...)` rendering. Neither was altered to mask these failures. Focused capability/RLS/API and group-filter behavior checks cover this feature.

## Commands

```sh
npx tsx scripts/verify-manpower-product-categories.mts
node --env-file=.env.local --import tsx scripts/verify-manpower-product-categories.mts --hosted-read-only
node scripts/verify-manpower-product-category-db.mjs
npx tsx scripts/verify-manpower-rework.ts
node scripts/verify-dashboard-monthly-snapshot.mjs
npx tsc --noEmit
npm run build
# Run tests/support/static-server.mjs against out/ on localhost:3000 first.
npx playwright test tests/e2e/manpower-product-categories.spec.ts tests/e2e/manpower-add-line.spec.ts --workers=1 --reporter=list
```

The database verifier creates and removes disposable local PostgreSQL/PostgREST containers. The hosted option performs SELECTs only and intentionally asserts the discovery baseline; if operators add labor later, update the expected observation explicitly instead of changing data to satisfy the test.

## Future authorized migration/release path

1. Review this candidate and the exact forward migration; resolve the two unrelated legacy verifier failures separately if required by release policy.
2. Obtain Chris's explicit hosted-migration and release authorization. Recheck the actual release boundary; do not merge dev wholesale.
3. Capture narrow pre-migration counts/hour totals and category/role state; ensure recoverable backup according to the normal release procedure.
4. Coordinate a brief Manpower entry cutover: apply the migration, verify the new objects/policies/grants, then deploy the matching client and refresh open clients. The migration enables strict insert validation immediately. Old clients cannot create labor rows afterward; do not apply it in advance of the coordinated client rollout.
5. Confirm all pre-existing IDs, hour totals, Job/Rework/group links and NULL category references are unchanged. Confirm six active seeds and capability grants for Lead/Admin only. Run approved role/API and browser smoke checks.
6. A frontend rollback does not remove the new schema or assignments. The older client cannot create valid new rows under the new guard; use a coordinated forward fix or separately authorized compatibility plan, never delete category data or disable enforcement ad hoc.

Product behavior is approved. Next Chris action: explicitly authorize the exact frozen candidate and coordinated migration/release described in the final gate. No hosted action is implied by local acceptance.
