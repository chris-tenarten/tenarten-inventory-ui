# Current State

This file describes the known implementation state at the end of the July 2026 production-pipeline work.

It should be updated whenever a feature is materially completed, removed, or restructured.

## Application identity

Primary title:

`Tenarten Operations Control`

Primary navigation:

- Dashboard
- Manpower
- Inventory
- Activity
- Catalog

The previous Transactions page still exists at `src/app/transactions/page.tsx`, but it is not included in primary navigation.

The Activity page is an inventory audit trail, not a general production activity feed.

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

## Known development conventions

- use exact file paths
- return complete replacement files
- avoid partial edits in large files
- run `npm run build` after each pass
- inspect actual file contents when an import resolves to `undefined`
- do not assume alias imports are configured
- UI components should call shared production data helpers instead of importing Supabase directly where practical
