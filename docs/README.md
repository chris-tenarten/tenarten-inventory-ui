# TenOps Project Memory

This directory preserves the product, workflow, and data-model context required to evolve TenOps coherently.

The source code and database migrations remain the implementation source of truth. These documents explain the intent behind the implementation, the business workflows it supports, and the principles that should remain stable even when feature order changes.

## Start here

Read in this order:

1. `project-memory/BLUEPRINT.md`
2. `project-memory/CURRENT_STATE.md`
3. The workflow document relevant to the task
4. The schema document relevant to the task
5. `architecture/DATA_MODEL.md`
6. `architecture/DESIGN_PATTERNS.md`
7. `project-memory/LEARNINGS.md`

## What belongs here

Project Memory records four kinds of knowledge:

- **Identity** — what TenOps is and how it should behave
- **Reality** — what currently exists
- **Business workflow** — how work is actually performed
- **Structure** — how entities, reports, and references relate

It intentionally does not contain a rigid roadmap. Feature order is allowed to change based on operational need, office momentum, and user feedback.

## Source-of-truth hierarchy

1. Supabase migrations and the live database define actual database structure.
2. Source code defines current application behavior.
3. Project Memory defines architectural intent and workflow expectations.
4. If these disagree, identify the discrepancy before extending the system.
