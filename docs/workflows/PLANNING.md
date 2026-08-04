# Production Planning

## Purpose

Planning captures the coordination surrounding Production: blockers, dependencies, customer approvals, freight, permits, mockups, samples, and other details operators must remember. Production remains operational reality. Planning supports execution; it does not replace Production, canonical scheduling, or Manpower Tasks.

## Access and terminology

Planning is the second tab in the Production Job Inspector: Details, Planning, Job Updates, Files, Recent Changes. It has no top-level route or navigation item. The Timeline sticky rail exposes a Layers shortcut that opens the selected job's Planning tab.

Use the hierarchy **Planning → Phase → Items**. A Phase is intentionally unconstrained and may represent Shipping, Customer Samples, an A-frame, Permits, Freight, a Color Plate, or another coordination concern. Items are lightweight work or checkpoints beneath a Phase. Do not call them Tasks because Manpower already owns that term.

## Canonical boundaries

- Production job identity and planned dates remain canonical.
- A Phase may be `Overlay`, `Pause`, or `Planning Only`.
- Only Phases appear on the Timeline. Items never become Timeline lanes.
- Expanded Overlay and Pause lanes support direct whole-day drag and edge resizing. These edits stage locally and never save on pointer release.
- Planning dates never write or stage Production planned dates.
- A Production job may have at most four coordination Phases: Overlay and Planning Only count; Pause does not.
- Pause is an operational Timeline interruption rather than a coordination bucket. New Pause Items are not created.
- Planning progress is derived from completed Items in Overlay and Planning Only Phases. Pause is excluded. It must never be presented as fabrication progress.

## Timeline visual language

All dated Overlay Phases and Pause intervals in the current Production canvas are shown; the product cap removes Timeline overflow prioritization. Overlay identity is inherited as a frozen curated color when copied from the Phase Library. Ad-hoc Overlay Phases use the deterministic fallback palette. Pause uses a black-and-white diagonal hatch and does not consume a Planning Phase slot or color. Planning Only has no Timeline bar. Collapsed annotations remain read-only. Expanded lanes use the same drag handles, ghost geometry, cursor treatment, threshold, staged outline, and tooltip behavior as Production. Staged geometry drives both connectors and collapsed annotations.

## Rescheduling semantics

Production planned dates remain canonical. During this MVP, every dated Overlay, Planning Only, and Pause Phase translates by the same whole-calendar-day start delta when Production moves. Translation is staged with the Production change; it never writes on pointer release. Phase duration, status, dependencies, Items, completion, and relative spacing are preserved. A Production finish-only resize creates no Phase translation, and changing Production duration never proportionally scales Planning duration.

Pause remains a calendar/Production constraint with black-and-white hatch styling and can be directly dragged or resized in its expanded lane. For the current simplified MVP it also translates with a moved Production interval. A future refinement may reintroduce configurable fixed-versus-shifting behavior, but no persisted preference is part of this migration.

Planning Timeline changes and Production date changes share the existing review, Save All, Discard All, navigation protection, and approval surface. Migration `20260803_003_atomic_production_planning_schedule.sql` adds only the private mixed transactional save ledger and RPC; it validates both job and Phase baselines before writing either set. Failed or stale saves preserve all staged geometry.

Dependency feedback is derived from staged geometry. Whole-Phase movement translates only the selected Phase and every reachable dependency descendant; predecessor Phases and unrelated branches remain fixed. Finish-edge resizing translates those same descendants by the finish-date delta, while start-edge resizing changes only the selected Phase. Cascade traversal is disabled for a circular reachable graph, leaving the graph error visible and Save All blocked. Healthy connectors retain their neutral treatment. An unmet predecessor is ordinary dependency waiting: the Timeline and Inspector use a neutral incoming-arrow-to-node icon and `Waiting for` copy rather than warning language. Unusual dependency overlaps and calendar placement are orange warnings and do not block Save All. Circular, missing, or invalid dependency relationships and invalid intervals are red errors and block Save All until resolved. Clicking an issue connector highlights and brings both related Phases into view, focuses the persistent feedback entry, and opens an anchored explanation. Phase warning icons open the same compact treatment and list every active issue for that Phase. The Inspector repeats each issue beneath the affected Phase.

The job's staged Production `planned_start` and `planned_end` define its **preliminary timeline** for feedback; persisted dates are used when no Production proposal exists. A dated Phase beginning before or finishing after that interval receives an orange warning. A Pause/calendar constraint wholly outside it receives an orange non-intersection warning. These conditions never clamp Phase dates, interrupt dependency cascading, expand Production automatically, or block Save All. They recompute immediately from live Phase geometry and staged Production geometry and disappear when the proposed interval contains the Phase again.

## Phase Library

The Phase Library lives in Settings and is linked from the Inspector Planning tab. It stores reusable Phase definitions, curated default Timeline colors, and reusable Item definitions. Adding a library Phase to a job copies its behavior, frozen color, suggested owner, suggested duration, and Items. Pause definitions do not create reusable Items. Later library edits or deletion never modify the copied job Phase or its Items. Nothing is added to Production jobs automatically.

## Rollout and data

Planning is gated by the build-time public variable `NEXT_PUBLIC_ENABLE_PLANNING=true`. Disabled means no Inspector tab, no Timeline annotation or Layers shortcut, and no Planning queries. Do not enable it remotely before the migration is reviewed, applied, and verified.

The original Whiteboard migrations `_001` and `_002` were applied remotely through exact-file execution and are intentionally retained as migration history. The applied and verified forward migration `_003` renamed the empty `whiteboard_cards` table to `planning_phases` and created `planning_items`, `planning_phase_library`, and `planning_phase_library_items`.

Migration `20260803_001_planning_library_colors_and_phase_cap.sql` is applied and assertion-verified. It adds frozen Phase colors, Phase Library color defaults, library-origin provenance, and the concurrency-safe four-non-Pause Phase guard. Migration `20260803_003_atomic_production_planning_schedule.sql` is an unapplied review candidate; direct Planning scheduling must not be released until that migration and its rollback verifier are approved, applied, and passed.

Controlled demo data is restricted to job `cba79566-3fde-4910-9cf6-45687db70b01`. It creates Color Plate, Shop Drawings, and Customer Approval coordination Phases plus a Production Freeze Pause interval. Internal coordination is represented as an Item. `cleanup` removes only marker-owned Phases and restores the controlled Production dates. Demo content is never seeded automatically.

## MVP exclusions

The MVP does not add comments, mentions, notifications, attachments, Item dragging, automatic dependency creation or rewriting, Planning analytics, or a separate project-management application.
