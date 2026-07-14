# Conceptual Data Model

## Central entity

`jobs` is the primary operational entity.

A job may exist without complete scheduling or identifier information.

## High-level relationships

```text
Job
├── Attachments
├── Job Activity
├── Inventory Reservations
├── Forms
├── Manpower Reports
│   └── Labor Entries
├── Material Usage Reports
│   └── Material Usage Entries
├── Daily Production Reports
│   └── Production Entries
├── Notes
├── Quality Records
├── Shipping Records
└── Purchasing Records
```

## Shared analytical dimensions

Operational records should share consistent relational dimensions where applicable:

- `job_id`
- `work_date`
- `worker_id`
- `process_step_id`
- `material_id`
- `production_metric_id`
- `unit_id`
- `entered_by`
- `created_at`
- `updated_at`

These values are stored internally and are not shown to end users.

## Reference data

Reference tables should generally use stable IDs and support activation and ordering.

Common shape:

```text
id
display_name
sort_order
is_active
created_at
updated_at
```

Likely reference entities:

- workers
- process_steps
- production_metrics
- material_types
- units
- document_types
- selected statuses

## Historical integrity

Reference records should not be hard-deleted when already used.

Deactivating a worker, process, or option removes it from new-entry lists while preserving old reporting.

Where terminology may change materially, transaction rows may also preserve a display-name snapshot in addition to the foreign key.

## Report model

The three operational reports remain separate user-facing workflows.

### Manpower

The implemented MVP uses `manpower_workers` and `manpower_tasks` as reference tables around direct `manpower_entries`. Each entry belongs to an organizational `manpower_reporting_groups` record and relates to either a canonical Job or a temporary work label. The report-header structure below remains a possible future boundary if submission workflows require it.

```text
manpower_reports
└── manpower_entries
```

### Material Usage

```text
material_usage_reports
└── material_usage_entries
```

### Daily Production

```text
daily_production_reports
└── daily_production_entries
```

The separate report headers preserve familiar form boundaries and allow different entry cadences.

## Database-source-of-truth rule

Actual database structure should be represented by checked-in Supabase migrations.

Conceptual documents explain intent but do not replace migrations.
