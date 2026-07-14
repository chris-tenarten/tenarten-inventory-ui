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
