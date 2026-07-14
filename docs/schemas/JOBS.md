# Jobs Schema

## Purpose

Represent operational work that has entered the production pipeline.

## Conceptual fields

| Field | Type | Required | User-facing | Notes |
|---|---|---:|---:|---|
| id | UUID | Yes | No | Stable internal identifier |
| name | Text | Yes | Yes | Project name; only required creation field |
| customer | Text or reference | No | Yes | May become a customer reference later |
| job_number | Text | No | Yes | Assigned after pipeline entry when available |
| estimate_number | Text | No | Yes | Estimate identifier |
| work_order_number | Text | No | Yes | Work-order identifier |
| deposit_date | Date | No | Yes | Deposit received |
| color_plate_number | Text | No | Yes | Color plate reference |
| sample_submitted_date | Date | No | Yes | Sample submission |
| approval_date | Date | No | Yes | Approval received |
| estimated_man_hours | Numeric | No | Yes | Planned labor |
| estimated_calendar_days | Integer | No | Yes | Planned duration |
| requested_delivery_date | Date | No | Yes | Delivery milestone |
| planned_start | Date | No | Yes | Scheduling |
| planned_end | Date | No | Yes | Scheduling |
| production_status | Reference/text | Yes | Yes | Current status |
| material_status | Reference/text | Yes | Yes | Material readiness |
| priority | Reference/text | Yes | Usually | Internal priority |
| progress_percent | Numeric | Yes | Usually no | Defaults to 0 |
| owner_name | Text/reference | No | Yes | Future ownership model may normalize |
| remarks | Text | No | Yes | Job notes |
| archived_at | Timestamp | No | No | Soft archive |
| created_at | Timestamp | Yes | No | Audit |
| updated_at | Timestamp | Yes | No | Audit |

## Relationships

A job may have:

- many attachments
- many activity entries
- many labor reports
- many material-usage reports
- many daily-production reports
- many inventory reservations
- many future notes, QC, shipping, and purchasing records

## Visibility

Sensitive financial fields such as contract value should not be shown to shop users until real role-based access exists.
