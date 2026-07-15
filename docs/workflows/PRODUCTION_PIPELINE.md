# Production Pipeline

## Purpose

Provide the primary operational view of jobs that matter to the shop.

The pipeline begins when work becomes an operational commitment. It does not include every bid or estimate.

## Entry boundary

A record may enter the pipeline after:

- award
- approval to proceed
- deposit
- operational handoff

It may still lack:

- job number
- work-order number
- color plate
- planned dates
- complete material details

## Creation rules

Project name is the only required field.

All other values may be added later.

## Views

### Table

Primary data-entry and management view.

Expected behavior:

- inline editing
- save on blur
- Add Job at bottom
- compact filters
- compact search
- dense columns
- visible save/error feedback

### Overview, Table, and Timeline

Production Pipeline now presents three synchronized views over the same canonical job records:

- Overview is the default operational view and summarizes identity, customer, shared status badges, delivery, schedule, readiness, labor, and attached-file counts without horizontal scrolling.
- Table preserves dense inline editing, compact centered headers, and sticky Job/Project columns for bulk review. Existing attachment counts appear beside the Project name and open the inspector at Attachments; a separate Files column is unnecessary.
- Timeline supports direct schedule planning and includes a separate Not Scheduled section whose Complete setup action opens the shared inspector at planned dates.

The selected view is remembered for the current browser-tab session. Selecting a job in any view opens the same keyboard-accessible job inspector. Planning fields remain editable there, while job details, attachments, and the newest `job_activity` entries provide context. Attachment indicators in Overview and Table open the inspector directly at Attachments; upload/removal updates the shared count map without a job reload. Schedule fields always feed the staged approval/audit workflow; the inspector does not bypass it.

Planning completeness is derived in one shared helper. Jobs without both planned dates are Not Scheduled. Scheduled jobs missing a job number, requested delivery, labor estimate, or customer are Planning Needed; otherwise they are Planning Complete. This guidance is independent of material readiness and Production status and does not indicate that a job can begin or has no blockers.

### Timeline

Alternate scheduling visualization of the same records.

Display states:

- scheduled range
- delivery milestone
- unscheduled

Scheduled ranges support direct schedule editing:

- drag the center of a range to move its planned start and finish together while preserving its calendar-day duration
- drag either edge to resize the range in whole calendar days, with a minimum one-day range
- use the focused control's left and right arrow keys for equivalent one-day adjustments
- review current and proposed dates, scheduled calendar days, estimated labor, and labor-hours per scheduled day during the interaction

Timeline edits stage the same `planned_start` and `planned_end` fields used by the Table view; pointer release and keyboard arrows do not write to Supabase. The proposed status bar remains editable, while a neutral dashed ghost identifies its last persisted position. A persistent control above the active view compares saved and proposed dates, days, and labor intensity and provides explicit Save and Discard actions. Table planned dates show the proposal with an unsaved indicator and feed changes into the same staged proposal.

Only one job can have a staged schedule at a time. Table/Timeline switching and filtering preserve the pending control, while page navigation and browser unload are protected by confirmation. Save updates canonical job state only after the database succeeds; a failed save retains the proposal and ghost for retry or discard. Discard always returns to the original persisted baseline without a database write. Multi-job planning and batch save are deferred.

Selecting Save opens a schedule approval dialog summarizing the job, saved/proposed ranges, scheduled-day difference, and labor intensity. Changed by is required as a recorded name, an optional reason may be entered, and the client-visible internal-MVP password comes from `NEXT_PUBLIC_PRODUCTION_APPROVAL_PASSWORD`; its value is not stored in source or documentation. Correct password entry starts a fixed two-minute same-tab approval window. During that window the dialog still appears for every save, remembers the Changed by name, leaves notes blank, and requires explicit confirmation; it does not store the password. Operators may lock the window immediately.

This approval gate is not secure authentication: any browser user can inspect or manipulate client-visible configuration and session state. Replace it with authenticated identity and server-side authorization. Confirmed saves first update `jobs`, then insert a `production_schedule_changed` entry in `job_activity` with source `production_timeline`, attribution, optional note, changed fields, and old/new values. The MVP sequence is non-atomic; an audit failure after a successful date update retains the details and exposes an audit-only retry so the job update is not submitted twice. A transactional RPC is deferred.

All edits to an existing job's planned start or planned finish feed one staged proposal and one guarded schedule-commit path. The general job-update helper rejects planned-date fields. The guarded commit rechecks approval configuration and the fixed session expiration immediately before writing. Missing or blank configuration fails closed even if session storage contains a future timestamp; malformed, expired, or implausibly distant timestamps are cleared. An active approval window never skips the approval dialog or its explicit confirmation.

Cloudflare must define `NEXT_PUBLIC_PRODUCTION_APPROVAL_PASSWORD` and redeploy the application because this public build-time variable is embedded during the build. A local `.env.local` value does not configure the deployed site.

Labor intensity is derived rather than stored. Timeline ranges and their labor denominator both use inclusive calendar days: estimated labor hours divided by every scheduled calendar day. This interim model keeps scheduling honest about possible weekend work without implying that every included weekend is necessarily planned production time. A future shop calendar or job-specific planned-production-day model should replace it. Holiday calendars, workforce capacity, resource leveling, dependency scheduling, and automatic schedule optimization are deferred. Missing, zero, or invalid labor estimates are shown as `No labor estimate` rather than as zero labor.

The compact Timeline legend uses the same shared visual definitions as the bars. Most statuses use solid fills; `On Hold` uses a stronger diagonal stripe treatment while `Shipped` uses a softer, differently angled stripe to distinguish it from `Complete`. The legend also identifies requested-delivery diamonds, the today marker, and the compact `h/day` labor label.

## Terminology

Use:

- Production Pipeline
- Overview
- Jobs in Queue
- Unscheduled
- Table
- Timeline
- Add Job

Avoid:

- Active Records
- Production Record
- Gantt, unless used internally in code

## Job-centered expansion

The table and Timeline should eventually open a unified Job Workspace containing:

- Overview
- Production
- Schedule
- Materials
- Labor
- Daily Production
- Attachments
- Forms
- Notes
- Activity
- QC
- Shipping
- Purchasing
