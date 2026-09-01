# TenOps Project Manifest

TenOps models operations, not software. The application should evolve around how work moves through the business rather than around isolated screens, tables, or features.

> **Canonical project constitution**
> Read this document before planning, reviewing, or implementing TenOps work. Then inspect the current repository and relevant live schema. This document defines durable product intent and engineering direction; source code and migrations define implemented behavior.

Implementation passes also follow [`ENGINEERING_EXECUTION_STANDARD.md`](./ENGINEERING_EXECUTION_STANDARD.md) for autonomous execution, validation, browser testing, migration discipline, and completion reporting.

## 1. Purpose and authority

TenOps—Tenarten Operations Control—is Tenarten's internal operations platform for managing work from operational handoff through production, inventory, labor reporting, completion, and eventually shipping and performance analysis.

TenOps is not a generic ERP, project-management clone, low-code builder, or recreation of Monday.com. It preserves operational workflows Tenarten already trusts while replacing the structural limits of spreadsheets, disconnected files, and flat boards.

Use the authority and evidence hierarchy in the repository-root [`AGENTS.md`](../../AGENTS.md). In short: Chris and the canonical Product/Architecture context own current product intent; repository/Git state and narrowly verified hosted behavior own implementation reality; this manifest defines enduring product and architecture direction. Historical notes and conversation summaries are evidence, not authority.

Identify discrepancies before extending the system. Do not preserve stale behavior merely because an older document describes it.

## 2. Vision

The primary question TenOps should answer is:

> What work needs attention, what is scheduled, what is blocked, and what is happening in the shop?

Production is the center of gravity. A job is the central operational entity. Inventory, reservations, labor, material usage, production output, attachments, forms, purchasing, quality control, shipping, notes, and activity should relate to a job where meaningful.

TenOps should provide a connected operational history for each job without requiring users to understand database relationships. Users work with project names, job numbers, people, materials, and processes; stable internal IDs remain hidden.

Success is operational clarity and adoption, not feature count. A workflow succeeds when the intended user can recognize the next action without software training.

Production is operational reality. Planning, Inventory, Material Usage, Job Updates, Files, Reporting, purchasing, forms, and scheduling are connected perspectives on the canonical Production job—not competing applications or duplicate sources of truth.

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

### Reveal reality and reduce cognitive load

TenOps should expose blockers, dependencies, capacity, waste, and incomplete operational handoffs without creating administrative work for its own sake. Prefer contextual actions, sensible defaults, progressive disclosure, and stable mental models. Build process and infrastructure before optimization. The interface should feel like reliable industrial equipment: predictable, purposeful, and mechanically understandable rather than decorative or magical.

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

Purchase Orders, Proposals, and Transmittals are implemented structured document domains. Draft/preview behavior is separated from immutable issuance/history and retryable private PDF generation where applicable. Generic Proposal creation can exist independently of a Production Job and must be reused by future Pre-Production work. A generic Sample Form Generator remains planned and must not be implemented before its Product Acceptance Contract.

### Operational reporting

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
- `/purchasing` — structured Purchase Orders, issuance, PDFs, and receiving projection
- `/catalog` — supporting Catalog tool
- `/activity` — supporting Inventory Activity tool
- `/material-usage` — Material Usage reporting
- `/proposals` — Proposal generator and generic Proposal workspace
- `/transmittals` — Transmittal entry and document history
- `/my-work` — private/shared tasks, workload, attachments, and Inbox
- `/settings` — account and administrative settings
- `/transactions` — legacy route outside primary navigation

Navigation has expanded beyond the original Dashboard/Production Reporting/Inventory shell. Treat the current shell configuration as authoritative for visible navigation. Planning remains job-scoped and does not add a top-level route.

### Production module

`src/modules/production` owns domain types, data helpers, readiness rules, material-status mapping, schedule calculations, staging, batch contracts, status visuals, and components.

Production has synchronized views:

- **Overview:** default operational scan and job entry point.
- **Table:** dense administrative editing with save-on-blur for ordinary fields.
- **Timeline:** Days, Weeks (default), Months, and Year modes with staged drag, resize, and keyboard adjustment.

The shared Inspector provides details, editable planning fields, attachments, and Recent Changes. Planned dates remain separate from ordinary drafts and always use batch staging.

Planning is an optional job-scoped Inspector layer linked to canonical Production jobs. Production remains authoritative for identity and schedule. A job may have at most four coordination Phases—Overlay and Planning Only count—while unlimited Pause intervals remain operational Timeline interruptions outside that cap. Phases contain Items; Pause does not create new Items. Only Overlay and Pause annotate the Timeline, and Items never become Timeline lanes. Phase Library definitions own curated default Overlay colors and are copied into independent job Phases without a live behavioral link. See [`PLANNING.md`](../workflows/PLANNING.md).

Production status values are `not_started`, `on_deck`, `in_production`, `on_hold`, `shipped`, `complete`, and `cancelled`. Shared visual definitions keep bars, badges, and legends consistent.

### Inventory module

Inventory is implemented primarily in `src/app/inventory/page.tsx`, coordinating balances, adjustments, Pending Receivals, reservations, receiving, and transaction writes. This concentration is functional but a known maintainability boundary. Extract domain types, normalization, aggregation, and persistence helpers before major expansion, preserving identity and receipt behavior.

### Manpower module

`src/modules/manpower` owns types, Supabase helpers, and workspace behavior. Entries load as one report collection; filtering, grouping, and totals are client-derived.

### Shared shell and access gate

`src/app/client-layout-shell.tsx` owns the authenticated account gate, header, navigation, and logout. Operational approval controls remain separate from application authentication.

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

### `undo_pending_receival_receipt(uuid, text, text)`

Migration `20260722_001_pending_receival_undo.sql` links future receipts to their exact Inventory lot and intake transaction. Undo is transactional and audit-preserving: it marks the intake as reversed, writes a compensating adjustment, restores the queue row, and refuses to proceed after subsequent lot activity. Receipts created before this lineage exists require manual reconciliation.

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
12. `20260721_001_atomic_inventory_reservations.sql`
13. `20260722_001_pending_receival_undo.sql`
14. `20260722_002_purchasing_phase1.sql`
15. `20260722_003_purchasing_phase1_1_simplification.sql`
16. `20260722_004_purchasing_optional_charges.sql`
17. `20260722_005_purchasing_vendor_configuration.sql`
18. `20260722_006_purchasing_reference_data.sql`
19. `20260722_007_remove_vendor_import_notes.sql`
20. `20260722_008_vendor_catalog_bulk_pricing.sql`
21. `20260723_001_purchase_order_issuance.sql`
22. `20260723_002_vendor_catalog_truckload_pricing.sql`
23. `20260723_003_purchase_order_issuance_column_resolution.sql`
24. `20260723_004_purchase_order_pdf_documents.sql`
25. `20260723_005_purchase_order_pdf_v2.sql`
26. `20260723_006_purchase_order_number_allocation.sql`
27. `20260723_007_arim_catalog_skus.sql`
28. `20260723_008_purchase_order_pending_receivals.sql`
29. `20260723_009_purchase_order_pdf_snapshot_pgcrypto_path.sql`

Current project records state that reservation, Ordered Material Status, and atomic scheduling migrations were manually applied and verified in the intended Supabase project. Inspect any target environment before assuming the same state.

## 10. Security model and limitations

TenOps now includes authenticated account and RBAC infrastructure, but authorization maturity varies by surface and some legacy/internal-MVP boundaries remain permissive or client-authorized. Public build variables, browser checks, and local/session storage are inspectable and are never security boundaries.

Therefore:

- do not expose sensitive commercial data without access control
- do not describe client-side gates as authentication
- do not rely on client validation for authorization
- do not put secrets in `NEXT_PUBLIC_*`
- do not log or document passwords, keys, or tokens
- do not stage `.env.local`

Authentication/RBAC infrastructure and later enforcement/compatibility migrations now exist. Security maturity is surface-specific: inspect actual grants, RLS, RPCs, Storage, Realtime authorization, and deployed behavior before making a claim. Remaining permissive or client-authorized boundaries still require least-privilege hardening.

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

### Production interaction standards

Production is an operational workspace. Its interface guides operators toward the next meaningful action without exposing implementation details or overwhelming them with system metrics.

#### One operational question per surface

Each Production surface answers one primary question:

- **Overview:** What requires my attention?
- **Timeline:** What should be planned next?
- **Inspector:** What changes am I making?
- **Table:** What information am I managing?

Do not combine competing responsibilities merely because the underlying information is available.

#### One canonical workflow

Every significant business operation has one canonical path. Production Job creation, scheduling, attachment upload, and save operations must not acquire parallel implementations in different views. New entry points may open or extend the existing workflow; they must not reproduce its state, validation, persistence, or success handling.

#### Explicit actions

Critical operations expose a visible, purposeful affordance. Users must not have to discover Save, Schedule, Import, Update, or similar actions by clicking whitespace, changing focus, losing focus, or interacting accidentally. Direct manipulation may stage work, but the required commitment action remains explicit.

#### Busy-state protection

Every state-changing operation—create, update, upload, save, archive, import, and comparable mutations—enters a visible busy state immediately. While it runs, the initiating control prevents repeated activation and the workflow ignores duplicate rapid interactions. Interaction is restored after success or failure, and failure leaves the operator with a clear recovery path.

Busy-state protection is preferred over a confirmation dialog when the primary risk is accidental repeated execution. Confirmation is reserved for destructive, irreversible, or otherwise consequential operations; duration alone is not a reason to ask for confirmation.

#### Information hierarchy and local exceptions

Prefer actionable operational guidance over persistent statistics:

- headers summarize
- status rows communicate health
- badges identify local exceptions
- Inspectors perform work
- Timeline plans work
- Tables manage work

Do not show multiple metrics that express the same underlying state. Communicate exceptions where they occur whenever practical. Unscheduled badges, Planning Attention, and Review Issues are preferred to making operators infer local problems from global counters.

#### Business language, not implementation language

Operator-facing UI describes the work: Production Jobs, schedules, Work Orders, customers, plate numbers, reservations, shipments, and other operational concepts. Parser, provider, confidence, OCR, AI, matching algorithm, extraction engine, normalization, database, and API are implementation concepts. Keep them in code, diagnostics, logs, or developer tooling rather than ordinary Production workflows.

#### Timeline navigation purposes

The Timeline is a planning tool, not a historical archive. Its initial context prioritizes current planning decisions while completed and cancelled history remains available. Its navigation concepts stay distinct:

- **Default:** Where should I begin planning?
- **Today:** Where am I in time?
- **Fit:** Show me the complete schedule.

Do not redefine one of these controls to serve another purpose.

#### Review expectation

Evaluate future Production work against these standards before adding workflows or interaction patterns. Prefer extending the established model over inventing another one. Confirm that the proposed surface answers one operational question, uses business language, exposes consequential actions, protects mutations from repeated activation, and keeps exceptions close to the affected work.

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

1. Define the Pre-Production Bid/Sample Product Acceptance Contract; implementation is not yet authorized.
2. Reuse generic Proposal and Vendor Catalog foundations rather than creating parallel domains.
3. Continue production stabilization, security verification, and focused regression protection.
4. Extract Inventory domain logic before substantial receiving/reservation expansion.
5. Improve attachment batch staging, classification, and feedback.

### Operational expansion

1. Pre-Production Bid pipeline and generic Sample Form generation after Product acceptance.
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
- Letter of Transmittal uses narrowly scoped anonymous RPCs, private
  canonical/internal tables, sanitized history, and exact-origin CORS. This
  remains an internal MVP boundary, not caller authentication; Supabase Auth
  and RBAC are deferred.

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
- Some planned forms, including the generic Sample Form, remain unimplemented; Proposal, Purchase Order, and Transmittal foundations are implemented.
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
