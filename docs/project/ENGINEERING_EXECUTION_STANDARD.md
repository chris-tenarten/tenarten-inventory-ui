# TenOps Engineering Execution Standard

This document defines reusable execution standards for implementation work across TenOps. The Project Manifest remains the product and architecture authority; this document governs how scoped changes are inspected, implemented, validated, and reported.

## Autonomous execution

Inspect the repository, current documentation, migrations, and canonical implementation boundaries before changing code. Reuse existing components, helpers, persistence paths, routing, terminology, and visual semantics instead of creating competing implementations.

Complete the coherent scoped feature before broad validation. Resolve routine implementation decisions from repository evidence and existing conventions without unnecessary interruption. When ambiguity remains, choose the safest reversible approach consistent with the requested scope and report the assumption.

Repository approval policy and implementation judgment are separate concerns. A tool or environment may require approval to execute an authorized command; that does not turn ordinary implementation details into product decisions that require user interruption.

## Operational independence

A completed operational feature should not require a software developer for routine business maintenance. Vendors, Vendor Contacts, Vendor Catalog items and prices, Workers, Tasks, and similar reusable configuration should be safely maintainable by the people performing the work.

Developers build systems; they do not become part of the operational workflow. User-managed configuration must still preserve validation, permissions, historical records, canonical identity, and auditability.

## Browser testing philosophy

Browser testing protects meaningful operational workflows, state transitions, persistence, navigation, canonical relationships, destructive operations, cross-module interactions, and previously discovered defects. It does not exist to maximize coverage percentages.

Add a durable regression test when a real defect affects a meaningful workflow. Prefer extending shared fixtures and an existing end-to-end scenario over adding overlapping tests. Avoid low-value tests for typography, spacing, color, static labels, or isolated rendering already protected at a lower level. One complete workflow test is more valuable than several shallow control tests.

Tests must use deterministic data and waits. Do not weaken assertions, add arbitrary sleeps, blindly update snapshots, conceal failures, or label deterministic failures as flaky.

## Validation discipline

Use this default sequence:

```text
Implement
  ↓
Focused validation
  ↓
Focused browser tests
  ↓
Repair
  ↓
Re-run affected validation
  ↓
One broader validation pass near completion
```

Do not repeatedly run the full browser suite or production build after every small edit. Run the broader suite once near completion when practical, then clearly separate new failures from unrelated pre-existing failures.

## Migration discipline

Schema changes use new forward migrations. Previously applied migrations are immutable. Preserve existing data, ownership, grants, RLS, constraints, canonical relationships, and controlled `search_path` behavior.

Local implementation work may create migration files but must never modify a production database. Repository presence does not prove that a migration was applied; completion reports must distinguish created, applied, and verified states. Make migrations safely rerunnable where practical without hiding predecessor incompatibility.

## Completion reporting

Use a consistent completion report containing:

1. Summary
2. Files changed, identifying new and modified files
3. Migrations, including behavior and application status
4. Validation commands and actual outcomes
5. Browser tests and workflows actually exercised
6. Assumptions
7. Deferred work or known limitations

Never claim browser testing from code inspection or migration deployment from a checked-in SQL file. End with any manual actions required from the user.
