# Current State

This file describes the known implementation state at the end of the July 2026 production-pipeline work.

It should be updated whenever a feature is materially completed, removed, or restructured.

## Application identity

Primary title:

`Tenarten Operations Control`

Primary navigation:

- Dashboard
- Production Reporting
- Inventory

Supporting tools:

- Catalog
- Inventory Activity

The previous Transactions page still exists at `src/app/transactions/page.tsx`, but it is not included in primary navigation.

The Inventory Activity page remains the inventory transaction history at `/activity` and is accessible with Catalog under supporting tools rather than primary navigation.

## Manpower Reporting

Implemented as an MVP foundation at `/manpower-reporting`:

- persistent, editable reporting groups independent of work identity
- dated reporting groups sorted newest-first by their leading calendar date, with undated groups following them; groups are collapsed by default with visible totals
- compact New Group action and group-level Add labor entry rows
- row selection and group-level select-all with partial-selection state
- group-scoped bulk updates for date, job/work label, worker, and task
- confirmed, selected-row labor-entry deletion with partial-failure selection preservation
- inline creation and save-on-blur editing
- AM, PM, and derived total-hour summaries
- a shared compact work-identity control for selecting active Production jobs or entering mutually exclusive temporary labels without exposing IDs
- subtle temporary-label treatment for rows awaiting a Production job
- database-backed workers and tasks with sort order and active status
- contextual worker/task creation, renaming, sort-order management, and deactivation/reactivation
- worker/task display order normalized to positive, sequential whole numbers while preserving stable IDs and historical entries

The checked-in schema migration is `supabase/migrations/20260714_001_manpower_reporting_mvp.sql`.
Persistent reporting groups and the forward-only Monday import correction are in `supabase/migrations/20260714_002_manpower_reporting_groups_and_import_correction.sql`.
Compact worker/task display-order normalization is in `supabase/migrations/20260714_003_normalize_manpower_reference_order.sql`.
Anonymous MVP deletion access for manpower entries is in `supabase/migrations/20260714_004_manpower_entries_delete_policy.sql`; reporting groups and reference data remain non-deletable from this workflow.

## Routing

Intended behavior:

- `/` renders the primary production workspace
- `/production` redirects to `/`
- the TenOps logo links to `/`
- Dashboard is active on the production workspace

## Production Pipeline

Implemented or substantially implemented:

- production-first dashboard
- table view as default
- Timeline alternate view
- inline editing
- save-on-blur for existing rows
- explicit save for new rows
- Add Job at the bottom of the table
- project name as the only required field
- optional scheduling
- scheduled duration bars
- direct Timeline moving and edge resizing in whole calendar days, including keyboard one-day adjustments
- live current/proposed schedule previews with inclusive scheduled calendar days and derived labor-hours per scheduled day
- a compact shared-style Timeline legend covering production statuses, selective On Hold/Shipped striping, requested delivery, today, and labor-label meaning
- one-job-at-a-time staged Timeline schedule changes with a last-saved ghost bar, explicit Save/Discard controls, shared proposed dates in Table view, and accidental-loss protection
- delivery-only milestones
- visible unscheduled jobs
- compact queue summary
- search
- compact filters
- compact refresh control
- job attachments
- attachment counts
- attachment upload/open/remove
- placeholder Forms panel
- Quote placeholder
- Letter of Transmittal placeholder

User-facing terminology:

- Production Pipeline
- Table
- Timeline
- Jobs in Queue
- Unscheduled
- Add Job
- Files
- Forms

## Production data

`public.jobs` is the canonical operational job entity. Inventory and Pending Receivals now use its UUID internally for linked reservations while displaying current business-facing job numbers and names.

The `jobs` table is expected to include fields similar to:

- id
- name
- customer
- job_number
- estimate_number
- work_order_number
- contract_value
- deposit_date
- color_plate_number
- sample_submitted_date
- approval_date
- resin_po
- chip_po
- estimated_man_hours
- estimated_calendar_days
- requested_delivery_date
- planned_start
- planned_end
- production_status
- material_status
- priority
- progress_percent
- owner_name
- remarks
- archived_at
- created_at
- updated_at

Contract value is intentionally excluded from the current shop-facing production UI until access control exists.

Timeline schedule geometry and labor intensity both use inclusive calendar days, including weekends. Estimated labor is divided by every scheduled calendar day as an interim model because Tenarten may work weekends; inclusion does not imply that weekend work is always planned. A configurable shop calendar or job-specific planned production days remain future work. Missing, zero, and invalid `estimated_man_hours` values are presented as `No labor estimate`. Capacity planning, dependency scheduling, resource leveling, and automated optimization remain deferred.

Timeline moves, edge resizes, keyboard adjustments, and planned-date edits for the staged job remain local until the user explicitly saves. The proposed status bar stays interactive while a neutral dashed ghost shows the last persisted position. Save updates the canonical job and clears the comparison; Discard restores the persisted baseline without a database write. A pending change survives Table/Timeline view switches and filtering, and browser/page navigation is protected. The current deliberate scope allows one staged job at a time; multi-job planning and batch save remain future possibilities.

Staged Production schedule saves require a client-side approval dialog with a recorded Changed by name, the configured approval password, and an optional reason. The temporary internal-MVP password is supplied through `NEXT_PUBLIC_PRODUCTION_APPROVAL_PASSWORD`; its value is not stored in source or documentation. A successful password entry starts a fixed two-minute, same-tab `sessionStorage` approval window; every save still opens the dialog, requires attribution, and needs explicit confirmation. Only the name and expiration timestamp are stored—never the password. This is inspectable client-side friction, not authentication or real security.

Each confirmed schedule save writes the job dates and then a dedicated `production_schedule_changed` row to the existing `job_activity` table, including source, old/new planned dates, entered name, and optional note. These two client calls are non-atomic. If the date update succeeds but audit insertion fails, the pending state is retained and the UI requires an audit-only retry without repeating the date update. Server-side authorization, authenticated identity, and a transactional RPC remain required future work. Gating additional critical fields is deferred.

## Inventory reservations

The checked-in forward migration `supabase/migrations/20260714_005_inventory_production_job_reservations.sql` establishes canonical Production-job reservations across Pending Receivals, Inventory balances, and Inventory transaction history.

Migration `supabase/migrations/20260714_006_harden_inventory_reservation_receipts.sql` is the forward-only live-environment reconciliation for the final reservation checks and receipt RPC behavior. Environments that applied an earlier revision of migration 005 must also apply migration 006.

Migration `supabase/migrations/20260722_001_pending_receival_undo.sql` adds forward receipt lineage and the transactional `undo_pending_receival_receipt` boundary. It is checked in but must not be described as live until it has been applied and verified in the intended Supabase project.

Current behavior:

- each Pending Receival material row can be unrestricted, linked to a Production job, or assigned an unlinked temporary label
- the Pending Receivals queue opens collapsed and retains an actionable incoming-shipment count in its accessible header
- linked and temporary identities are mutually exclusive
- exact unique job-number matches are backfilled; ambiguous or name-only legacy values remain temporary
- receipt propagation retains reservation identity and notes without reselection
- newly received rows retain their exact Inventory lot and intake-transaction lineage
- Undo Receive restores an untouched receipt to Pending, reverses its Inventory quantity atomically, and records rather than deletes the original activity; stock changed after receipt is rejected for manual reconciliation
- Inventory aggregation treats reservation identity as part of the balance identity
- linked Inventory badges use current job data and focus the corresponding Production Pipeline job
- inactive linked jobs remain visible and retainable in Edit mode
- legacy earmark text fields remain for transitional compatibility

## Purchasing Phase 1

Purchasing now has a checked-in chip/aggregate draft foundation under `/purchasing`. Migration `20260722_002_purchasing_phase1.sql` was reported applied by the user. Structured Purchase Orders are the source of truth. The schema separates shared PO/line identity from chip-specific material, size, packaging, moisture, order quantity, price, and Production-job fields.

Phase 1.1 migration `20260722_003_purchasing_phase1_1_simplification.sql` was reported applied by the user. It adds the PO-level Production Job and document snapshots and removes the line requested-date override. It temporarily removed optional charge fields before the historical PO form was declared authoritative; the forward Forms Foundation migration below restores them without rewriting applied history. Catalog prices are operator-applied references only; changing material preserves manual price. Historical-price queries read issued PO lines only.

Forms Foundation migration `20260722_004_purchasing_optional_charges.sql` is checked in, and its columns were verified in live Supabase on July 22, 2026. It restores the vendor-facing optional Discount %, calculated Discount Amount, Tax %, calculated Tax Amount, Freight, and Total fields visible on the historical Tenarten PO. Temporary approved calculations apply discount to Subtotal, tax to the discounted subtotal, then add freight. Browser PO preview maps current editor state through one print model into one canonical letter-size Tenarten template with a DRAFT watermark. The same renderer is reserved for future PDF output.

Migration `20260722_005_purchasing_vendor_configuration.sql` adds structured Vendor profile fields, multiple Vendor Contacts, canonical Vendor links for maintained specialty catalog items, manual draft-number persistence, transactional saved-draft deletion, and guarded Vendor/Catalog maintenance RPCs. Selecting a Vendor ranks matching catalog entries but no longer excludes other catalog results.

Forward migration `20260722_006_purchasing_reference_data.sql` was reported applied by the user. It seeds known chip Vendors from current Tenarten references, including the known Klein and T&M contacts, without inventing missing contact details. Blank Vendor catalog prices remain blank because historical PO prices can vary by quantity and are not authoritative current catalog prices. Migration `20260722_007_remove_vendor_import_notes.sql` is checked in but not applied; it removes migration-provenance text from the user-visible Vendor and Contact Notes fields without removing or changing the configured records.

A shared `DocumentViewer` now presents rendered Forms and signed Production attachments. It previews PDF, PNG, JPEG, and WebP, retains open/download and safe unsupported-file fallback, and does not own form-specific layout. Production attachments use an embedded viewer directly below the selected list row, with optional full-screen viewing, without changing upload, deletion, storage, or inspector navigation.

Purchase Order issuance and permanent PDF generation are implemented in the current development work. Issuance captures an immutable hash-backed snapshot and remains independent from the retryable PDF pipeline. One private Storage artifact is generated per issuance exclusively from that snapshot, with visible Pending/Generating/Generated/Failed state and original-file download. Draft previews use the same normalized renderer without creating issuance, document, or Storage records. Classic and TenOps templates share bounded original-form geometry while retaining distinct restrained color treatments; template name/version are immutable at issuance.

Forward migrations `20260723_006_purchase_order_number_allocation.sql` and `20260723_007_arim_catalog_skus.sql` were verified against live Supabase on July 23, 2026. The first allocates immutable `####-###` numbers on first successful Draft save through private concurrency-safe sequence rows, using a linked Job's final four digits or stock prefix `9999`. The second adds ARIM-published marble/granite product codes to matching legacy catalog rows and carries them through line, issuance, preview, and PDF snapshots. Existing Purchase Orders are not renumbered.

Forward migration `20260723_008_purchase_order_pending_receivals.sql` was reported applied by the user and its live columns, unique index, and RPC were verified on July 23, 2026. An issued PO with a generated permanent PDF can explicitly project selected eligible immutable snapshot lines into Pending Receivals. Durable issuance/line provenance, a partial unique index, and one atomic RPC protect retries and concurrent creation. Category, quantity, unit, ETA, location, material, and size are reviewed before creation; ETA defaults blank rather than assuming the PO or Job requested date is an arrival date.

Live validation discovered that migration `20260723_005_purchase_order_pdf_v2.sql` recreated `capture_purchase_order_pdf_snapshot_fields()` without the `extensions` schema in its function search path. New issuance consequently failed when the trigger called pgcrypto `digest(bytea,text)`. Forward migration `20260723_009_purchase_order_pdf_snapshot_pgcrypto_path.sql` corrects only that function configuration; it was applied and behaviorally verified against live Supabase on July 23, 2026.

The July 23 comprehensive Purchasing validation then completed successfully against explicit `TEST-VALIDATION-*` fixtures: both document templates issued and generated permanent PDFs, retry/idempotency checks passed, 26 immutable PO lines projected to unique Pending Receivals, and two canonical Job-linked receivals were received into exclusive reserved lots. The generated test POs, issuances, documents, Storage objects, receivals, transactions, and exclusive lots were subsequently removed using an exact-ID guarded cleanup. No `test%` Purchase Orders or PO-created test receivals remained afterward.

Revisions, Project Files attachment, full receiving-against-PO reconciliation, partial receipt tracking by PO line, readiness automation, email, Vendor Invoices, and non-chip POs remain unimplemented.

## Attachments

The attachment schema and private storage bucket have already been applied in Supabase.

Known objects:

- `public.job_attachments`
- private bucket: `job-attachments`

The job attachment migration is checked into the repository at `supabase/migrations/20260713_003_job_attachments.sql`.

Current attachment UX supports multiple file selection. A future enhancement should add a clearer drag-and-drop staging area for uploading a complete job packet.

## Forms

The current Forms feature is intentionally demonstrative.

Placeholders:

- Quote
- Letter of Transmittal

No production document-generation engine exists yet.

## Active demo data

Actual job names from the Monday active-jobs export may be present with fabricated schedule dates for demonstration. Demo records were marked with:

`[MONDAY DEMO IMPORT]`

Those dates are not authoritative and should be corrected later.

## Deferred usability improvements

- draggable column resizing
- column show/hide menu
- saved table preferences
- drag-and-drop attachment staging
- per-file attachment classification
- unified Job Workspace
- real RBAC
- operational-reporting modules
- historical Monday import scripts

## Production Pipeline views

Production uses three synchronized views: Overview (the default), Table, and Timeline. The current view is remembered only for the browser-tab session. Overview provides the compact operational scan with shared status badges and attachment counts; Table retains denser inline editing and compact headers, with existing attachment counts shown beside the sticky Project name so they remain discoverable without horizontal scrolling; Timeline retains staged drag/resize planning and separates jobs without dates into a Not Scheduled setup list. The View label is separate from the segmented view buttons.

Selecting a job in any view opens a shared inspector with editable planning fields, read-only job context, attachments, and recent `job_activity` history. Existing attachment storage/list/upload/open/removal helpers are reused; count changes update Overview and Table immediately. Planned-date changes from the inspector use the existing staged Save/Discard, temporary approval, and audit path. A shared readiness helper identifies Planning Complete, Planning Needed, and Not Scheduled jobs without changing their Production statuses. Planning completeness is independent of material readiness and Production status.

Existing-job planned dates have one guarded commit path. Missing or blank approval configuration fails closed at Save and again immediately before the jobs write. Stored approval timestamps are strictly validated and cannot bypass missing current configuration; even a valid two-minute window still presents the approval dialog and requires explicit confirmation. Cloudflare requires the approval environment variable followed by a new deployment—`.env.local` affects only local builds.

## Known development conventions

- use exact file paths
- return complete replacement files
- avoid partial edits in large files
- run `npm run build` after each pass
- inspect actual file contents when an import resolves to `undefined`
- do not assume alias imports are configured
- UI components should call shared production data helpers instead of importing Supabase directly where practical

## Development health

- `npm run lint` passes with the current ESLint configuration.
- `npm run build` completes successfully with Next.js 16.
- The production normalization, Timeline preference, schedule staging, and planning-readiness verification scripts pass.
- The superseded `LoginGate` and unused `AddJobDialog` components were removed after confirming that neither had an application reference.
- Material Usage schema reconciliation is checked in as `supabase/migrations/20260720_001_material_usage_reporting.sql`, with rollback-safe verification SQL under `supabase/inspection`. It defines the report/line tables, canonical-or-temporary work identity, snapshots, RLS reads, and atomic save/delete RPCs used by the client. The migration has not yet been recorded as applied to the live Supabase project.

## Shared Production Job foundation

- Production owns the lightweight `ProductionJobReference` and selectable `ProductionJobOption` types, active Job loading, selector/reference label rules, and Production-focus navigation.
- Material Usage consumes the Production-owned option loader and types rather than defining a local Job option and querying `jobs` directly.
- Material Usage selection remains a plain autocomplete. Production owns the shared `JobTag` presentation used by Production, Inventory, and Material Usage; tags display the canonical Job name with Job-number fallback and preserve each surface's existing navigation behavior. Unlinked Material Usage reports use subdued informational text instead of a status badge.
- Inventory already consumes the Production option boundary. Manpower retains a local lightweight Job type and selectable-Job query and is a later migration candidate; this bounded pass does not change it.

## Material Usage Canonical Job Defaults

- Selecting or reassigning a canonical Job copies distinct Job Number and Work Order Number snapshots from Production.
- New reports default a blank Chip Blend Color Plate # from Production. Conflicting nonblank values require Keep Material Usage, Use Production, or cancellation before reassignment.
- Every Chip Blend row shares one editable Color Plate #. Non-Chip Blend rows display Not applicable and are normalized to no persisted plate by both client and RPC.
- Existing reports do not synchronize in the background. `Check Production Defaults` performs an explicit Color Plate-only comparison without refreshing historical Job Number or Work Order snapshots.
- Canceling a Color Plate conflict during reassignment leaves the prior Job association and all report values intact. Material Usage never writes these values back to Production.

## Inventory interface consistency

- Inventory and Inventory Activity now share the newer operational page hierarchy used by Dashboard and reporting: restrained eyebrow labels, clear page titles, rounded slate panel surfaces, compact controls, and lighter table headers.
- Current-stock search, refresh, Record Stock, activity search, activity filters, transaction badges, responsive stock cards, and desktop tables use a consistent type scale and emphasis without changing their behavior.
- Pending Receivals uses the Material Usage section language rather than the legacy ticker and dark alert band. Reservations, Record Stock, inventory detail dialogs, and activity expansion panels retain their existing workflows and protections; this pass changes presentation only.

## Production Pipeline integration

- Overview and Table share a persisted Status, Deadline, or Labor sort preference; Timeline retains its existing schedule ordering and interactions.
- Production derives Current Hours from Manpower entries and whether linked Material Usage exists from report records. These values are never copied into `jobs`, and Material Use reporting remains distinct from Production Material Status.
- Production deep-links to removable job filters in Manpower Reporting and Material Usage. A job without linked Material Usage opens a new report with the Production job preselected.
- Material Usage history uses report search as its primary discovery control. Its filter dialog supports canonical Production Status, Archived lifecycle, and Unlinked reports; focused history and new-report preselection use distinct URL parameters.
- Manpower reporting groups own their effective Job identity. Before linking, one editable Job name is inherited by every row; after linking, the canonical Production Job is shown read-only while the prior name remains preserved internally for automatic restoration on unlink.
- Job-filtered Manpower deep links omit unrelated and empty reporting groups; search operates within that filtered set and a dedicated filtered empty state is shown when no linked groups exist.
- Reporting selectors include every non-archived Production Job regardless of workflow status so historical Shipped/Complete/Cancelled work can still be linked; archived jobs remain opt-in where supported.
- Complete, Shipped, and Cancelled jobs can be soft-archived through the Inspector. Normal Production loads and shared Job selectors exclude archived jobs; Production can explicitly include them for review.
- Archived jobs exposed through Include Archived can be restored from the Job Inspector; restoration returns them to normal Production views and canonical linking selectors while recording a Job activity event.

## Dashboard Monthly Snapshot

- Dashboard has two URL-aware modes on the existing `/` route: Production Pipeline remains the default, while `?view=snapshot` opens a read-only Last 30 Days leadership summary. Browser Back/Forward synchronizes the mode.
- Snapshot metrics are derived from canonical sources without snapshot records: Production transitions use `job_activity.occurred_at`, Manpower uses `work_date`, Material Usage uses `report_date`, Inventory uses transaction `created_at`, and completed receivals use `received_at`.
- Current exception lists use the canonical current job state. Historical Started, Completed, Shipped, and late-delivery counts require trustworthy Production status activity and are not inferred from a job's current status.
- Ready to Archive reuses the existing manual `archived_at` workflow for non-archived Shipped, Complete, and Cancelled jobs. Archive remains independent of Production Status and preserves historical module relationships.
