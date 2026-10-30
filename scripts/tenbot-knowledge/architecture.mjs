/** Reviewed semantic facets for existing published records, consumed by the knowledge generator.
 * Source paths, related IDs and tool names are maintenance/runtime metadata, never employee prose.
 * A pinned source establishes a repository contract; it is not fresh hosted-state verification.
 */
const fact = (text, classification = 'operational-rule', verification = 'repository-contract') => ({text, classification, verification});
const relation = (from, verb, to, cardinality) => ({from, relation: verb, to, ...(cardinality ? {cardinality} : {})});
const record = (id, sourceFiles, relatedRecordIds, architecture, options = {}) => ({
 id, release: 'intake', sourceFiles, relatedRecordIds, toolNames: [],
 architecture: {entities: [], relationships: [], facts: [], preconditions: [], effects: [], approvalRequirements: [], limitations: [], ...architecture},
 ...options,
});

export const architectureRecords = [
 record('workflow-intake-convert', [
  'src/modules/pre-production/BidPlanningCard.tsx',
  'src/modules/pre-production/planning-data.ts',
  'supabase/migrations/20260923220000_intake_projected_planning.sql',
  'supabase/migrations/20261026120000_bid_scope_production_handoff.sql',
 ], ['knowledge-intake', 'sample-bid', 'production-create-job', 'production-schedule', 'knowledge-production'], {
  entities: ['Bid', 'Production Job', 'Accepted scope', 'Issued document'],
  relationships: [relation('Bid', 'converts to', 'Production Job', 'zero-or-one'), relation('Production Job', 'retains', 'Accepted scope', 'zero-or-one')],
  facts: [
   fact('A Bid conversion creates or returns one canonical Production Job; retrying the conversion does not create another.', 'schema-contract'),
   fact('The conversion gate is saved Won status and a recorded Deposit Received Date.'),
   fact('Accepted scope, formulation verification and material assessment are not conversion prerequisites.', 'product-convention', 'released-source'),
  ],
  preconditions: ['Save or discard unsaved Bid edits before conversion.', 'Committing carried or new dates additionally requires Production scheduling permission.'],
  effects: ['The original Bid remains linked to the canonical Job.', 'Production owns committed scheduling after conversion.', 'A Job number may remain blank; conversion does not allocate one automatically.'],
  approvalRequirements: ['Review the handoff choices and choose Confirm conversion in the existing application.'],
  limitations: ['A projected Bid window does not reserve Production capacity.', 'Conversion does not rewrite previously issued documents or establish material readiness.'],
 }, {toolNames: ['find_jobs', 'get_job_summary']}),

 record('production-rework-create', [
  'src/modules/production/components/CreateReworkDialog.tsx',
  'src/modules/production/components/ReworkQuickAction.tsx',
  'supabase/migrations/20260817_003_production_rework_cycles.sql',
  'docs/architecture/production-rework.md',
 ], ['knowledge-production', 'manpower-record-labor', 'production-rework-status', 'production-schedule'], {
  entities: ['Production Job', 'Original Production lifecycle', 'Rework cycle', 'Labor entry'],
  relationships: [relation('Production Job', 'has historical', 'Rework cycle', 'one-to-many'), relation('Labor entry', 'may identify', 'Rework cycle', 'zero-or-one')],
  facts: [
   fact('Rework belongs to the existing canonical Production Job; it does not create another commercial Job.', 'schema-contract'),
   fact('Only one Rework cycle may be active for a Job at a time.', 'schema-contract'),
   fact('Active Rework supplies the displayed operational status and schedule while preserving the original Production status and dates.'),
  ],
  preconditions: ['The Job must be complete, unarchived and have no active Rework cycle.', 'Provide the existing reason, scope and Intake / Return Date.'],
  effects: ['The new Rework cycle remains associated with the same Job.', 'Commercial documents, Purchase Orders, files and Job Updates remain Job-scoped.'],
  approvalRequirements: ['Review the Rework details and choose Create Rework in the existing application.'],
  limitations: ['Free-text Rework scope does not establish piece-level or Color Plate-level analytics.', 'Viewing Job facts does not authorize creating or changing Rework.'],
 }, {toolNames: ['find_jobs', 'get_job_summary']}),

 record('manpower-record-labor', [
  'src/modules/manpower/ManpowerWorkspace.tsx',
  'src/modules/manpower/work-target.ts',
  'src/modules/manpower/product-reporting.ts',
  'supabase/migrations/20260824_002_manpower_rework_attribution.sql',
 ], ['workflow-manpower-history', 'production-rework-create', 'knowledge-production', 'workflow-material-usage'], {
  entities: ['Reporting group', 'Labor entry', 'Production Job', 'Rework cycle', 'Temporary work label', 'Product Category'],
  relationships: [relation('Reporting group', 'organizes', 'Labor entry', 'one-to-many'), relation('Labor entry', 'may attribute work to', 'Production Job', 'zero-or-one'), relation('Labor entry', 'may attribute work to', 'Rework cycle', 'zero-or-one')],
  facts: [
   fact('A reporting group organizes labor entry and is independent of Production Job identity.', 'schema-contract'),
   fact('A labor entry identifies a canonical Job or a temporary work label; Rework attribution must belong to the same canonical Job.', 'schema-contract'),
   fact('Total labor hours are derived from AM plus PM hours; hours must be nonnegative and total no more than 24 per entry.'),
  ],
  preconditions: ['Use the existing active Worker, Task and Product Category selections for new entries.', 'Choose the appropriate original Job, Rework cycle or temporary work identity.'],
  effects: ['Saved labor contributes to reporting under its recorded work identity and date.', 'Original or unclassified labor and explicitly attributed Rework labor remain distinguishable.'],
  approvalRequirements: ['Review the entry and use Add Entry or the existing edit-save action.'],
  limitations: ['A temporary work label does not create a Job or automatically appear in canonical Job labor totals.', 'Labor hours do not establish actual output, remaining work or physical material availability.'],
 }, {toolNames: ['find_jobs', 'get_job_labor_summary']}),

 record('workflow-po-allocations', [
  'src/modules/purchasing/LineAllocations.tsx',
  'src/modules/purchasing/allocation-model.ts',
  'src/modules/purchasing/mutations.ts',
  'supabase/migrations/20260923160100_po_reservation_allocations.sql',
 ], ['workflow-po-draft', 'workflow-po-issue', 'workflow-po-receivals', 'inventory-stock-reservation'], {
  entities: ['Purchase Order', 'Purchase Order line', 'Job allocation', 'Production Job', 'General stock'],
  relationships: [relation('Purchase Order', 'contains', 'Purchase Order line', 'one-to-many'), relation('Purchase Order line', 'has', 'Job allocation', 'one-to-many'), relation('Job allocation', 'identifies', 'Production Job', 'one-to-one')],
  facts: [
   fact('One Purchase Order line can allocate ordered units to multiple canonical Jobs, with at most one allocation per Job on that line.', 'schema-contract'),
   fact('Allocation quantities must be positive and their total cannot exceed the ordered line quantity.'),
   fact('The document-level Job context alone does not allocate material.'),
  ],
  preconditions: ['Edit allocations on a draft Purchase Order.', 'Express allocations in the Purchase Order order unit, rather than package contents.'],
  effects: ['Issuance captures the reviewed allocation intent.', 'Explicit receival projection preserves Job portions and any general-stock remainder.', 'Allocated units become Job-reserved Inventory only when actually received.'],
  approvalRequirements: ['Review allocation totals and the remainder, resolve validation errors, then Save Draft.'],
  limitations: ['Draft allocations and incoming expectations are not on-hand Inventory.', 'Allocating a Purchase Order does not establish supplier arrival or Job readiness.'],
 }, {toolNames: ['find_jobs']}),

 record('workflow-po-receivals', [
  'src/modules/purchasing/PendingReceivalsReviewDialog.tsx',
  'src/modules/purchasing/mutations.ts',
  'supabase/migrations/20260723_008_purchase_order_pending_receivals.sql',
  'supabase/migrations/20260923160100_po_reservation_allocations.sql',
 ], ['workflow-po-allocations', 'workflow-po-issue', 'inventory-pending-receive', 'inventory-stock-reservation', 'knowledge-material-assessment'], {
  entities: ['Issued Purchase Order', 'Permanent Purchase Order PDF', 'Pending Receival', 'Job allocation', 'Inventory'],
  relationships: [relation('Issued Purchase Order', 'projects reviewed lines into', 'Pending Receival', 'one-to-many'), relation('Pending Receival', 'preserves', 'Job allocation')],
  facts: [
   fact('Pending Receivals are created explicitly from immutable issued Purchase Order facts after permanent PDF generation.'),
   fact('Already projected source lines are recognized on retry rather than created again.'),
   fact('Captured allocation intent preserves the issued material, quantity and order unit.'),
  ],
  preconditions: ['The Purchase Order must be issued and its permanent PDF generated.', 'Review the selected remaining lines, ETA and location using the existing permissions.'],
  effects: ['Creates incoming queue rows and preserves their issued source and allocation context.'],
  approvalRequirements: ['Review the selected lines and confirm Create Pending Receivals or Create Remaining Lines in the existing application.'],
  limitations: ['Projection does not receive material or increase on-hand stock.', 'Requested delivery is not evidence of material arrival; ETA starts blank.', 'The receival workflow does not create a Vendor Invoice domain or promise a delivery date.'],
 }),

 record('inventory-pending-receive', [
  'src/app/inventory/page.tsx',
  'supabase/migrations/20260722_001_pending_receival_undo.sql',
  'supabase/migrations/20260923160200_partial_pending_receipts.sql',
 ], ['workflow-po-receivals', 'inventory-stock-reservation', 'inventory-activity', 'inventory-stock-search', 'knowledge-material-assessment'], {
  entities: ['Pending Receival', 'Receipt', 'Inventory lot', 'Inventory Activity', 'Production Job'],
  relationships: [relation('Pending Receival', 'may have', 'Receipt', 'one-to-many'), relation('Receipt', 'updates', 'Inventory lot'), relation('Receipt', 'records history in', 'Inventory Activity')],
  facts: [
   fact('A receipt quantity must be positive and no greater than the remaining expected quantity.'),
   fact('Only the received quantity enters Inventory; any outstanding balance remains pending.'),
   fact('Receiving preserves the canonical Job reservation, temporary reservation or general-stock identity.'),
  ],
  preconditions: ['Use an outstanding receival and enter Received By and Quantity received now.'],
  effects: ['Updates the received balance, Inventory lot and transaction history together.', 'Retains the existing reservation identity in stock and history.'],
  approvalRequirements: ['Review the received quantity and choose Confirm Receive.', 'Undo latest receipt is a separate Inventory-adjustment action with its own confirmation.'],
  limitations: ['If a result is uncertain, keep the dialog open and retry the same quantity there.', 'Undo can be blocked when receipt lineage is unavailable or the received stock changed or is no longer fully available.', 'Receiving material does not automatically establish that every Job requirement is satisfied.'],
 }),

 record('inventory-stock-reservation', [
  'src/app/inventory/page.tsx',
  'supabase/migrations/20260714_005_inventory_production_job_reservations.sql',
  'supabase/migrations/20260721_001_atomic_inventory_reservations.sql',
 ], ['inventory-stock-search', 'inventory-pending-receive', 'workflow-po-allocations', 'knowledge-material-assessment', 'knowledge-production'], {
  entities: ['Inventory lot', 'Production Job', 'Temporary reservation', 'General stock'],
  relationships: [relation('Inventory lot', 'may reserve stock for', 'Production Job', 'zero-or-one'), relation('Production Job', 'may have reserved', 'Inventory lot', 'one-to-many')],
  facts: [
   fact('A lot is general stock, reserved for one canonical Job, or reserved under one temporary work label; canonical and temporary reservation identities are mutually exclusive.', 'schema-contract'),
   fact('Splitting a new reservation requires general stock and a positive quantity no greater than the selected lot quantity.'),
   fact('Stock reserved elsewhere is distinct from stock available for this Job.'),
  ],
  preconditions: ['Select the individual lot and the intended canonical Job or temporary label.', 'Save material-identity corrections separately before splitting or releasing a reservation.'],
  effects: ['A partial reservation separates a reserved lot from the remaining general stock.', 'Releasing a reservation returns it to general stock; compatible general lots may merge.'],
  approvalRequirements: ['Review the lot, target and quantity, then use the existing Save Details or Return to General Stock action.'],
  limitations: ['A temporary reservation label does not create a canonical Job.', 'Reservation knowledge does not authorize reallocating another Job’s stock.', 'Current balances already separate reservation identities; do not subtract the same reservation twice.'],
 }, {toolNames: ['find_jobs']}),

 record('workflow-material-usage', [
  'docs/workflows/MATERIAL_USAGE.md',
  'src/modules/material-usage/actions.ts',
  'src/modules/material-usage/canonical-job-defaults.ts',
  'supabase/migrations/20260720_001_material_usage_reporting.sql',
 ], ['inventory-stock-movement', 'inventory-stock-reservation', 'manpower-record-labor', 'knowledge-production'], {
  entities: ['Material Usage report', 'Material Usage line', 'Production Job', 'Temporary work label', 'Inventory'],
  relationships: [relation('Material Usage report', 'contains ordered', 'Material Usage line', 'one-to-many'), relation('Material Usage report', 'may identify', 'Production Job', 'zero-or-one')],
  facts: [
   fact('A report belongs to a canonical Job or an explicitly confirmed temporary work label, never both.', 'schema-contract'),
   fact('Saving stores the report header and ordered material lines together.'),
   fact('Recording Material Usage does not automatically decrement Inventory or consume a reservation.', 'product-convention', 'released-source'),
   fact('Job Number and Work Order Number remain distinct historical snapshots; a missing Work Order does not fall back to Job Number.'),
  ],
  preconditions: ['Choose the work identity and report date.', 'Resolve any Color Plate conflict before applying a new Job association.'],
  effects: ['Retains the reported materials, quantities, units, authorship and historical work identity.', 'All Chip Blend lines share the report Color Plate; other material types do not store it.'],
  approvalRequirements: ['Review the report and choose Save Report.'],
  limitations: ['Opening a saved report does not refresh historical identifiers from Production.', 'Material Usage does not update Production.', 'Inventory outtake is a separate existing operation with its own permissions and validation.'],
 }),

 record('proposal-issue-revise', [
  'src/modules/proposals/ProposalPanel.tsx',
  'supabase/migrations/20260827_004_proposal_generator_v1.sql',
  'supabase/migrations/20260908_004_proposal_generator_v2.sql',
 ], ['proposal-create', 'sample-bid', 'workflow-intake-convert'], {
  entities: ['Proposal', 'Internal Estimate', 'Issued revision', 'Bid', 'Production Job'],
  relationships: [relation('Proposal', 'retains historical', 'Issued revision', 'one-to-many'), relation('Proposal', 'may have context from', 'Production Job', 'zero-or-one')],
  facts: [
   fact('A Proposal can exist and be issued independently of a Production Job.', 'product-convention', 'released-source'),
   fact('Issuance freezes the customer Proposal and Internal Estimate snapshots.'),
   fact('Changing an issued Proposal uses a new revision draft; the earlier issued document remains unchanged.'),
  ],
  preconditions: ['Existing Proposal access is required independently of access to a Job or Bid.', 'Review the customer Proposal and Internal Estimate before issuance.'],
  effects: ['Creates historical issued content for the reviewed revision.'],
  approvalRequirements: ['Choose Issue / Generate PDF and confirm issuance in the existing application.'],
  limitations: ['Later customer edits or Bid/Job relationships do not rewrite issued history.', 'Knowing Proposal relationships does not grant access to restricted commercial content.'],
 }),

 record('sample-bid', [
  'src/modules/pre-production/BidWorkspace.tsx',
  'src/modules/pre-production/BidTools.tsx',
  'src/modules/samples/queries.ts',
  'supabase/migrations/20260923215900_intake_early_access.sql',
  'supabase/migrations/20260901_005_sample_color_plate_generator.sql',
 ], ['knowledge-intake', 'sample-save', 'sample-work-order', 'proposal-create', 'workflow-intake-convert'], {
  entities: ['Bid', 'Sample', 'Issued Sample document', 'Production Job'],
  relationships: [relation('Bid', 'may link', 'Sample', 'one-to-many'), relation('Sample', 'may link to', 'Bid', 'zero-or-one'), relation('Sample', 'retains', 'Issued Sample document', 'one-to-many')],
  facts: [
   fact('A Sample may exist independently of a Production Job.', 'product-convention', 'released-source'),
   fact('Bid Preparation reuses the existing Proposal and Sample generators and libraries.'),
   fact('Link Sample associates an existing standalone Sample; it does not reassign a Sample already linked to another Bid.'),
  ],
  preconditions: ['Use the existing independent Intake, Sample and Proposal permissions for the selected action.'],
  effects: ['Create Sample carries Bid, Customer and Project context into the canonical Sample generator.', 'Linking context preserves existing issued Sample document contents.'],
  approvalRequirements: ['Save a new Sample in the existing generator or explicitly choose Link Sample for an existing standalone Sample.'],
  limitations: ['A Bid-context Sample does not fabricate a Production Job.', 'Creating or linking a Sample does not establish Production readiness or authorize document access.'],
 }, {release: 'bidPreparation'}),

 record('knowledge-material-assessment', [
  'supabase/functions/_shared/bid-scope-handler.ts',
  'src/modules/intake-materials/requirements.ts',
  'src/modules/intake-materials/data.ts',
  'src/modules/pre-production/BidWorkspace.tsx',
  'supabase/migrations/20261026110000_bid_accepted_scope.sql',
 ], ['sample-save', 'sample-work-order', 'knowledge-blend', 'inventory-stock-search', 'inventory-stock-reservation', 'workflow-po-receivals', 'inventory-pending-receive', 'workflow-intake-convert'], {
  entities: ['Material requirement', 'Captured Sample or issued Blend', 'Reviewed material mapping', 'General stock', 'Own-Job reservation', 'Other reservation', 'Incoming supply', 'Supplier evidence'],
  relationships: [relation('Material requirement', 'derives from', 'Captured Sample or issued Blend'), relation('Material requirement', 'uses', 'Reviewed material mapping'), relation('Material assessment', 'distinguishes', 'Incoming supply'), relation('Material assessment', 'uses', 'Supplier evidence')],
  facts: [
   fact('Requirement calculation uses exact captured formulation authority and reviewed quantity or yield inputs.'),
   fact('Availability assessment requires reviewed material identity and unit-conversion evidence; similar names alone do not establish a match.'),
   fact('General stock, own-Job reservations, reservations elsewhere and incoming supply remain separate.'),
   fact('Repeated requirements cannot each claim the same shared stock; missing quantities or supplier evidence remain unknown.'),
  ],
  preconditions: ['Resolve formulation, material mapping and unit evidence before treating calculated quantities as usable.', 'Use supplier/catalog evidence or documented manual estimates for lead-time discussion.'],
  effects: ['Existing retained services can derive requirements and read-only shortages from reviewed evidence.'],
  approvalRequirements: ['Review unresolved assumptions and evidence in the existing owning workflow; knowledge alone does not approve stock or purchasing actions.'],
  limitations: ['These sources do not verify a current employee-facing assessment editor.', 'Assessment does not reserve stock, create orders, receive material or change Material Status.', 'Incoming supply is not on-hand stock, and an ETA is not a promised Production or customer delivery date.', 'Current assistant capabilities must be checked separately; a described business service is not automatically an executable assistant tool.'],
 }),

 record('knowledge-production', [
  'src/modules/production/jobs.ts',
  'src/modules/production/readiness.ts',
  'docs/workflows/PRODUCTION_PIPELINE.md',
  'docs/workflows/DAILY_PRODUCTION.md',
  'docs/schemas/OPERATIONAL_REPORTING.md',
 ], ['workflow-intake-convert', 'production-rework-create', 'production-schedule', 'manpower-record-labor', 'workflow-material-usage', 'knowledge-material-assessment'], {
  entities: ['Production Job', 'Planning completeness', 'Material Status', 'Labor entry', 'Material Usage report', 'Actual production output'],
  relationships: [relation('Production Job', 'may have', 'Labor entry', 'one-to-many'), relation('Production Job', 'may have', 'Material Usage report', 'one-to-many')],
  facts: [
   fact('The canonical Production Job connects operational scheduling, labor, material reporting, reservations and documents.', 'product-convention', 'released-source'),
   fact('Planning completeness is separate from Material Status and Production status.'),
   fact('Labor, material consumption and actual output describe different operational facts.', 'product-convention'),
  ],
  limitations: ['Planning Complete does not establish that a Job is unblocked or has sufficient materials.', 'These sources do not verify an implemented actual-output reporting capability.', 'Saved plans, Blend quantities and labor hours do not establish actual units produced.', 'Current Job read tools cannot independently establish physical stock sufficiency or promise completion.'],
 }, {toolNames: ['find_jobs', 'get_job_summary', 'get_job_planning', 'get_job_labor_summary', 'get_production_overview']}),

 record('workflow-manpower-history', [
  'src/modules/manpower/group-presentation.ts',
  'src/modules/manpower/progressive-history.ts',
  'src/modules/manpower/ManpowerWorkspace.tsx',
 ], ['manpower-record-labor', 'manpower-job-filter', 'production-rework-create', 'knowledge-production'], {
  entities: ['Reporting group', 'Labor entry', 'Reporting period', 'Production Job'],
  relationships: [relation('Reporting group', 'retains complete membership of', 'Labor entry', 'one-to-many')],
  facts: [
   fact('Reporting groups default to the leading valid reporting date in their name, newest first; editing a Job or labor entry does not sort groups by modification time.'),
   fact('Groups start collapsed and member rows use newest Work Date first.'),
   fact('Analytics use the selected reporting period while expanded groups retain complete membership across their dates.'),
  ],
  effects: ['Search, sorting and Product Category filtering change presentation without changing saved labor.'],
  limitations: ['Sorting covers loaded complete groups, and order may change while older groups load.', 'Wait for All available history loaded before treating search as exhaustive.', 'Complete labor totals do not imply a complete actual-output history.'],
 }, {release: 'manpower', toolNames: ['find_jobs', 'get_job_labor_summary']}),

 record('knowledge-intake', [
  'src/modules/pre-production/BidWorkspace.tsx',
  'src/modules/pre-production/BidTools.tsx',
  'src/modules/intake-materials/related-records.ts',
 ], ['sample-bid', 'proposal-create', 'workflow-intake-convert', 'knowledge-material-assessment', 'knowledge-production'], {
  entities: ['Bid', 'Proposal', 'Sample', 'Production Job'],
  relationships: [relation('Bid', 'shows authorized related', 'Proposal'), relation('Bid', 'shows authorized related', 'Sample'), relation('Bid', 'may link its converted', 'Production Job', 'zero-or-one')],
  facts: [
   fact('Bid Preparation is on Overview and contains the existing Proposal and Sample creation and library actions.'),
   fact('Ordinary Bid activity does not require governing documents, material-planning inputs or a Production Job.', 'product-convention', 'released-source'),
  ],
  effects: ['Existing related records and the canonical converted Job remain discoverable through their authorized context.'],
  limitations: ['Author formulations in Samples and use existing commercial document workflows rather than duplicating them in Intake.', 'Material shortages, missing references and planning fields do not replace the saved Won and deposit conversion gate.', 'Access to a Bid does not by itself grant access to Proposal content or authorize Production scheduling.'],
 }, {release: 'bidPreparation', toolNames: ['find_jobs', 'get_job_summary']}),
];
