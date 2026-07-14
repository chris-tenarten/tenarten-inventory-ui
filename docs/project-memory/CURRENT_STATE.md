# Current State

This file describes the known implementation state at the end of the July 2026 production-pipeline work.

It should be updated whenever a feature is materially completed, removed, or restructured.

## Application identity

Primary title:

`Tenarten Operations Control`

Primary navigation:

- Dashboard
- Inventory
- Activity
- Catalog

The previous Transactions page no longer exists.

The Activity page is an inventory audit trail, not a general production activity feed.

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

The migration may not yet be represented correctly in the local repository. The migration should be checked into source control if absent.

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
