# Material Usage

## Purpose

Capture materials consumed for a specific job and report date.

Material Usage is operationally critical and should remain a separate familiar form.

## Existing mental model

The original Excel form uses a job/report header followed by multiple material lines.

The Monday board used header-style records and child-like material rows to approximate this relationship.

TenOps should preserve the familiar report flow while storing a true parent/child model.

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
