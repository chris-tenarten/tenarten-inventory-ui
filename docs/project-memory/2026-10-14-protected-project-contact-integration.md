# Protected Project contact integration — local review

Option B is integrated locally. Candidate remains **uncommitted** on `feature/production-contact-configuration`, based on `1d34f1800635336157f25db10206f7a4938d23ae`. Actual app review remains http://localhost:3001 by Chris’s explicit port exception; the accepted header remains on 3000.

## Access and schema

`public.production_job_contacts` is a one-to-one extension keyed by `job_id` (PK/FK to canonical Jobs, cascade on deletion), with nullable company/contact links and a validated independent JSON snapshot. Company/contact composite FK prevents cross-company links. There is no historical name backfill. The forward migration copies only already-present local candidate captures and removes the three candidate-only Jobs columns. Original Jobs columns, customer text, grants and RLS are preserved. No issued document changes.

Authenticated SELECT requires `readOperationalData`; inactive users receive no rows, anonymous users lack grants. Snapshot writes require existing Production contact-edit capabilities. Directory read/write/archive authorization remains unchanged. Snapshot data is loaded with an RLS-filtered embed for one opened Inspector; list/startup loads have no contact embed or extra directory queries.

`save_production_project` is SECURITY INVOKER, whitelists Job fields, and executes Job + snapshot saves in one transaction under existing Jobs RLS/guards. Invalid snapshots roll back creation/editing including timestamps. Explicit update of existing snapshots preserves archived links; new archived associations remain blocked. A deferred narrow trigger detaches stale snapshots after legacy customer-text changes, while allowing explicit refresh to complete atomically. No Job policies were altered by feature migrations.

Activity metadata filters out all three protected fields and values. Recent synthetic browser workflow activity produced zero contact leakage matches. Existing pre-integration local test activity is not release data; no hosted contact candidate was installed. The feature does not rewrite historical activity or Jobs.

## Focused Tier 3 / Testing Level 3 evidence

- 10 database checks passed: authorized/read-only reads, anonymous/inactive denial, denied writes, Jobs SELECT * without contact columns, create/edit rollback, preservation, legacy compatibility, policy stability, importer compatibility. A transaction temporarily simulated hosted broad Jobs reads: inactive could read Jobs, protected snapshot count remained zero, then rollback restored fixture policy.
- 10 browser workflows passed at localhost:3001: creation/editing, customer selection, optional details, historical names, shared permissions, archival, Project overrides and explicit refresh of archived links, mobile and keyboard use. No external requests/page errors.
- TypeScript, targeted ESLint, diff check and isolated Production build passed. No unrelated broad suites rerun.
- Existing importer validation reused, not re-imported. Exact 20-name manifest hash unchanged; excluded names and distinct similar-name pairs preserved. Name-only importer has no dependency on Jobs or snapshots.
- Accepted header app hashes verified unchanged, including uncommitted overlay; no header merge.

## Release review and blockers

Recommend combined release preparation after Product accepts this local increment. Do not release the earlier Jobs-column contact candidate by itself. The directory migrations and all three forward corrections must be applied inside a reviewed encompassing transaction before API/application exposure; the importer migration only installs the Admin RPC and does not import automatically. Append-only corrections preserve already-applied local migration history.

Remaining blockers: Product approval of integrated contact candidate; exact combined header/contact boundary and candidate commit; separately authorized hosted migration transaction and narrow hosted authorization/schema smoke verification; separately authorized Admin 20-name import; final combined app review and release/deployment authorization. Legacy migration receipt gaps remain a reconciliation concern, not permission to replay migrations. No hosted writes, push, commit or deployment performed.

## Exact increment files

- `src/modules/production/jobs.ts`
- `src/modules/production/ProductionWorkspace.tsx`
- `scripts/start-production-contact-review.mjs`
- `scripts/verify-production-customer-list-browser.mjs`
- `scripts/verify-protected-project-contacts.mjs`
- `supabase/migrations/20261014220000_protected_job_contacts.sql`
- `supabase/migrations/20261014221000_defer_project_contact_detachment.sql`
- `supabase/migrations/20261014222000_preserve_archived_project_contact_refresh.sql`
- `docs/project-memory/2026-10-14-protected-project-contact-integration.md`
- `docs/project-memory/evidence/2026-10-14-protected-project-contact-integration.json`

The earlier accepted Contact Configuration/Customer List files and approved importer remain part of the larger uncommitted candidate; this list identifies only this final integration increment. Machine evidence: [integration evidence](evidence/2026-10-14-protected-project-contact-integration.json).

## Release preparation acceptance

Chris accepted this complete local implementation for combined release preparation. A local candidate commit is now authorized; earlier uncommitted/approval statements describe the implementation checkpoint. No hosted release, migration, import, canonical push or deployment is authorized. Current hosted contract and final import preview are recorded separately in the combined release report.
