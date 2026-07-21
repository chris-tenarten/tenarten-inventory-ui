# TenOps Blueprint

## Mission

TenOps preserves the workflows people already trust while replacing the limitations of the software they currently use.

## Product identity

TenOps is an operations platform for a terrazzo manufacturing business.

It is not primarily:

- an inventory application
- a generic project-management tool
- a low-code builder
- a replica of Monday.com
- a generic ERP

Production is the center of gravity. Jobs are the primary operational entity. Inventory, attachments, labor, material usage, production reporting, forms, purchasing, QC, shipping, and activity ultimately support or describe work performed for jobs.

## Core principles

### 1. Production is the center of gravity

The default operational view should answer:

> What jobs need attention, what is scheduled, and what is happening in the shop?

The Production Pipeline is the main dashboard rather than a secondary module.

### 2. Jobs are the central operational entity

Every relevant operational record should relate to a job where practical:

- production schedule
- labor
- material usage
- production output
- attachments
- forms
- inventory reservations
- notes
- activity
- quality control
- shipping
- purchasing

A job may enter the pipeline before all identifiers and dates exist.

### 3. Preserve workflows, not software limitations

The original Excel forms reveal the real business workflow.

The Monday boards are adaptations of those workflows to a flat board model. TenOps should preserve what users already understand while removing the structural compromises imposed by Excel and Monday.

### 4. Excel familiarity, Monday convenience, relational power

TenOps should combine:

- dense and familiar table entry
- searchable dropdowns
- prepopulated fields
- automatic defaults
- attachments
- audit history
- validation
- relational data
- cross-job and cross-process reporting

### 5. Users see business language, not database identifiers

Users choose:

- Rice McNair
- Ramon
- Rough Grind on Wizard
- Pure White #2

TenOps stores:

- `job_id`
- `worker_id`
- `process_step_id`
- `material_id`

Stable IDs and foreign-key relationships are assigned behind the scenes.

### 6. Reference data is configurable

Business lists that naturally change should not require a code patch or redeploy.

Examples:

- workers
- process steps
- production metrics
- material types
- units
- document types
- selected statuses

Configuration should be simple and contextual when practical, such as an `Add / Remove Workers...` entry inside a worker dropdown.

### 7. Fundamental transaction shapes remain opinionated

TenOps should not become a generic form builder.

Examples of stable system concepts:

- jobs have names
- labor records hours
- material usage records quantities
- production reports record output
- attachments reference files
- reports belong to jobs

The form structure remains controlled. The selectable content can evolve.

### 8. Dense, industrial, information-first UI

The application should feel appropriate for a fabrication office and shop environment:

- minimal wasted space
- restrained use of cards
- no decorative SaaS excess
- table-first workflows
- inline editing
- familiar terminology
- obvious actions
- professional icons
- low cognitive load

### 9. Configuration should not overwhelm users

Flexibility should be available without turning normal work into software administration.

Prefer:

- contextual add/remove dialogs
- sensible defaults
- inactive rather than deleted reference values
- hidden identifiers
- limited, relevant options

Avoid:

- giant settings areas
- arbitrary custom-field systems
- exposing technical concepts
- forcing users to configure the product before using it

### 10. Architecture is stable; feature order is fluid

The product should remain coherent while implementation order follows real operational opportunities.

Feature order may change to capitalize on:

- current office interest
- user enthusiasm
- a useful demo
- a newly discovered pain point
- an immediate adoption opportunity

This is intentional opportunistic product development, not accidental scope drift.

## Product test

Before adding a workflow, ask:

> If the intended user sat down in front of this without training, would the next action feel obvious?

If not, reconsider whether the design preserves the existing mental model.

## Development principles

- Use small, compile-safe implementation passes.
- Prefer full replacement files or complete new files over partial block edits.
- Build after each milestone.
- Avoid extraction-based update bundles.
- Treat the current repository as implementation truth.
- Update Project Memory only when the change affects identity, workflow, structure, or current reality.

## Shared Job boundary

Production owns lightweight Job identity, selector loading, label resolution,
and navigation into the canonical Production context. Job-aware modules should
adopt these primitives incrementally instead of defining parallel Job option
models and `jobs` queries.

Job selection, linked-reference presentation, and Production navigation remain
separate responsibilities. They may share types and low-level helpers, but
should not be combined into one configurable component or generalized beyond
Jobs before a real non-Job work requirement exists.
