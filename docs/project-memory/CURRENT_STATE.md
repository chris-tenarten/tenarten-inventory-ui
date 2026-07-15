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

Current behavior:

- each Pending Receival material row can be unrestricted, linked to a Production job, or assigned an unlinked temporary label
- the Pending Receivals queue opens collapsed and retains an actionable incoming-shipment count in its accessible header
- linked and temporary identities are mutually exclusive
- exact unique job-number matches are backfilled; ambiguous or name-only legacy values remain temporary
- receipt propagation retains reservation identity and notes without reselection
- Inventory aggregation treats reservation identity as part of the balance identity
- linked Inventory badges use current job data and focus the corresponding Production Pipeline job
- inactive linked jobs remain visible and retainable in Edit mode
- legacy earmark text fields remain for transitional compatibility

The AL Statehouse Pending Receivals queue and related document imports remain deferred and have not been populated by this pass.

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
