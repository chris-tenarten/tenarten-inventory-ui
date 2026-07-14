# Operational Reporting Schema

## Overview

TenOps supports three separate user-facing operational reports:

1. Manpower Utilization
2. Material Usage
3. Daily Production

They remain distinct because users understand them as separate forms and may complete them at different cadences.

They share stable relational dimensions to support long-term analytics.

## Reference entities

### workers

| Field | Notes |
|---|---|
| id | Stable internal ID |
| display_name | User-facing name |
| sort_order | Display order |
| is_active | Available for new entries |
| created_at | Audit |
| updated_at | Audit |

### process_steps

| Field | Notes |
|---|---|
| id | Stable internal ID |
| display_name | User-facing process |
| category | Optional high-level grouping |
| sort_order | Replaces visible numeric prefixes used only for sorting |
| is_active | Available for new entries |
| created_at | Audit |
| updated_at | Audit |

### production_metrics

| Field | Notes |
|---|---|
| id | Stable internal ID |
| display_name | Output metric |
| process_step_id | Optional process relationship |
| default_unit_id | Optional default unit |
| sort_order | Display order |
| is_active | Available for new reports |

### units

| Field | Notes |
|---|---|
| id | Stable ID |
| display_name | Bags, pounds, gallons, units, hours, etc. |
| abbreviation | Short display |
| dimension | Optional conversion grouping |
| conversion_to_base | Optional canonical conversion |
| is_active | Available for new records |

## Manpower

The implemented MVP uses a direct labor-entry structure inside lightweight persistent reporting groups rather than requiring formal submission headers.

`manpower_reporting_groups` persist Marcos' organizational entry groups independently of work identity. `manpower_entries.reporting_group_id` assigns a row to one of these groups, while `job_id` or `unlisted_work_label` continues to describe the work itself.

### manpower_workers

- id
- display_name
- sort_order
- is_active
- created_at
- updated_at

### manpower_tasks

- id
- display_name
- sort_order
- is_active
- created_at
- updated_at

### manpower_entries

- id
- work_date
- reporting_group_id
- worker_id
- task_id
- job_id, mutually exclusive with unlisted work label
- unlisted_work_label, mutually exclusive with job
- am_hours
- pm_hours
- notes
- entered_by
- created_at
- updated_at

Total hours are derived from AM plus PM hours and are not stored.

The earlier parent/header model below remains a possible future reporting boundary if submission or approval workflows require it.

### manpower_reports

Conceptual fields:

- id
- job_id
- work_date
- notes
- status
- entered_by
- created_at
- updated_at

### manpower_entries

Conceptual fields:

- id
- report_id
- worker_id
- process_step_id
- am_hours
- pm_hours
- total_hours
- notes
- created_at
- updated_at

`total_hours` may be calculated rather than independently entered.

## Material usage

### material_usage_reports

Conceptual fields:

- id
- job_id
- work_date
- terrazzo_system
- notes
- status
- entered_by
- created_at
- updated_at

### material_usage_entries

Conceptual fields:

- id
- report_id
- material_id, nullable for unmatched/custom entries
- material_name_snapshot
- material_type
- manufacturer_snapshot
- plate_number
- quantity
- unit_id
- unit_name_snapshot
- process_step_id, optional
- notes
- created_at
- updated_at

## Daily production

### daily_production_reports

Conceptual fields:

- id
- job_id
- work_date
- notes
- status
- entered_by
- created_at
- updated_at

### daily_production_entries

Conceptual fields:

- id
- report_id
- production_metric_id
- quantity
- unit_id
- notes
- created_at
- updated_at

## Hidden relationships

Users should never enter:

- job IDs
- worker IDs
- process IDs
- material IDs
- production metric IDs
- unit IDs

The UI resolves these automatically from recognizable selections.

## Audit and correction

Reports should be reopenable and correctable.

Later access control may distinguish:

- draft
- submitted
- reviewed
- locked

The first implementation should avoid unnecessary approval complexity.
