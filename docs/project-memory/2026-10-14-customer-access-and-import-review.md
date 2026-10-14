# Customer access boundary and approved import — Product review, October 14, 2026

Status: **names approved; local importer validated; access model recommended and tested in disposable fixtures; snapshot integration remains a release blocker.** No hosted writes, migration application, import, push, commit or deployment occurred.

Chris approved the 20 proposed names, excluded `[Place Services] temporary` and `INTERNAL TEST — NOT A CUSTOMER`, and directed that similar names remain separate. That decision is recorded in [the approved manifest](customer-import-approved-2026-10-14.json). The prior report's request for name approval is superseded; no renewed approval of the same names is needed.

## Recommended access model

**B — separate one-to-one Project contact table**, tied to canonical `public.jobs`, using existing `readOperationalData` RLS for reads and existing Project-contact write authority for changes. Keep `jobs.customer` as its existing public-to-Production company-name text. Keep all optional contact details and reusable contact/company links in the protected table. Preserve the accepted Customer List UX.

| Option | Direct Supabase implications | Assessment |
|---|---|---|
| A. Contact columns on Jobs with column grants | Revoking a column grant does not override hosted table-level SELECT. Active and inactive users both use the `authenticated` DB role. Granting the contact column to that role admits both. | Can be made safe only by replacing table SELECT with explicit legacy-column grants plus a guarded detail RPC/view. This changes `SELECT *` behavior and makes permission maintenance sensitive to future columns. Poor fit for preserving existing Jobs behavior. |
| B. Separate Job contact table with RLS | Broad base Job reads remain unchanged. Direct contact-table reads are filtered by operational-read authority, including inactive-account denial. | Smallest maintainable isolation boundary. One extra table, existing capabilities, no Jobs RLS change. |
| C. Guarded view/RPC alone while raw columns stay readable | Authenticated users can bypass the wrapper and query Jobs directly. UI hiding is insufficient. | Reject as standalone protection. A security-invoker join or guarded RPC is useful as transport **over B**, without leaving raw copies on Jobs. |

The direct-query tests used real JWT/PostgREST clients against disposable local tables reproducing the verified hosted base-read contract. An inactive authenticated user could read the synthetic base Job and the legacy contact column. The same user saw **zero protected rows** from the separate table and **null contact detail** through a security-invoker left join. Active operational readers, including the read-only account, retained reads. Anonymous reads and read-only writes were denied. No hosted user was impersonated or modified.

An embedded PostgREST relationship can load the protected one-to-one row within the existing Jobs request, then map it into the current UI draft shape. This avoids an extra startup request. The invoker must retain the caller's JWT/RLS; a default owner-privileged view must not bypass the new table's RLS.

## Additional exposure path found

Fresh hosted metadata confirms that `job_activity` grants SELECT to `anon` and `authenticated` and has permissive read policies. The current local candidate's `updateProductionJob` copies all changed fields, including captured contact JSON, into activity metadata (`changes`, `old_values`, `new_values`). Moving only the live snapshot would therefore leave an indirect leak path.

Required integration rule: **never copy contact values or contact relationships into broadly readable Job activity metadata**. Keep an ordinary non-sensitive activity summary if needed; any contact-value audit history must be protected by the same access boundary. This assessment read catalog metadata and candidate source, not hosted activity contents. The feature is not hosted yet, and no existing hosted contact-data leak was observed or claimed. Unrelated existing Job activity access is not being changed in this feature.

## Required migration/application adjustments

These snapshot adjustments are a concrete implementation recommendation, **not an applied or completed isolation migration**:

1. Add a single protected `production_job_contacts` table keyed by canonical `jobs.id`, with nullable company/contact links, the existing captured JSON shape, and version/timestamp metadata. Preserve company/contact integrity constraints and snapshot field validation. Reuse current operational-read and Project-edit capabilities; do not change role bundles or Jobs RLS.
2. Move any **candidate-only local** captured values into that protected row, then remove the candidate-only snapshot/link columns and associated guards from Jobs through a forward migration. The original hosted Jobs model has none of these columns today. Do not rewrite `jobs.customer`, historical Job fields, Bids or documents; do not automatically create snapshot rows for historical hosted Jobs.
3. Move the candidate snapshot/archive-link validation to the protected persistence path. Coordinate Job name/customer saves and snapshot writes atomically, preserving existing creation, concurrency, scheduling and canonical Job contracts. Align FK cleanup behavior with existing guarded Job deletion rather than silently changing destructive lifecycle semantics.
4. Keep the accepted form/editor props and UX, but route reads through the protected relationship and exclude virtual contact fields from physical Jobs INSERT/UPDATE payloads. Use caller-scoped invoker operations or explicitly authorized RPCs. Strip contact values from unprotected Job activity writes.
5. Reconcile the two existing local-only schema migrations and the forward isolation migration as an atomic reviewed schema boundary before deploying any feature code. Do not expose an intermediate schema with readable raw snapshot columns. Preserve applied migration files unchanged.
6. Verify raw table, nested relationship, view/RPC, activity-log, inactive, anonymous and read-only paths against actual hosted ACL/RLS definitions locally. Verify legacy Jobs reads/writes, saved snapshots and accepted Customer List flows. No broad unrelated suites are required.

The accepted application source remains byte-identical to its prior validation receipt. It still uses the original candidate's Jobs snapshot storage; **it is not ready for Production until these adjustments are implemented and validated**. This turn establishes and tests the recommended boundary and prepares the importer; it does not claim to have integrated a new snapshot architecture into the application.

## Approved names importer

Prepared migration: `supabase/migrations/20261014230000_approved_historical_customer_names.sql`.

- Installs a parameterless, Admin-authorized `import_approved_historical_customers_20261014()` RPC containing exactly the 20 approved display names. Installing the migration itself does **not** populate data.
- Requires existing `manageUsers` and `writeBusinessData` capabilities; no role grant or unrelated policy is changed.
- Serializes its short transaction with a company-table write lock under Read Committed isolation. It rechecks trimmed, case-insensitive names, including archived records, while holding that lock.
- Inserts only missing company names. Optional phone, email, address, notes and default-contact fields retain empty/null schema defaults. It writes no contacts, Jobs, links, snapshots or documents.
- Returns `inserted`, `already_configured`, `archived_excluded` or `ambiguous_existing` for each approved name. Existing records are never overwritten, merged or reactivated. Multiple matching directory records are held rather than selected arbitrarily.
- No blanket normalized-name unique index is added; the existing directory permits deliberate duplicate identities. The administrative process is idempotent without changing ordinary directory behavior.
- The three specified similar-name pairs remain separate literal identities. The two excluded names do not appear in the migration's list.

Manifest SHA-256: `b643e27b743b378712171637d7bade9a455d20a597d2ff8a6c65e6d563fd4ef7`.

Local replay: `node scripts/import-approved-customers-local.mjs`. It refuses hosted targets through the existing fixed local-stack configuration, signs in only as the synthetic local Admin, and records a local receipt. **No hosted execution option is supplied.** Future hosted execution needs separate authorization and a current directory-conflict check.

## Focused verification

Tier 3 / focused Testing Level 3; prior unaffected Customer List/header/build evidence reused.

- Direct-query A/B/C access assessment: PASS as described above; existing real local Jobs/RLS were not changed to run the proof.
- Clean isolated copy of the exact importer body (only fixture table/function identifiers differ): **20 inserted; rerun 0 inserted; all optional fields empty**.
- Actual local company-table first concurrent execution: one call inserted 15 missing names while the competing call observed them as configured. Three existing active names, one archived fixture and one duplicate-name fixture were preserved. Rerun inserted zero. Subsequent runs remain idempotent.
- Raw/RPC permission checks: Member, Lead, Guest, Developer, read-only, inactive and anonymous import requests denied; Admin succeeded. Lead shared editing permission does not imply import administration.
- Existing companies, contacts, all real local Job rows and Jobs RLS remained unchanged; no fabricated contact information was imported. Excluded names were not inserted; related names retain different company identities.
- Representative actual `localhost:3001` browser check: an imported name appears in the existing bounded customer dropdown. No Job was created or saved during this check.
- Targeted ESLint and `git diff --check`: PASS. No unrelated browser, PDF, authentication or calculation suite ran. No new application build was needed because application source is unchanged.

Two local harness corrections restored disposable column-grant fixture state on reruns and allowed PostgREST schema-cache refresh for a newly created fixture RPC. The final pass succeeded. [Structured evidence](evidence/2026-10-14-customer-access-and-import.json) distinguishes the access prototype from application integration.

## Existing Jobs and preserved candidates

**Hosted Jobs:** no data, policies or grants changed. Existing company text and Production behavior remain authoritative. The importer has no Jobs DML. The recommended model preserves broad existing Jobs behavior while protecting new optional contact data separately.

**Customer List:** accepted UX/source unchanged; local review still http://localhost:3001/. The new approved names are available in the local review, subject to deliberately seeded archived/duplicate test conflicts. The clean importer fixture proves all 20 names for an empty directory.

**Header:** accepted application files, including the uncommitted visual overlay on `83c634b79db69addfd3cdac5d8f0cda86947db9f`, match their prior hashes. Port 3000, activation configuration and source were untouched. Do not reconcile from the commit alone. TenDev and the experimental Sample Matcher were not changed.

## Exact files changed in this pass

- `docs/project-memory/customer-import-approved-2026-10-14.json`
- `supabase/migrations/20261014230000_approved_historical_customer_names.sql`
- `supabase/inspection/20261014_customer_snapshot_access.sql`
- `scripts/verify-customer-access-and-import.mjs`
- `scripts/import-approved-customers-local.mjs`
- `docs/project-memory/2026-10-14-customer-access-and-import-review.md`
- `docs/project-memory/evidence/2026-10-14-customer-access-and-import.json`
- `docs/project-memory/2026-10-14-historical-customer-import-review.md`

## Remaining release blockers

1. Product review of recommended model B, followed by actual protected snapshot migration/application integration and focused access/regression validation, including the Job activity path.
2. Refresh hosted compatibility and directory comparison before separately authorized execution. The approved 20-name list stands; handle any newly encountered archive/duplicate conflicts explicitly rather than overwriting them.
3. Freeze/reconcile the accepted Customer List and exact header overlay into a combined candidate; approve header activation timing and the exact release boundary.
4. Separate explicit authorization for any commit/push, hosted migration batch, approved names population and Production deployment. No TenDev deployment is authorized.

**STOP FOR PRODUCT REVIEW. No hosted writes, push or deployment.**
