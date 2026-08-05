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

When `NEXT_PUBLIC_ENABLE_PLANNING=true`, Planning appears as the second job Inspector tab. It does not add a top-level application or navigation route. With the flag absent or not exactly `true`, Production renders and loads exactly as before.

`NEXT_PUBLIC_EARLY_ACCESS=true` enables the visual Early Access deployment badge. It is an exact-string, presentation-only flag: it does not enable Planning or alter application behavior. Planning remains independently controlled by `NEXT_PUBLIC_ENABLE_PLANNING=true`.

TenOps appearance is an application-wide Light or Dark preference managed from Settings. Light is the first-visit default, and the selected appearance is stored only in the current browser. Appearance is not controlled by deployment variables and does not affect printed or generated documents.

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

Table/Timeline switching and filtering preserve pending Production and Planning changes, while page navigation and browser unload are protected by confirmation. Save All commits mixed Production and Planning date edits in one database transaction after every affected baseline is validated; a failed or stale save retains the proposals for retry or discard. Discard All returns every staged interval to its persisted baseline without a database write.

Selecting Save All opens a schedule approval dialog summarizing the Production and Planning changes. Changed by is required as a recorded name, an optional reason may be entered, and the client-visible internal-MVP password comes from `NEXT_PUBLIC_PRODUCTION_APPROVAL_PASSWORD`; its value is not stored in source or documentation. Correct password entry starts a fixed two-minute same-tab approval window. During that window the dialog still appears for every save, remembers the Changed by name, leaves notes blank, and requires explicit confirmation; it does not store the password. Operators may lock the window immediately.

This approval gate is not secure authentication: any browser user can inspect or manipulate client-visible configuration and session state. Replace it with authenticated identity and server-side authorization. Confirmed saves use one transactional RPC: it validates every affected Production and Planning concurrency baseline, updates both record sets atomically, and records attributed `job_activity` entries. Any conflict or database failure rolls back the full batch and leaves browser-staged geometry intact.

All edits to an existing job's planned start or planned finish feed one staged proposal and one guarded schedule-commit path. The general job-update helper rejects planned-date fields. The guarded commit rechecks approval configuration and the fixed session expiration immediately before writing. Missing or blank configuration fails closed even if session storage contains a future timestamp; malformed, expired, or implausibly distant timestamps are cleared. An active approval window never skips the approval dialog or its explicit confirmation.

Cloudflare must define `NEXT_PUBLIC_PRODUCTION_APPROVAL_PASSWORD` and redeploy the application because this public build-time variable is embedded during the build. A local `.env.local` value does not configure the deployed site.

Labor intensity is derived rather than stored. Timeline ranges and their labor denominator both use inclusive calendar days: estimated labor hours divided by every scheduled calendar day. This interim model keeps scheduling honest about possible weekend work without implying that every included weekend is necessarily planned production time. A future shop calendar or job-specific planned-production-day model should replace it. Holiday calendars, workforce capacity, resource leveling, dependency scheduling, and automatic schedule optimization are deferred. Missing, zero, or invalid labor estimates are shown as `No labor estimate` rather than as zero labor.

The compact Timeline legend uses the same shared visual definitions as the bars. Most statuses use solid fills; `On Hold` uses a stronger diagonal stripe treatment while `Shipped` uses a softer, differently angled stripe to distinguish it from `Complete`. The legend also identifies requested-delivery diamonds, the today marker, and the compact `h/day` labor label.

Enabled Phases annotate rather than own the Timeline. Canonical Production dates continue to define the initial range and ordinary Fit behavior. Their staged `planned_start` and `planned_end` form the job's preliminary timeline for Planning feedback. Moving a Production start translates every dated Overlay, Planning Only, and Pause Phase by the same whole-day delta in the shared staged batch; finish-only resizing does not scale or translate Phase durations. Overlay Phases use curated colors, while Pause/calendar constraints use the black-and-white hatch. Planning Only and out-of-range Phases do not stretch the canvas. Collapsed annotations are read-only; expanded Overlay and Pause lanes mirror Production's staged drag and edge-resize treatment with live dependency geometry. Whole-Phase movement and finish-edge resizing translate dependency descendants automatically; start-edge resizing remains isolated. Circular reachable graphs are never cascaded. Orange dependency and preliminary-timeline warnings remain savable; red graph or interval errors block Save All. Ordinary waiting for a predecessor uses a neutral incoming-dependency icon rather than warning styling. Connector and Phase issue icons open anchored explanations above connector geometry and synchronize affected Phases with the Planning Inspector and feedback panel. Items remain in the Inspector and drive the explicitly labeled Planning progress strip for coordination Phases. The sticky rail's Layers shortcut opens Planning for the job. See [`PLANNING.md`](./PLANNING.md).

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
