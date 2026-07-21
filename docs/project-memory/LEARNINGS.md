# Learnings

## Production and dashboard

- Production is the main application experience, not a secondary page.
- The table is the natural primary workspace because office users already think in spreadsheets.
- `Timeline` is clearer than `Gantt` for the target users.
- Large KPI cards distracted from the work surface.
- Compact queue counts are enough until the metrics become operationally meaningful.
- A job can be operationally relevant before receiving job number, work-order number, or schedule dates.
- Project name should remain the only required creation field.

## User adoption

- The target users are not anti-technology; they are anti-friction.
- Users can be overwhelmed or discouraged by too many visible configuration options.
- Familiar layout, field order, terminology, and density matter.
- Showing a compelling feature at the right office moment can be more valuable than following a rigid feature sequence.
- Feature order should remain flexible while product principles remain stable.

## Marcos's operational reporting

- Marcos is the most consistent Monday user.
- He regularly uses manpower and material-usage logs.
- He may accumulate manpower notes in a notebook and enter multiple days in batches.
- The original Excel templates reveal the real workflow more accurately than the Monday board exports.
- Monday's clunky parent/header rows are workarounds for a flat board model.
- Manpower Utilization, Material Usage, and Daily Production should remain separate user-facing forms.
- They may share infrastructure and relational keys underneath.
- The Excel flow should be maintained while retaining Monday quality-of-life improvements.

## Configuration

- Worker and process lists should not be hard-coded.
- New hires and changing process names should not require a redeploy.
- Contextual `Add / Remove...` controls are likely more intuitive than a separate administration area.
- Reference values should be deactivated rather than deleted so historical records remain valid.
- Users should never need to understand IDs, UUIDs, foreign keys, or cross-table keys.
- TenOps should infer and assign relationships behind the scenes.

## Data and analytics

- Labor, material consumption, and production output are the three core perspectives on execution:
  - effort
  - inputs
  - outputs
- Shared job/date/process relationships will eventually support:
  - estimated vs. actual labor
  - estimated vs. actual material usage
  - labor hours per unit
  - material usage per unit
  - worker utilization
  - process bottlenecks
  - rework and variance analysis
- Consistent units and reference IDs are required for meaningful long-term reporting.

## Shared Job behavior

- Canonical Job identity and current presentation data come from Production; snapshots on operational reports preserve historical display context but do not replace `jobs.id`.
- Job selection and linked Job reference display are separate responsibilities: selectors benefit from number-plus-name context, while existing references prefer the recognizable Job name with a number fallback.
- Shared domain primitives should be adopted one proven consumer at a time rather than triggering a repository-wide refactor.
- Canonical operational values should be copied into historical reports at meaningful workflow boundaries, such as initial Job association or explicit reassignment, rather than continuously synchronized.

---

# UX Observations

## Inventory

### Pending Receivals material autocomplete

**Observation**

The material autocomplete currently appears to search existing inventory records rather than canonical material definitions.

As a result, materials that already exist in inventory are presented with a size already appended, for example:

- Toros Black #2
- Arabian Black #1

The user is then still required to choose a Size separately.

This creates unnecessary confusion because the selected value appears to already include the size.

**Desired behavior**

Material and Size should remain independent concepts.

Workflow should become:

1. Select Material.
2. Select Size.

The Material selector should display only the material identity.

Example:

- Toros Black
- Arabian Black
- B70 IT Black

The Size selector should then present only the available sizes for that material.

This preserves the underlying data model and avoids exposing inventory-specific records during expected-material entry.

---

### Text cursor appears on whitespace

**Observation**

Clicking empty areas of various application pages displays a blinking text cursor despite there being no editable field.

This suggests to users that they can begin typing when no input actually exists.

**Desired behavior**

The text caret should only appear inside editable controls.

Clicking whitespace should simply clear focus.

---

### Pending Receivals modal can accidentally discard work

**Observation**

When selecting or highlighting text inside the Pending Receivals modal, dragging beyond the modal boundary causes the dialog to dismiss.

This immediately clears the entire Pending Receivals form.

This is especially problematic because the form often contains multiple manually entered order lines.

**Desired behavior**

The dialog should prioritize preserving user-entered data.

Outside-click dismissal should not occur while:

- selecting text
- dragging
- interacting with dropdowns

Longer term, Pending Receivals should likely avoid outside-click dismissal entirely.

Preferred close actions:

- Close button
- Escape key
- Explicit confirmation if unsaved changes exist

Preventing accidental data loss is more important than matching common modal behavior.

---

# Product Learning

Operational data-entry workflows should always favor preserving user input over minimizing clicks.

Whenever a workflow can reasonably contain multiple manually entered records, accidental dismissal should be treated as a data-loss event and prevented wherever practical.

## Operational Workflows

Existing operational workflows should be preserved whenever they are efficient, even if they originated from software limitations.

Marcos' Monday Manpower board is an example of a workflow that evolved around Monday's constraints but has become familiar and highly efficient for daily use.

TenOps should preserve successful user workflows while replacing only the underlying technical limitations.

Users should feel that TenOps is a natural evolution of how they already work rather than an entirely new system that requires retraining.
