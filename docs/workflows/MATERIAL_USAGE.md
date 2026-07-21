# Material Usage

## Purpose

Capture materials consumed for a specific job and report date.

Material Usage is operationally critical and should remain a separate familiar form.

## Existing mental model

The original Excel form uses a job/report header followed by multiple material lines.

The Monday board used header-style records and child-like material rows to approximate this relationship.

TenOps should preserve the familiar report flow while storing a true parent/child model.

The report belongs either to a canonical Production Job or to an explicitly
confirmed temporary work label. These identities are mutually exclusive.

## User-facing workflow

Header fields should prepopulate from the selected job where available:

- project
- job number
- work-order number
- customer
- terrazzo system
- report date

Detail grid may include:

- material
- material type
- manufacturer/vendor
- size/component
- plate or blend reference
- quantity
- unit
- notes

## Quality-of-life behavior

- searchable material picker
- prepopulate manufacturer, type, size, and default unit
- rapid addition of several material lines
- editable date
- automatic job identifiers
- validation for quantity and unit
- contextual maintenance of appropriate option lists
- save and reopen reports

Saving creates or updates the report header and its ordered material lines
atomically. Deleting a report also removes its lines.

## Color plate ownership

Production owns the canonical Job Color Plate. In Material Usage, Color Plate #
applies only to Chip Blend lines; it is not report metadata and does not apply
to Resin, Hardener, Filler, or miscellaneous material lines. The database
retains the line-level plate field for historical compatibility.

Reports without a Chip Blend line require no plate synchronization. Canonical
Production-to-Material-Usage comparison occurs only at Job selection,
reassignment, or an explicit user-requested check.

## Canonical Job defaults

Selecting a canonical Production Job establishes `job_id` and copies the
current Job Number and Work Order Number into historical report snapshots. Job
Number and Work Order Number remain distinct; a missing Work Order Number is
left blank and never falls back to Job Number.

For new reports, Production Color Plate # defaults every Chip Blend line when
the report plate is blank. A matching report value is preserved, and a
different nonblank value requires an explicit choice between Material Usage and
Production. All Chip Blend lines share one report Color Plate #; editing one
updates all. Non-Chip Blend lines never store a plate.

Opening an existing report does not compare or refresh Production values.
Changing its Job association is a new association and regenerates Job Number
and Work Order snapshots; a Color Plate conflict must be resolved before any
part of the reassignment is applied. Canceling retains the previous Job and all
snapshots. `Check Production Defaults` performs an explicit Color Plate-only
comparison and never rewrites Job Number or Work Order history.

Material Usage never updates Production. It owns its historical identifier
snapshots, Color Plate # actually reported, quantities, materials, units,
notes, authorship, and timestamps after the meaningful copy boundary.

## Inventory relationship

Initial implementation may focus on faithful reporting.

Future integration should allow material usage to:

- reduce inventory
- consume reserved inventory
- compare estimated vs. actual consumption
- identify shortages and overages
- preserve the original reported quantity and unit

## Units

Material reporting must use stable units and known conversions where practical.

The UI should default to the normal unit for a material without exposing conversion logic to users.

## Long-term reporting

- material used by job
- material used by process
- estimated vs. actual consumption
- waste and overage analysis
- material usage per unit produced
- vendor/material trends
