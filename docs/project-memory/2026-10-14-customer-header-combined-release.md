# Customer List + UPDATE header — combined release preparation

**READY for Product release approval. NOT RELEASED.** Chris accepted the implementation and authorized local candidate commits. Tier 3 release preparation; existing Testing Level 3 evidence reused. No feature redesign, new app implementation, hosted writes, migrations, imports, canonical push, Edge deployment or Pages deployment.

## Candidate identities

| Boundary | SHA |
|---|---|
| Current fetched origin/main and origin/dev | `1d34f1800635336157f25db10206f7a4938d23ae` |
| Contact Configuration candidate | `3191e615f0316b876b698bcaaa83ea2b5240c707` |
| Complete accepted header candidate | `5a8f35d199149d078027c1472e0629d10b900f53` |
| Combined application boundary | `b76d24336323fec624c240b442cfb614bd85b17e` |
| Protected TenDev Sample Matcher branch | `950dd714da215eaf5a3ad0b351aa344b80e09064` |

Combined worktree: `/private/tmp/tenops-combined-release`, branch `release/customer-list-update-header`. Its final HEAD additionally records this preparation packet; resolve with `git rev-parse release/customer-list-update-header`. The Contact and header worktrees remain intact on their original feature branches. Original canonical worktree’s unrelated dirty release documents are untouched. No stash, reset, clean or discard used.

The header candidate includes all accepted changes beyond 83c634b. The isolated combined branch applies only 83c634b plus the accepted visual overlay commit, after the Contact candidate. All 14 app files match the accepted worktree bytes exactly; disjoint paths and no conflict. Canonical branches are unchanged.

## Current hosted compatibility — read only

Current Production project `vxdxjhazkqhpkwdqtobp` metadata exactly matches the validated baseline: Jobs columns, constraints, triggers, policies, grants; capability rows and function bodies; relevant directory objects; and migration ledger. No candidate RPC name collision. No directory or protected snapshot tables are installed yet. Existing Jobs authenticated SELECT remains permissive true; inactive users may still read Jobs under that existing policy. This release does not tighten or broaden it.

New directory and snapshot SELECT requires existing active-user `readOperationalData`, including active read-only users. Anonymous snapshot reads have no grant; inactive queries return no rows. Writes use existing Production editing capabilities; shared directory edits/archive remain elevated Lead/Admin, and the importer requires Admin manageUsers + writeBusinessData. The invoker Project save RPC preserves existing Jobs RLS and guards.

Hosted job_activity remains publicly readable under existing grants/policies. Current aggregate check found **zero** rows containing the three structured contact snapshot/link keys. Accepted app activity serialization strips those fields and their values; focused synthetic activity checks found zero leaks. This is a scoped check of structured feature payloads, not an audit of arbitrary historical free text. No activity RLS changes.

Six new migration versions are absent from the hosted ledger. Ledger has 30 receipts, unchanged. Earlier legacy receipt gaps remain; do not replay unrelated migrations or use blanket `db push`. Verified ledger columns support exact version/name/statements receipts in the prepared transaction.

## Required migrations, in dependency order

| Migration | SHA-256 |
|---|---|
| `20261014190000_production_contact_configuration.sql` | `039d2ee95ad675872ba55a1c3223990fc77687ddc1b1c794f266a6c1c3c94ee4` |
| `20261014210000_production_customer_list.sql` | `b6f257c71a99ad7f90400aecf502af70900cd83632faf53ab0df1ab00672ea66` |
| `20261014220000_protected_job_contacts.sql` | `7c4400586f4b194ec8cd911385736b0093fb9e1254002a3a34fa81fc2500867f` |
| `20261014221000_defer_project_contact_detachment.sql` | `f0ab637f6a383ee3bd3ee4fd209fa0fcd56374aaa9df69170da34f005a20fe21` |
| `20261014222000_preserve_archived_project_contact_refresh.sql` | `1c4f8ac2537bdf30e59394dcfbd8872709f891cd604009e2866238c10d95050a` |
| `20261014230000_approved_historical_customer_names.sql` | `c9a65289ab1b7c8e2e10a4b5b87dd79e36917be12eb93d6da85839f656fb12c8` |

Offline artifact generator: `node scripts/prepare-contact-release-transaction.mjs`. It writes `output/combined-release/contact-migrations.sql` plus checksum manifest, connects to no database and executes no SQL. Prepared bundle SHA-256: `4bf588678d150714b4ca118a1aa6f84351bbf9bcf19cb189aa4f04b39820dcd3`. Outer transaction strips only original outer transaction wrappers and records each exact migration version/name/body. Duplicate receipts fail/roll back rather than replay silently. Five-second lock timeout avoids waiting indefinitely; an error rolls back all six. Artifact has been generated and inspected, **not executed**.

Apply all six inside this one reviewed transaction before exposing the new app/API. The early candidate’s temporary Jobs contact columns must never become a committed intermediate schema. The protected migration restores the original Jobs columns and keeps RLS/grants intact. Hosted has no candidate captures, so its copy-to-snapshot step inserts zero historical rows; importer installation does not execute an import. No historical Jobs, customer text, timestamps, existing documents, or issued document snapshots are updated.

## Final current-hosted import preview

Preview timestamp: `2026-10-14T22:25:00.141Z`. Complete stable pagination retrieved 41/41 Jobs and a terminal empty page. All 41 are active; 22 distinct nonblank names; no blank values or case/whitespace duplicate groups; directory absent. Exactly these 20 approved names are ready to insert as company names only:

| Approved customer | Current result |
|---|---|
| Atlantic Exterior Wall Systems | Would insert name only |
| Batson Cooke | Would insert name only |
| Buslam | Would insert name only |
| Camarata | Would insert name only |
| Camarata Masonry Systems | Would insert name only |
| Coral Reef | Would insert name only |
| DePaoli Mosaic | Would insert name only |
| IB SUPPLY | Would insert name only |
| IntraState Terrazzo | Would insert name only |
| Joseph Cohn & Son | Would insert name only |
| LX Granite | Would insert name only |
| MTT | Would insert name only |
| RNC Concrete Coatings | Would insert name only |
| Spectra CF | Would insert name only |
| Superior | Would insert name only |
| Superior Terrazzo & Finishes | Would insert name only |
| T. Yorie Corp. | Would insert name only |
| United Enterprises, Inc | Would insert name only |
| Williams | Would insert name only |
| Williams Tile & Marble | Would insert name only |

Excluded: `[Place Services] temporary`; `INTERNAL TEST — NOT A CUSTOMER`. Camarata/Camarata Masonry Systems, Superior/Superior Terrazzo & Finishes, and Williams/Williams Tile & Marble remain separate identities. No inferred contacts. Existing name-only import evidence is reused: clean first run inserts 20; repeat inserts zero; configured/archive/ambiguity and concurrency behavior validated. Current preview agrees exactly with the unchanged approved manifest. Recheck preview if hosted names change before separately approved import; never expand the function’s exact 20-name boundary.

## Header activation and branding

Accepted trigger: blue SVG lightning + UPDATE, to the right of the complete branding block; no underline, border or background. Compact square What's New popover, dismissal, session entrance and reduced-motion behavior retained. Below 360px the accepted compact form shows only the lightning. No copy or visual redesign.

`PERFORMANCE_ACTIVATED_AT` remains **null**. Preparation starts no countdown. At separately approved actual Production activation, set and record the real UTC activation timestamp in an activation-only release step; verify the deployed value and exact seven-day exclusive expiry. Do not reuse a preparation/build/review date. A null timestamp keeps the hosted indicator hidden. This timestamp and its resulting final release artifact remain gated by Product release approval.

Combined `node scripts/verify-dev-branding.mjs` passed: TenOps Production branding/environment separation and TenDev RESEARCH & DEVELOPMENT remain intact. Production shell still uses OPERATIONS CONTROL. Target only the established TenOps Pages/Supabase Production configuration after approval; do not use local synthetic exports or review credentials. No environment/configuration file changed. TenDev Sample Matcher deployment/branch remains untouched.

## Validation reused and preparation checks

- Accepted protected Contact gate: 10 database checks + 10 browser workflows; authorized and denied direct queries, inactive denial, atomic rollback, historical compatibility, snapshot preservation/refresh, archive handling, Jobs RLS stability, no contact activity leaks. TypeScript, targeted ESLint and isolated Production build passed.
- Exact 20-name importer idempotency/duplicates/concurrency validation and Customer List UX receipts reused.
- Header responsive/interaction/branding and seven-day/dismissal receipts reused, including final positioning correction. The older verifier’s desktop label assertion was aligned from PERFORMANCE UPDATE to accepted UPDATE; app bytes unchanged, no broad verifier rerun.
- New checks only: fetched canonical refs; exact combined diff and byte-boundary inspection; migration dependencies/checksums and offline transaction preparation; current hosted metadata/RPC/grant compatibility; current import preview; Production branding preflight; diff check and offline generator syntax. **Zero new builds; zero broad suites.**
- Historical DB verifier scripts for the earlier Jobs-column stages remain evidence/replay tools for those stages. The protected gate is the current final schema gate; do not run the obsolete-stage verifiers against the protected schema.

## Remaining risks and proposed safe release sequence

No material hosted contract drift or unresolved accepted-UI defect found. Release remains gated by Chris’s explicit authorization for each hosted/canonical action. Operational risks: short Jobs DDL lock acquisition; temporary candidate schema if migrations are applied individually; stale preview before later import; unreconciled legacy migration receipts; activation timestamp/artifact still unset. These are handled by the narrow transaction, fresh preflight and release gates. There has been no combined runtime/build rerun; the accepted independent app validation is reused as requested, with exact disjoint-source reconciliation and branding preflight.

1. Product approves the exact Contact/header candidate SHAs, combined boundary and migration checksums, plus the hosted migration/import/canonical release actions. Fetch again and stop if canonical or hosted contracts drift.
2. Confirm only established TenOps Production targets and real Production configuration; preserve TenDev. Obtain the approved backup/restore point and verify the six versions remain absent. No blanket migration replay.
3. Apply the exact six-migration reviewed outer transaction and matching ledger receipts. If any statement or receipt fails, rollback; do not deploy the dependent app.
4. Narrowly verify final hosted schema/RLS/grants/RPCs, unchanged Jobs contracts/historical rows, denied anonymous/inactive snapshot access, and safe activity payloads before application promotion. Any write smoke tests need explicitly authorized safe records.
5. Re-preview the approved 20 names. Only after separately authorized Admin execution, run the parameterless approved importer; inspect results and idempotent repeat. Do not modify Jobs or resolve duplicate/archived identities automatically.
6. Promote only the approved combined boundary to canonical and build one final Production artifact from real Production configuration. At authorized actual Production activation, set/record the activation UTC rather than starting a preparation clock. Deploy TenOps only, then verify branding, customer selection/contact protection, public activity payloads and seven-day announcement behavior.
7. Record final canonical/deployment/activation/migration/import receipts. If application rollback is necessary, the additive protected directory/snapshot schema remains in place; do not destructively reverse migrations or delete imported names.

STOP FOR PRODUCT RELEASE APPROVAL. DO NOT DEPLOY.

## Exact combined changed-file boundary

- `docs/project-memory/2026-10-14-customer-access-and-import-review.md`
- `docs/project-memory/2026-10-14-customer-header-combined-release.md`
- `docs/project-memory/2026-10-14-historical-customer-import-review.md`
- `docs/project-memory/2026-10-14-performance-header-review.md`
- `docs/project-memory/2026-10-14-production-contacts-local-review.md`
- `docs/project-memory/2026-10-14-production-customer-list-local-review.md`
- `docs/project-memory/2026-10-14-protected-project-contact-integration.md`
- `docs/project-memory/customer-import-approved-2026-10-14.json`
- `docs/project-memory/evidence/2026-10-14-customer-access-and-import.json`
- `docs/project-memory/evidence/2026-10-14-customer-header-combined-release.json`
- `docs/project-memory/evidence/2026-10-14-customer-header-import-preview.json`
- `docs/project-memory/evidence/2026-10-14-historical-customer-import.json`
- `docs/project-memory/evidence/2026-10-14-performance-header-final-trigger.json`
- `docs/project-memory/evidence/2026-10-14-performance-header-review.json`
- `docs/project-memory/evidence/2026-10-14-performance-header-visual-review.json`
- `docs/project-memory/evidence/2026-10-14-production-contacts.json`
- `docs/project-memory/evidence/2026-10-14-production-customer-list.json`
- `docs/project-memory/evidence/2026-10-14-protected-project-contact-integration.json`
- `scripts/import-approved-customers-local.mjs`
- `scripts/prepare-contact-release-transaction.mjs`
- `scripts/preview-historical-customers.mjs`
- `scripts/start-performance-header-review.mjs`
- `scripts/start-production-contact-review.mjs`
- `scripts/support/customer-import.mjs`
- `scripts/support/production-contact-local.mjs`
- `scripts/verify-customer-access-and-import.mjs`
- `scripts/verify-historical-customer-preview.mjs`
- `scripts/verify-performance-header.mjs`
- `scripts/verify-production-contact-browser.mjs`
- `scripts/verify-production-contact-db.mts`
- `scripts/verify-production-customer-list-browser.mjs`
- `scripts/verify-production-customer-list-db.mts`
- `scripts/verify-protected-project-contacts.mjs`
- `src/app/client-layout-shell.tsx`
- `src/components/PerformanceAnnouncement.module.css`
- `src/components/PerformanceAnnouncement.tsx`
- `src/lib/performance-announcement.mjs`
- `src/modules/production/ProductionWorkspace.tsx`
- `src/modules/production/components/ProductionJobCreator.tsx`
- `src/modules/production/components/ProductionJobInspector.tsx`
- `src/modules/production/contacts/CustomerInspector.tsx`
- `src/modules/production/contacts/ProjectContactEditor.tsx`
- `src/modules/production/contacts/model.ts`
- `src/modules/production/contacts/queries.ts`
- `src/modules/production/jobs.ts`
- `src/modules/production/types.ts`
- `src/modules/production/update-normalization.ts`
- `supabase/inspection/20261014_combined_contact_release.sql`
- `supabase/inspection/20261014_customer_import_compatibility.sql`
- `supabase/inspection/20261014_customer_snapshot_access.sql`
- `supabase/migrations/20261014190000_production_contact_configuration.sql`
- `supabase/migrations/20261014210000_production_customer_list.sql`
- `supabase/migrations/20261014220000_protected_job_contacts.sql`
- `supabase/migrations/20261014221000_defer_project_contact_detachment.sql`
- `supabase/migrations/20261014222000_preserve_archived_project_contact_refresh.sql`
- `supabase/migrations/20261014230000_approved_historical_customer_names.sql`

[Machine release evidence](evidence/2026-10-14-customer-header-combined-release.json) · [Final import preview](evidence/2026-10-14-customer-header-import-preview.json).
