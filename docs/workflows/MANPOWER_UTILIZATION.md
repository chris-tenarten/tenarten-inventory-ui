# Manpower Utilization

## Purpose

Capture where shop labor was spent by:

- job
- date
- worker
- process
- time period
- notes

## Existing mental model

The original Excel form uses a dense matrix organized around workers and process rows.

The Monday implementation flattened that model into board records.

Marcos may record notes in a notebook and enter several accumulated days in one session.

## User-facing workflow

Manpower Utilization should remain a separate form.

It should preserve the Excel-style density and ordering while adding:

- job prepopulation
- date selection
- searchable worker options
- searchable process options
- automatic totals
- batch entry for multiple dates
- correction of prior reports
- contextual Add / Remove Workers
- contextual Add / Remove Processes

The current MVP presents individual labor rows inside persistent, user-named reporting groups. Reporting groups are organizational entry batches and are independent of both Production jobs and temporary job labels. Groups with a leading calendar date appear newest-first; undated groups follow dated groups and use creation time as their fallback order. Groups are collapsed by default. New labor rows are added directly within an expanded group, while existing rows remain editable in place.

An unlisted work label remains separate from the Production queue and does not create a job. Its nullable job relationship allows a later reconciliation workflow.

## Batch entry

The UI should support multiple report dates in one working session.

Potential interaction:

```text
+ Add Report Date

July 10
[matrix]

July 11
[matrix]

July 12
[matrix]
```

New date sections may optionally duplicate worker/process structure from the previous report while leaving hours blank.

## Data captured

At minimum:

- report job
- work date
- worker
- process
- AM hours
- PM hours
- total hours
- notes
- entered by
- timestamps

## Reference data

Workers and processes are stable database records. Their display names and sort order can be maintained without changing their IDs, and records are deactivated/reactivated rather than deleted so historical entries remain readable.

Production-job selection and temporary-label entry use the same compact work-identity control. The two identities remain mutually exclusive, and a temporary label can later be replaced by a linked Production job.
Changing a saved temporary identity is cancelable: leaving the chooser or pressing Escape restores the saved temporary label until a replacement is explicitly selected.

Users see names only.

Internal mapping:

```text
Selected job → job_id
Selected worker → worker_id
Selected process → process_step_id
```

## Process ordering

The MVP uses module-scoped `manpower_workers` and `manpower_tasks` reference tables. These can be generalized into shared operational reference tables when Material Usage and Daily Production are implemented and their shared vocabulary is confirmed.

Visible numeric process prefixes are not required solely for sorting.

Use:

- stable process ID
- display name
- sort order
- active status

## Long-term reporting

- actual labor by job
- actual vs. estimated labor
- labor by process
- worker utilization
- labor hours per unit produced
- labor variance over time
