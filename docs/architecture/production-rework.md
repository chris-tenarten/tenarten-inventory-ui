# Production Rework lifecycle

TenOps models Rework as a lifecycle belonging to one canonical commercial Production Job. The Job number, customer, commercial values, documents, attachments, Purchase Orders, Transmittals, and Job Updates remain job-scoped. An active `production_rework_cycles` record supplies only the active Rework status and schedule shown in Production.

The original lifecycle remains on `jobs`; Rework never overwrites its status or planned dates. Lifecycle identity is represented in application state as `original:<job id>` or `rework:<rework id>`. Only one Rework can be active for a Job, while completed and cancelled cycles remain historical.

## MVP scope limitation

`scope_details` is human-readable operational context and must not be parsed for analytics. This MVP supports job-level Rework counts, reason categories, repeat Rework, turnaround, production load, and job-level first-pass yield. It does **not** support reliable piece-, Production Item-, or Color Plate-level Rework rates.

Backlog: establish a canonical Production scope model with first-class Production Color Plates and Production Items, stable IDs, Job relationships, and importer/document integration. Future relational Rework scope can reference those entities without replacing historical `scope_details`.

## Authorization follow-up

RBAC must audit `production_rework_cycles` and the `create_production_rework`, `update_production_rework_status`, `save_production_rework_schedule_batch`, and `save_production_rework_mixed_schedule_batch` RPCs before restrictive enforcement is enabled.
