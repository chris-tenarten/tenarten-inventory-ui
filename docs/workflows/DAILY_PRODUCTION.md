# Daily Production

## Purpose

Capture production output completed for a job on a given date.

This report describes what the shop produced, not where labor went or what materials were consumed.

## Existing mental model

The original Excel form is a dense throughput report containing production measures and quantities.

It should remain a separate workflow because it may be completed at a different cadence from manpower and material usage.

## User-facing workflow

Header information should prepopulate from the job where possible.

The report should capture one or more production measures, such as:

- chips blended
- forms prepared
- forms poured
- units removed from forms
- rough-grind output
- grout work
- polishing output
- cut-to-size output
- sealed units
- completed or shipped units

The final metric list should be confirmed with the actual form and Marcos's usage.

## Configurable production metrics

Production metrics should be database-managed reference data with:

- stable ID
- display name
- sort order
- default unit
- active status

The form structure remains fixed. The list of metrics can evolve.

## Data captured

- job
- report date
- production metric
- quantity
- unit
- notes
- entered by
- timestamps

## Long-term reporting

- daily throughput
- throughput by process
- labor hours per unit
- material usage per unit
- planned vs. actual duration
- process bottlenecks
