# Inventory Schema

## Role in TenOps

Inventory supports production.

The primary operational relationships are:

```text
Inventory Reservation → Job
Material Usage → Job
Inventory Activity → Inventory transaction history
```

## Existing inventory concepts

Known entities include:

- inventory items
- inventory transactions
- vendor catalog
- vendor aliases
- custom materials or mixes
- reservations / earmarks
- locations
- notes

## Production-job reservations

Pending Receivals and Inventory balances support three reservation states:

- linked to the canonical `jobs` row through `production_job_id`
- reserved under an unlinked `temporary_job_label`
- unrestricted

The two reservation identity fields are mutually exclusive. `earmark_notes` remains the reservation-notes field. Existing `is_earmarked`, `earmarked_job_name`, `earmarked_for_job`, and `earmarked_job` values remain available for transitional display compatibility; they are not the canonical identity.

Receiving a Pending Receival copies its canonical ID or temporary label and its reservation notes into Inventory and transaction history. Inventory aggregation includes reservation identity, preventing stock owned by different jobs from being silently combined.

Canonical badges display the current Production job number/name and can focus that job in the Production Pipeline. Temporary reservations are explicitly displayed as unlinked.

## Important distinction

The Activity page remains the inventory audit trail.

Production activity should eventually live in the Job Workspace rather than replacing or diluting inventory history.

## Future material-usage integration

A material usage report may eventually:

- reference an inventory item
- consume reserved quantity
- create an inventory outtake
- preserve the reported material name and unit
- flag unmatched or custom materials
- compare expected and actual usage

This integration should not block faithful material reporting during the first operational-reporting implementation.
