# TenOps Project Manifest

TenOps models operations, not software. The application should evolve around how work moves through the business rather than around isolated screens, tables, or features.

> **Canonical project constitution**
> Read this document before planning, reviewing, or implementing TenOps work. Then inspect the current repository and relevant live schema. This document defines durable product intent and engineering direction; source code and migrations define implemented behavior.

## 1. Purpose and authority

TenOps—Tenarten Operations Control—is Tenarten's internal operations platform for managing work from operational handoff through production, inventory, labor reporting, completion, and eventually shipping and performance analysis.

TenOps is not a generic ERP, project-management clone, low-code builder, or recreation of Monday.com. It preserves operational workflows Tenarten already trusts while replacing the structural limits of spreadsheets, disconnected files, and flat boards.

Use this authority order when sources disagree:

1. The live Supabase schema and verified deployed behavior define operational reality.
2. Checked-in migrations and application source define intended implementation.
3. This manifest defines enduring product, architecture, UX, and engineering direction.
4. Focused schema and workflow references may provide detail, but cannot override current code, migrations, or this manifest.
5. Historical notes and context-transfer documents are evidence, not authority.

Identify discrepancies before extending the system. Do not preserve stale behavior merely because an older document describes it.

## 2. Vision

The primary question TenOps should answer is:

> What work needs attention, what is scheduled, what is blocked, and what is happening in the shop?

Production is the center of gravity. A job is the central operational entity. Inventory, reservations, labor, material usage, production output, attachments, forms, purchasing, quality control, shipping, notes, and activity should relate to a job where meaningful.

TenOps should provide a connected operational history for each job without requiring users to understand database relationships. Users work with project names, job numbers, people, materials, and processes; stable internal IDs remain hidden.

Success is operational clarity and adoption, not feature count. A workflow succeeds when the intended user can recognize the next action without software training.

## 3. Product philosophy

### Preserve workflows, not software limitations

Excel forms, notebooks, and Monday boards reveal how work is actually performed. Preserve useful mental models and terminology, but replace duplicated entry, flattened relationships, fragile formulas, and manual reconciliation with relational data and guarded workflows.

### Combine familiar density with relational integrity

TenOps combines:

- Excel-like scanning and dense data entry
- Monday-like convenience, attachments, and visibility
- stable relational identities
- automatic defaults and derived values
- validation, audit history, and correction
- cross-job reporting without duplicate source data

### Keep stable concepts opinionated

TenOps is not a generic form builder. Core transaction shapes remain controlled: jobs have identity and state; schedules have planned boundaries; labor records hours; inventory records quantities and reservation identity; material usage records consumption; production reports record output; attachments belong to jobs; and activity records meaningful changes.

Business reference lists may be configurable. Fundamental data shapes should not be arbitrary.

### Allow incomplete operational handoff

A job may enter Production before every identifier, material detail, or schedule date exists. Project name is the minimum identity. The UI should expose missing planning information without blocking useful early entry.

### Architecture is stable; feature order is fluid

Implementation order may respond to operational urgency, user enthusiasm, an adoption opportunity, or newly discovered pain. Opportunistic sequencing is acceptable when module boundaries and data integrity remain coherent.

## 4. Users and operating contexts

Current users include office administrators, production planners, warehouse staff, and production leadership. Named internal stakeholders currently include Chris, Gio, Anthony, Marcos, and Pat.

- **Desktop:** primary planning, administration, dense editing, Timeline interaction, and reporting.
- **Tablet:** important future first-class experience for review, receiving, light editing, and shop mobility.
- **Phone:** secondary viewing and light actions; do not compress every desktop interaction into a narrow screen.
- **Shop display:** future simplified weekly production board with minimal interaction and strong distance readability.
- **Leadership mobile:** future purpose-built status, risk, and KPI experience rather than a responsive copy of desktop tables.

The abandoned responsive/PWA experiment is not part of the product. Future mobile work begins with task-specific information architecture, not a squeezed desktop UI.

## 5. Operational workflow model

### Production handoff and planning

A job enters the Production Pipeline when it becomes an operational commitment: award, approval to proceed, deposit, or internal handoff. It may initially lack a job number, work order, requested delivery date, labor estimate, or planned dates.

Planning readiness is derived separately from Production Status and Material Status:

- **Not Scheduled:** both planned dates are not present.
- **Planning Needed:** scheduled, but one or more planning fields are missing.
- **Planning Complete:** planned dates, job number, requested delivery, labor estimate, and customer are present.

Readiness is guidance, not a permission system and not proof that the job is unblocked.

### Schedule planning and approval

Timeline, Table, Inspector, and Complete Setup feed one serializable staged schedule collection keyed by job ID. Each proposal preserves job ID, original dates, original `updated_at`, proposed dates, changed boundaries, and change source.

Multiple jobs may be staged simultaneously. Re-editing updates that job's proposal. Returning a job to persisted dates removes only that proposal. View changes, filters, inspector use, and Timeline zoom must not discard proposals.

No planned-date edit saves automatically. Users review, discard, or submit staged changes through one approval flow and atomic batch RPC. Ordinary non-schedule fields use their own editing workflows.

### Material readiness

Material Status values are `unknown`, `not_ready`, `ordered`, and `ready`. `ordered` means procurement started but all required material has not arrived; it remains blocked. Only `ready` means production can proceed from a material-readiness perspective.

### Inventory and receiving

Pending Receivals represent incoming material. A receival can be unrestricted, linked to a canonical Production job, or assigned a temporary work label. Canonical and temporary reservation identities are mutually exclusive.

Receiving preserves material identity, quantity history, location, pallet, notes, and reservation identity. Inventory aggregation includes reservation identity so unrestricted and job-reserved stock never merge incorrectly. Canonical links use `jobs.id`; temporary labels support work not yet in Production.

Pending Receivals open collapsed with an attention-oriented count. Inventory Activity is transaction history. Catalog is a supporting reference tool.

### Manpower reporting

Manpower Reporting records labor by reporting group, work date, worker, task, work identity, AM hours, PM hours, notes, and attribution.

Persistent reporting groups organize entry and review; they are not jobs. Work identity is either a Production job or temporary label, never both. Workers and tasks are stable references with display order and active state. Historical references are deactivated rather than deleted.

Total hours derive from AM plus PM and are not stored. Client-side search covers group, date, worker, task, job name/number, temporary label, notes, and entered-by. Search changes displayed rows and totals without changing persistence or ordering.

### Attachments and forms

Job attachments are private storage objects with relational metadata. Users can upload multiple files, open and remove them, and access them through the shared Inspector. Attachment counts remain visible near job identity.

Forms currently demonstrate Quote and Letter of Transmittal placeholders. No document-generation, template, or persistence engine exists yet.

### Future operational reporting

Material Usage, Daily Production, and Manpower remain distinct because they describe different facts and may be entered at different times:

- Material Usage: material consumed for a job and date.
- Daily Production: output completed for a job and date.
- Manpower: where labor time was spent.

These streams should later support actual-versus-estimated labor, consumption, throughput, and bottleneck analysis without becoming one generic report.

## 6. Application and module architecture

### Technology

- Next.js App Router, React, and TypeScript
- Tailwind CSS utility styling
- Supabase JavaScript client
- PostgreSQL, RLS, Storage, and PL/pgSQL RPCs through Supabase
- Cloudflare production deployment from `main`

The application uses client-heavy workspaces. Shared domain helpers should isolate Supabase access and normalization where practical rather than scattering persistence logic across visual components.

### Routing and navigation

- `/` — Production workspace and dashboard
- `/production` — compatibility route to Production
- `/manpower-reporting` — Manpower Reporting; navigation label: Production Reporting
- `/inventory` — Inventory and Pending Receivals
- `/catalog` — supporting Catalog tool
- `/activity` — supporting Inventory Activity tool
- `/transactions` — legacy route outside primary navigation

Primary navigation is Dashboard, Production Reporting, and Inventory. Catalog and Inventory Activity are supporting tools.

### Production module

`src/modules/production` owns domain types, data helpers, readiness rules, material-status mapping, schedule calculations, staging, batch contracts, status visuals, and components.

Production has synchronized views:

- **Overview:** default operational scan and job entry point.
- **Table:** dense administrative editing with save-on-blur for ordinary fields.
- **Timeline:** Days, Weeks (default), Months, and Year modes with staged drag, resize, and keyboard adjustment.

The shared Inspector provides details, editable planning fields, attachments, and Recent Changes. Planned dates remain separate from ordinary drafts and always use batch staging.

Production status values are `not_started`, `on_deck`, `in_production`, `on_hold`, `shipped`, `complete`, and `cancelled`. Shared visual definitions keep bars, badges, and legends consistent.

### Inventory module

Inventory is implemented primarily in `src/app/inventory/page.tsx`, coordinating balances, adjustments, Pending Receivals, reservations, receiving, and transaction writes. This concentration is functional but a known maintainability boundary. Extract domain types, normalization, aggregation, and persistence helpers before major expansion, preserving identity and receipt behavior.

### Manpower module

`src/modules/manpower` owns types, Supabase helpers, and workspace behavior. Entries load as one report collection; filtering, grouping, and totals are client-derived.

### Shared shell and access gate

`src/app/client-layout-shell.tsx` owns header, navigation, internal access, and logout. The current access gate and schedule approval password are client-visible MVP friction, not authentication or security.

## 7. Data architecture

### Central entities

`public.jobs` is the canonical operational job table. Its UUID is the stable identity used by attachments, activity, manpower, and inventory reservations. Relationships must not depend on mutable names or job numbers.

`public.job_activity` is the readable event stream for creation, ordinary edits, schedule changes, attachments, and future events. Metadata retains `changed_fields`, `old_values`, and `new_values` for business-facing transitions.

`public.job_attachments` stores metadata; files live in the private `job-attachments` bucket.

### Inventory entities

The inventory foundation includes `inventory_items`, `inventory_transactions`, `pending_receivals`, `vendor_catalog`, `vendor_catalog_v2`, and `processed_webhooks`.

Reservation migrations add `production_job_id` and `temporary_job_label` across receivals, balances, and history. Legacy earmark fields remain transitional; new behavior uses canonical reservation columns.

### Manpower entities

- `manpower_reporting_groups`
- `manpower_workers`
- `manpower_tasks`
- `manpower_entries`

`reporting_group_id` is organizational. `job_id` and `unlisted_work_label` describe mutually exclusive work identity. Total hours are derived.

### Schedule ledger and archive

`public.production_schedule_batches` is a private idempotency ledger recording normalized requests and canonical results. Application users do not query it directly.

The `archive` schema retains inactive legacy, backup, staging, and reference objects for recovery or inspection. New code must not treat them as active tables.

### Reference-data rules

Use stable IDs, display names, sort order, and active state for evolving lists. Deactivate rather than delete references needed by history. Never expose internal IDs to users.

## 8. Authoritative RPCs

### `save_production_schedule_batch(jsonb, text, text, uuid)`

This is the only allowed persistence path for existing Production planned-date changes. It validates and normalizes requests, locks jobs deterministically, checks original dates and `updated_at`, rejects an entire conflicting batch, updates atomically, writes one activity event per changed job with a shared batch ID, returns canonical rows, supports idempotent replay, and rejects a recorded batch ID reused with different content.

It is `SECURITY DEFINER`, owned by `postgres`, uses a controlled `search_path`, keeps its ledger private, and grants execution to current MVP roles. Never restore the removed direct schedule update plus separate audit sequence.

### `receive_pending_receival_with_reservation(uuid, text)`

This is the authoritative Pending Receival receipt path used by Inventory. It preserves receipt behavior while propagating canonical or temporary reservation identity into Inventory and transaction history.

Migration `20260714_006_harden_inventory_reservation_receipts.sql` reconciles environments that received an earlier migration 005 revision. Do not replace this RPC without inspecting the live definition, grants, constraints, and every call site.

### Legacy receipt function

The database historically contained `receive_pending_receival`, whose original live definition was not initially checked in. New code uses the reservation-aware RPC. Treat untracked live functions as schema drift requiring inspection and forward reconciliation.

## 9. Database and migration standards

- Migrations are append-only ordered SQL under `supabase/migrations`.
- Never edit an applied migration to fix live behavior; add a forward-only migration.
- Use transactions where PostgreSQL permits.
- Fail clearly when predecessor schema is absent.
- Make repeat execution safe where practical without hiding incompatibility.
- Preserve data, grants, ownership, RLS, `SECURITY DEFINER`, and controlled `search_path` when replacing functions.
- Avoid destructive `DROP/CREATE` when replacement is sufficient.
- Pair high-risk migrations with inspection and post-migration verification SQL.
- Verification fixtures should roll back.
- Record manual application state explicitly; repository presence does not prove deployment.

Current migration order:

1. `20260713_001_database_groom_phase1.sql`
2. `20260713_002_production_mvp_jobs.sql`
3. `20260713_003_job_attachments.sql`
4. `20260714_001_manpower_reporting_mvp.sql`
5. `20260714_002_manpower_reporting_groups_and_import_correction.sql`
6. `20260714_003_normalize_manpower_reference_order.sql`
7. `20260714_004_manpower_entries_delete_policy.sql`
8. `20260714_005_inventory_production_job_reservations.sql`
9. `20260714_006_harden_inventory_reservation_receipts.sql`
10. `20260716_001_add_ordered_material_status.sql`
11. `20260716_002_atomic_production_schedule_batch.sql`

Current project records state that reservation, Ordered Material Status, and atomic scheduling migrations were manually applied and verified in the intended Supabase project. Inspect any target environment before assuming the same state.

## 10. Security model and limitations

The application is an internal MVP with permissive anonymous policies and client-side access/approval gates. Public build variables, browser checks, and local/session storage are inspectable and bypassable.

Therefore:

- do not expose sensitive commercial data without access control
- do not describe current gates as authentication
- do not rely on client validation for authorization
- do not put secrets in `NEXT_PUBLIC_*`
- do not log or document passwords, keys, or tokens
- do not stage `.env.local`

Real authentication, role-based authorization, least-privilege RLS, server-authoritative identity, and protected administration are required before broader access or sensitive features.

## 11. UX principles and design language

### Dense, industrial, information-first

Use compact tables and controls, restrained cards, minimal decorative chrome, clear hierarchy, familiar terminology, strong scanability, and low cognitive load.

### Preserve direct manipulation and explicit commitment

Fast ordinary edits may save on blur with clear feedback and recovery. High-impact schedules remain staged and require review, attribution, approval, and explicit save. Never announce success before canonical returned data confirms it.

### Keep actions discoverable

Pending work remains visible during scroll and Inspector use. Attachment indicators sit near job identity. Collapsed Pending Receivals retain an operational reminder. Avoid actions hidden in accidental empty hit areas.

### Accessibility is correctness

Use semantic controls, labels, keyboard operation, visible focus, practical pointer targets, readable contrast, and appropriate ARIA. Decoration must not intercept interactions. Never rely on color alone.

### Shared visual semantics

Status badges, Timeline bars, and legends use shared mappings. On Hold uses a strong diagonal pattern; Shipped uses a softer distinct pattern; other statuses remain solid. Segmented controls have one connected boundary, full-height active segments, stable dimensions, and independent adjacent actions. Dirty, saving, error, selected, and disabled states must not shift layout.

### Responsive direction

Desktop remains authoritative. Tablet receives deliberate future adaptations. Phone becomes a leadership/light-action experience. Do not remove desktop capability for superficial mobile compatibility.

### Visual language

- Neutral slate surfaces with restrained status color.
- Compact uppercase labels only where hierarchy benefits.
- Strong typography hierarchy, modest shadows, and limited nesting.
- Tables use predictable widths, truncation, tooltips/titles, sticky identity, and honest horizontal scrolling.
- Project and customer get more space than codes, dates, statuses, and numbers.
- Icons supplement semantics; they do not replace accessible names.
- Future polish should reduce wireframe-like borders and nested-box noise without obscuring operational boundaries.

## 12. Engineering standards

### Scope discipline

- Inspect current code before acting; summaries may be stale.
- Make the smallest coherent change that satisfies the operational objective.
- Do not mix unrelated cleanup into feature work.
- Preserve user changes in dirty worktrees.
- Prefer shared domain helpers over duplicated persistence or normalization.
- Derive related UI state and global actions from one source of truth.
- Remove compatibility code only after every call site is proven migrated.
- Do not add architecture solely for hypothetical reuse.

### Data and audit discipline

- Normalize no-op updates before writing.
- Reconcile UI from returned canonical rows.
- Keep failed staged work available for retry or discard.
- Preserve original baselines through repeated staged edits.
- Use stable IDs for relationships and snapshots only where historical display requires them.
- Render audit events with friendly labels and readable old/new values.
- Destructive operations require confirmation, dependency awareness, and durable audit design.

### Code organization

- Routes compose workspaces; domain modules own types and persistence helpers.
- Components avoid direct Supabase access when a domain helper is appropriate.
- Shared calculations and visual mappings have one implementation.
- Timeline uses explicit pointer zones and pointer capture, not native HTML drag-and-drop.
- Preserve date-only values as calendar dates; avoid timezone shifts from unnecessary `Date` conversion.

## 13. Verification standards

Verification is proportional to risk and distinguishes inspection from runtime proof.

Baseline Production commands:

```text
npm run build
npm run lint
node scripts/verify-production-update-normalization.mjs
node scripts/verify-production-schedule-staging.mjs
git diff --check
git status --short
```

Run targeted ESLint on changed TypeScript. Repository-wide lint currently has known `react-hooks/set-state-in-effect` baseline findings and image warnings; report them without broadening scoped work to fix them.

For behavior changes:

- restart a fresh development server when stale bundles are plausible
- test in a real browser
- inspect network calls when write counts matter
- verify refresh persistence, failure retention, and retry
- restore designated live test data
- never claim browser, network, database, or deployment verification from source inspection

For database changes:

- inspect columns, constraints, indexes, policies, definitions, ownership, and grants
- verify exact target identity
- use disposable rollback fixtures where possible
- test valid transitions, invalid rejection, and restoration
- record manual application state

Before commit or promotion:

- inspect status, complete and cached diffs, untracked files, and divergence
- scan for debug code, temporary IDs, secrets, logs, screenshots, caches, and scratch SQL
- stage explicit paths rather than `git add .` or `git add -A`
- stop on conflicts, failed required verification, rejected pushes, unexpected divergence, secrets, unexplained migrations, or destructive requirements

## 14. Git and deployment workflow

Normal flow is:

```text
dev → main → Cloudflare Production
```

- Develop and commit on `dev` unless explicitly directed otherwise.
- Push and verify `origin/dev` before promotion.
- Merge `dev` into `main` with a merge commit after verification.
- Build and run domain verifiers again on `main` before pushing.
- Cloudflare Production deploys from `main`.
- Report the full `main` hash expected to deploy; do not claim success without Cloudflare evidence.
- Never force push, reset, rebase, delete branches, or rewrite history without explicit authorization.
- Preserve unrelated local work and stage only intended paths.
- Never commit `.env.local`, credentials, caches, logs, screenshots, or scratch files.

Feature branches are not the default. Use one only when explicitly required.

## 15. Current roadmap

Roadmap order may respond to operational need, but current direction is:

### Near term

1. Production smoke testing and stabilization of atomic multi-job scheduling.
2. Archive and Restore Jobs while preserving activity, files, reservations, and history.
3. Correct Manpower group-name edit-field contrast without changing behavior.
4. Extract Inventory domain logic before substantial receiving/reservation expansion.
5. Improve attachment batch staging, classification, and feedback.

### Operational expansion

1. Material Usage linked to jobs and inventory.
2. Daily Production and configurable output metrics.
3. Actual-versus-estimated labor and material reporting.
4. Production KPIs and bottleneck visibility.
5. Job Workspace expansion across production, materials, labor, files, forms, notes, activity, QC, shipping, and purchasing.

### Platform maturity

1. Real authentication and RBAC.
2. Least-privilege RLS and server authorization.
3. Authenticated actor identity for audit and approvals.
4. Dedicated leadership mobile experience.
5. Tablet-focused workflows.
6. TV-friendly weekly Shop View with minimal interaction and optional job-file access.

### Deliberate deferrals

- generic custom-field/form-builder systems
- normal-UI hard deletion of operational jobs
- automatic schedule optimization, resource leveling, or dependency scheduling
- configurable shop calendars until requirements are confirmed
- full phone parity with desktop
- broad restyling mixed into functional milestones

## 16. Known technical debt

### Security

- Client-side access and approval are not secure.
- Anonymous mutation policies are too permissive.
- Actor attribution is user-entered rather than authenticated.

### Application structure

- Inventory combines extensive domain and UI logic in one page.
- Some app areas import Supabase directly instead of domain services.
- Repository lint has known effect-state and image findings.
- The starter root README is obsolete and does not describe TenOps.

### Data and workflow

- Legacy inventory earmark fields coexist with canonical reservations.
- Live schema history predates checked-in migrations; inspection remains essential.
- Material readiness is broad job state rather than derived requirements.
- Labor intensity uses inclusive calendar days without capacity, holiday, or planned-workday modeling.
- Forms are placeholders.
- `archived_at` exists but Archive/Restore UX is incomplete.
- Permanent deletion lacks authenticated, dependency-aware durable audit.

### UX

- Desktop is stronger than tablet and phone.
- Manpower group-name editing needs accessible contrast.
- A dedicated polish pass should reduce border weight, nested boxes, and inconsistent hierarchy without redesigning workflows.

## 17. Working agreements

Before work:

1. Read this manifest.
2. Inspect branch, status, relevant source, and migrations.
3. Identify protected or unrelated local changes.
4. Confirm whether implementation, migration application, staging, commit, push, or deployment is authorized.
5. State assumptions that materially affect scope.

While working:

- communicate concise progress and blockers
- treat rendered browser behavior as authoritative for UI defects
- preserve partial failures and user drafts
- avoid exposing secrets in commands, output, docs, or commits
- never apply migrations to an unidentified environment
- prefer forward fixes over rewriting applied history
- update docs only when identity, architecture, workflow, or reality materially changes

When finishing:

- report exactly what changed and verified
- distinguish automated, browser, network, database, and deployment evidence
- report remaining manual verification
- report final Git status and intentionally uncommitted files
- never claim an unobserved push, migration, or deployment

## 18. Documentation policy

This manifest evolves with enduring product direction and material architecture. It is not a changelog, transcript, prompt collection, or transient task list.

Keep separate only documents that benefit from focused detail:

- exact schema references verified against the database
- migration-specific inspection and rollback procedures
- user-facing operating procedures
- complex workflow specifications too detailed for this constitution
- durable architecture decision records for consequential tradeoffs

When a separate document conflicts with this manifest or current implementation, update or retire it. Do not create another bootstrap document. Future context transfer begins with this file and repository inspection.
