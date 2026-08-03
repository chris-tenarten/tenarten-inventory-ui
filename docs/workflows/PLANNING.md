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
- Timeline Planning is read-only visualization in the MVP. Create and edit Phases and Items in the Inspector.
- Planning dates never write or stage Production planned dates.
- A Production job may have at most four coordination Phases: Overlay and Planning Only count; Pause does not.
- Pause is an operational Timeline interruption rather than a coordination bucket. New Pause Items are not created.
- Planning progress is derived from completed Items in Overlay and Planning Only Phases. Pause is excluded. It must never be presented as fabrication progress.

## Timeline visual language

All dated Overlay Phases and Pause intervals in the current Production canvas are shown; the product cap removes Timeline overflow prioritization. Overlay identity is inherited as a frozen curated color when copied from the Phase Library. Ad-hoc Overlay Phases use the deterministic fallback palette. Pause uses a black-and-white diagonal hatch and does not consume a Planning Phase slot or color. Planning Only has no Timeline bar. Expanded lanes may show read-only right-angle dependency connectors; collapsed annotations do not show blocked badges.

## Phase Library

The Phase Library lives in Settings and is linked from the Inspector Planning tab. It stores reusable Phase definitions, curated default Timeline colors, and reusable Item definitions. Adding a library Phase to a job copies its behavior, frozen color, suggested owner, suggested duration, and Items. Pause definitions do not create reusable Items. Later library edits or deletion never modify the copied job Phase or its Items. Nothing is added to Production jobs automatically.

## Rollout and data

Planning is gated by the build-time public variable `NEXT_PUBLIC_ENABLE_PLANNING=true`. Disabled means no Inspector tab, no Timeline annotation or Layers shortcut, and no Planning queries. Do not enable it remotely before the migration is reviewed, applied, and verified.

The original Whiteboard migrations `_001` and `_002` were applied remotely through exact-file execution and are intentionally retained as migration history. The applied and verified forward migration `_003` renamed the empty `whiteboard_cards` table to `planning_phases` and created `planning_items`, `planning_phase_library`, and `planning_phase_library_items`.

Migration `20260803_001_planning_library_colors_and_phase_cap.sql` is the
pending forward refinement. It adds frozen Phase colors, Phase Library color
defaults, library-origin provenance, and the concurrency-safe four-non-Pause
Phase guard. It must be applied and assertion-verified before this source is
used against the deployed Planning schema.

Controlled demo data is restricted to job `cba79566-3fde-4910-9cf6-45687db70b01`. It creates Color Plate, Shop Drawings, and Customer Approval coordination Phases plus a Production Freeze Pause interval. Internal coordination is represented as an Item. `cleanup` removes only marker-owned Phases and restores the controlled Production dates. Demo content is never seeded automatically.

## MVP exclusions

The MVP does not add comments, mentions, notifications, attachments, Timeline drag/resizing for Phases, Planning analytics, or a separate project-management application.
