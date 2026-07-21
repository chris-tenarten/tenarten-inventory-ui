# Design Patterns

## 1. Contextual Administration

Use when a dropdown depends on business-maintained reference data.

```text
Dropdown
├── Active options
└── Add / Remove...
      └── Small management dialog
```

The management dialog may support:

- add
- rename
- reorder
- deactivate
- reactivate

Avoid exposing IDs or technical metadata.

## 2. Invisible Relationships

```text
User selects friendly record
        ↓
TenOps resolves stable ID
        ↓
Transaction stores foreign key
```

Examples:

- Job name → `job_id`
- Worker name → `worker_id`
- Process name → `process_step_id`
- Material name → `material_id`

## 3. Separate Workflows, Shared Infrastructure

Keep distinct business forms separate when users understand and complete them separately.

Share underneath:

- job selection
- date handling
- reference-data dropdowns
- audit fields
- validation
- parent/child persistence
- reporting dimensions

Applied to:

- Manpower Utilization
- Material Usage
- Daily Production

## 4. Parent Header + Detail Grid

Used for familiar report-style entry:

```text
Report header
- Job
- Date
- prepopulated identifiers
- notes

Detail grid
- one or more entries
```

TenOps stores true parent/child relationships rather than fake header rows.

## 5. Table-First Operations

Use direct table editing when users already manage information in spreadsheets.

Key behaviors:

- inline editing
- save on blur for existing records
- explicit save for unsaved new records
- compact row feedback
- dense layout
- keyboard-friendly interaction
- configurable view preferences

## 6. Optional Scheduling

Jobs remain visible without fabricated dates.

Display states:

- planned start + finish → duration bar
- delivery date only → milestone
- no dates → unscheduled

## 7. Reference Data vs. System Structure

### Personal preferences

Safe to customize per user:

- visible columns
- column widths
- sorting
- filters
- default view
- density

### Business configuration

Controlled in-app reference data:

- workers
- processes
- production metrics
- units
- document types
- selected statuses

### Fixed system structure

Requires development:

- jobs
- labor entries
- material usage
- production output
- inventory quantities
- attachments

## 8. Inactive Instead of Deleted

Reference values used by historical data are marked inactive instead of deleted.

## 9. Familiar Workflow with Quality-of-Life Improvements

Preserve:

- layout
- ordering
- terminology
- grouping
- density
- expected sequence

Improve:

- prepopulation
- searchable lists
- defaults
- validation
- totals
- auditability
- attachments
- relational analytics

## 10. Production Job References

`src/modules/production/job-reference.ts` owns the lightweight canonical Job
reference shape and pure label rules. Existing linked references prefer the Job
name and fall back to Job number. Selector labels may show both values because
selection benefits from additional recognition context.

`src/modules/production/job-options.ts` owns loading active/selectable Jobs and
opening the canonical Production context. Feature modules consume that boundary
instead of issuing their own selectable-Job queries.

Keep three UI responsibilities distinct:

- selectors create or change a Job association
- references and badges display an existing association
- launch actions navigate to and focus the canonical Production Job

Temporary labels remain feature-supported unresolved work identity. They are
not canonical Job references and must not receive linked-Job presentation.
