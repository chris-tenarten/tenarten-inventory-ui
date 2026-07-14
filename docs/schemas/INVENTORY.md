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
