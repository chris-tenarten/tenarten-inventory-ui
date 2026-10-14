# Production Contact Configuration — local Product review, October 14, 2026

> The operator-facing UX in this report is superseded by the [customer-list revision](2026-10-14-production-customer-list-local-review.md). This report and its evidence retain the original candidate history.

Status: implemented and validated locally; stopped for Product review. Production release, hosted migration application, push and deployment remain unauthorized.

## Candidate identity and isolation

- Canonical main/dev base and feature HEAD: `1d34f1800635336157f25db10206f7a4938d23ae`.
- Branch: `feature/production-contact-configuration`.
- Worktree: `/private/tmp/tenops-production-contacts`.
- Candidate commit SHA: **none**. Changes are uncommitted; local implementation authorization did not explicitly authorize a commit. HEAD is the base, not a completed feature commit.
- SHA-256 content fingerprint of the 14 implementation/migration/verifier files: `bca304ee7c4ca4bce1cc93e5c0d5213f031bfe0d6f38081744b2eeed48498fb3`. Per-file hashes and actual validation outcomes are recorded in [evidence](evidence/2026-10-14-production-contacts.json).
- Original `dev` working tree and its nine unrelated untracked release-memory files were preserved. Existing branches/worktrees, including the held performance-header candidate, were not changed.

## Data and persistence contract

One narrow forward migration: `supabase/migrations/20261014190000_production_contact_configuration.sql`.

- `production_companies`: reusable company identity, optional phone, email, mailing address and notes; timestamps and UUID.
- `production_contacts`: named contact belonging to one company, optional email, phone, title and notes; timestamps and UUID. Multiple contacts per company are supported.
- `jobs`: nullable `customer_company_id`, `customer_contact_id`, and flat JSONB `customer_contact_snapshot`. Existing `jobs.customer` is retained. Composite FK prevents a contact from being associated with the wrong company.
- Snapshots capture company/person names, both phone/email types, title, mailing address and notes. Company/contact notes are combined in the Project capture; shared records keep them separate.
- Shared directory edits never update Jobs or documents. Project-only edits preserve the saved link as provenance but change only captured values. Explicit confirmed refresh captures current saved values into the Project draft and requires the existing Project Save action.
- Free-text customer edits remain supported. Changing customer text through a legacy editor detaches old links/capture rather than retaining misleading contact identity. New selection changes only customer and the three new fields.
- Existing Jobs require no directory link. No historical backfill, name matching, record merging, Bid import, document rewrite or extra Production Job model was introduced.

## Operator experience

New Job → Create Blank Job → Customer / Contact. One contextual selector separates **Configured Customers** from **Previously Used Names**, with company-only and named-person choices. Add New Customer / Contact opens an inline configuration dialog. Company name is required for a saved company; a named contact requires a contact name and company. All supplemental fields are under collapsed **Additional Information (Optional)**. Customer remains optional for Project creation.

The Inspector uses the same editor and offers **Edit for this Project**, **Edit saved contact** when authorized, and **Refresh from saved contact**. Contact configuration blocks ordinary save/close while unfinished; configuration Cancel restores access. No separate management page was added.

Loaded-Job-derived native datalist suggestions remain intact in the workspace and existing inline/Planning Issues editors. Choosing a historical name does not create a directory record. **Save as reusable customer** is explicit. **+ Add contact** on a configured company adds a person without copying or editing the company identity.

## Authorization and RLS

No role bundles or existing authentication functions were changed.

- Viewing: existing `readOperationalData` capability and table SELECT RLS.
- Creating directory records and capturing/overriding Project contacts: `writeBusinessData` plus at least one of `createProductionJob`, `editProductionJobRoutine`, or `editProductionJobDetails`.
- Shared edits: `writeBusinessData` plus `editProductionJobDetails`, currently Lead/Admin in the canonical role contract.
- Existing free-text customer editing keeps its existing generic `writeBusinessData` path. The new contact-specific controls do not replace or broaden legacy Jobs authorization.
- Authenticated directory table writes are revoked; save RPCs enforce capability checks, required fields, existing-company identity, atomic writes and optimistic timestamp checks. No delete RPC or authenticated DELETE grant is supplied.
- Jobs trigger validates new snapshots and permissions even for raw Jobs writes; FK and field whitelist/length checks enforce the persistence contract. Unrelated Job changes take the unchanged path.
- Stale shared edits use SQLSTATE `55000`, avoiding repeated PostgREST retries of `40001` for an application precondition failure.
- Local checks verified Member/Guest/Developer/read-only/inactive shared-write denial, anonymous denial, direct-write/delete denial, invalid links/payloads, and active reader visibility. The directory is intentionally shared with authorized Production readers; it does not query or import Bids, Proposals or private account content.

Hosted policies/grants were not reverified and this migration was not applied to hosted Supabase. Before any separately authorized hosted application, verify that `editProductionJobDetails` still maps to the approved shared editors and inspect the current Jobs/capability contracts narrowly. Local fixtures use the exact current capability function and a representative compatibility Jobs boundary, not a full replay of every historical module migration.

## Performance and boundaries

No directory initialization was added to the shell or workspace startup. The browser recorded zero directory lookup requests before selector use. Current Jobs retrieval adds the three snapshot/link columns to its existing request; no extra startup request is made.

Lookup is debounced, on demand, prefix-based by company or person name, and bounded to 21 results (20 visible plus a next-page sentinel). Ordering is stable by company name/UUID and contact name/UUID. Prefix indexes and company/contact indexes are prepared; offsets are capped at 10,000, after which search should be refined. No hosted-scale timing claim is made from the small fixture.

Bid conversion, CRM, document generation, issued snapshots, Samples, Color Plate Labels, Sample Matcher, Production Blend, Material Readiness, Messaging, authentication, PWA, released retrieval logic, and the performance-header candidate are outside this implementation diff. Future LoT work can consume Project snapshots, but no recipient integration was implemented.

## Validation

Tier 3 / Testing Level 3 was used because the feature adds reusable records, RLS/RPC authorization and a Job persistence contract.

- `tsx scripts/verify-production-contact-db.mts`: PASS, eight grouped contracts covering company-only/named creation, optional details, multiple contacts, raw/RPC authorization, snapshot preservation/override/refresh, stale edits, duplicate-name independence, historical compatibility, invalid payload/link denial, stable pagination, literal wildcard handling and authorized shared visibility.
- `node scripts/verify-production-contact-browser.mjs`: PASS, ten grouped workflows covering actual Project create/edit/save/reopen, shared editing/refresh, historical datalist/selector compatibility, explicit historical reuse, adding a person to an existing company, Member denial and mobile layout. No external origins or page exceptions occurred.
- TypeScript `tsc --noEmit`: PASS.
- Targeted ESLint across changed application/verifier files: PASS.
- `git diff --check`: PASS.
- Production build: PASS, Next 16.2.2 Turbopack compilation, TypeScript and all 22 static pages. Build used an isolated copy with real local dependencies so the live review stayed available. Initial build-copy attempts failed on an external dependency symlink and omitted support files; the complete copy passed. No application changes were needed for those setup failures.
- Desktop selector/configuration and 390px mobile captures were visually inspected. Screenshots and raw local results are in `output/production-contacts/` (ignored review artifacts).

The first database pass found the stale-precondition retry issue and it was corrected before the successful clean-database pass. Browser corrections added stable accessible names to optional fields and completed coverage through the existing creation confirmation dialog. Final production source was built successfully. No unrelated historical suites or document-generation suites were run.

## Local review

**http://localhost:3001/** — actual TenOps, isolated Supabase at `http://127.0.0.1:55581`, disposable synthetic users/data only. Chris explicitly chose port 3001 to preserve the held header review on port 3000.

- Admin: `contact-admin@example.invalid`
- Lead: `contact-lead@example.invalid`
- Member: `contact-member@example.invalid`
- Shared local-only password: `Local-contact-review-2026!`

Select **Review Stoneworks** to choose Morgan Review, Taylor Review or Company only. **Historical Stoneworks** remains on the historical Project and in suggestions. Synthetic `Browser Contact …` Projects demonstrate persisted captures and overrides. Use Admin/Lead for shared editing, then Member to verify the shared-edit control is absent and Project-specific editing remains available; direct Member RPC denial is also verified.

The review stack supplies empty supporting-module fixtures and disables unrelated Storage/Realtime services; unrelated shell requests can show local fixture warnings. It is not a general-purpose full-environment acceptance stack. Documents and unrelated workflows were not exercised. Start/reseed instructions are in `scripts/start-production-contact-review.mjs`; its commands reject hosted URLs and never load hosted `.env.local` values in this worktree.

## Exact changed files

- `src/modules/production/ProductionWorkspace.tsx`
- `src/modules/production/components/ProductionJobCreator.tsx`
- `src/modules/production/components/ProductionJobInspector.tsx`
- `src/modules/production/jobs.ts`
- `src/modules/production/types.ts`
- `src/modules/production/update-normalization.ts`
- `src/modules/production/contacts/model.ts`
- `src/modules/production/contacts/queries.ts`
- `src/modules/production/contacts/ProjectContactEditor.tsx`
- `supabase/migrations/20261014190000_production_contact_configuration.sql`
- `scripts/start-production-contact-review.mjs`
- `scripts/support/production-contact-local.mjs`
- `scripts/verify-production-contact-db.mts`
- `scripts/verify-production-contact-browser.mjs`

Plus this review and `docs/project-memory/evidence/2026-10-14-production-contacts.json` (16 files total).

## Remaining release gates

Product review/acceptance; separate authorization for any commit, hosted schema application, push or release; narrowly verified hosted compatibility/authorization; and exact approved release-boundary validation. The feature is not hosted-ready until its migration is approved and applied. No Production test records were created.
