// Module-level release contract. Source text and controls are extracted, not copied here.
// Updating the release requires checking the executed receipt and deployed feature flags.
export const releases = {intake: {
 revision: 'bc628bdafea374f6a5fd446d7e924ff9d65918bf',
 verifiedAt: '2026-10-27',
 receiptRevision: '493b55d',
 receipt: 'docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md',
 receiptAnchor: 'executed-intake-release--october-27-2026',
 receiptHeading: '## Executed Intake release — October 27, 2026',
},bidPreparation: {
 revision: '5e28d254b8d674ec64ce2ba347c83108366af936',
 verifiedAt: '2026-10-28',
 receiptRevision: 'd3f42a76eaa3bc4d9bfe9fbd048d8ef61355efb8',
 receipt: 'docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md',
 receiptAnchor: 'executed-bid-preparation-release--october-28-2026',
 receiptHeading: '## Executed Bid Preparation release — October 28, 2026',
},manpower: {
 revision: 'ae50e0fc55a7a6d9e454016c5d73a58e792aff79',
 verifiedAt: '2026-10-29',
 receipt: 'docs/project-memory/2026-10-29-manpower-default-restoration.md',
 receiptAnchor: 'executed-approved-priority-release--october-29-2026',
 receiptHeading: '## Executed approved priority release — October 29, 2026',
 receiptCapture: 'scripts/tenbot-knowledge/release-evidence/manpower-20261029.json',
 receiptCaptureSha256: '683ff3132cc63820e85e016822b3fdae07937cf4e90e61810709fe2e64e2d421',
}};
// The base extraction remains at its reviewed release; newer scoped facts use
// explicit per-record releases below instead of advancing deployed knowledge to HEAD.
export const release = releases.intake;
// Future infrastructure-only reviews are separate from executed business releases.
// Each exact path/blob requires Chris's committed acceptance and an explicit
// unchanged business-meaning/permission/lifecycle/effects declaration. These can
// never acknowledge migrations, permission paths or bound semantic dependencies.
// Keep acknowledgments outside the reviewed source so an exact source blob can
// be accepted without a self-referential hash inside that same file.
export const infrastructureReviewsPath='scripts/tenbot-knowledge/infrastructure-reviews.json';
const manifest='docs/project/PROJECT_MANIFEST.md',state='docs/project-memory/CURRENT_STATE.md';
const doc=(path,...paragraphs)=>({path,paragraphs});
export const modules=[
 {id:'production',title:'Production workspace and canonical Jobs',modules:['production'],terms:'production job jobs queue overview table find search filters archive schedule status material readiness',permission:'readOperationalData',route:'/',path:'Production → Overview / Table / Timeline',
  docs:[doc('docs/workflows/PRODUCTION_PIPELINE.md','Project name is the only required field.','Production Pipeline now presents three synchronized views','Planning completeness is derived in one shared helper.')],
  ui:['src/modules/production/ProductionWorkspace.tsx'],excludeUI:'planning|phase|snapshot|temporary approval|client-side|MVP',contracts:['src/modules/production/jobs.ts'],
  boundary:'Read-only navigation facts. Job creation, edits and scheduling additionally require business-write permission. Phase and Item Planning is not enabled in the verified deployed build.'},
 {id:'rework',title:'Production Rework lifecycle and requirements',modules:['production','rework'],terms:'rework redo repair initiate start reason scope return date original active completed cancelled cycle',permission:'readOperationalData',additionalPermissions:['writeBusinessData'],route:'/',path:'Production → Job → Create Rework',
  docs:[doc('docs/architecture/production-rework.md','TenOps models Rework as a lifecycle','The original lifecycle remains')],
  ui:['src/modules/production/components/CreateReworkDialog.tsx','src/modules/production/components/ReworkQuickAction.tsx'],
  boundary:'Rework belongs to an existing canonical Production Job. Only one active Rework is allowed; eligible Job states and the actual Create Rework action remain authoritative.'},
 {id:'timeline',title:'Production Timeline and staged schedule',modules:['production','timeline'],terms:'timeline schedule scheduling move drag dates range zoom fit today delivery save discard approval planned start finish',permission:'readOperationalData',additionalPermissions:['writeBusinessData'],route:'/',path:'Production → Timeline → Save All / Discard All',
  docs:[doc('docs/workflows/PRODUCTION_PIPELINE.md','Timeline edits stage the same','Table/Timeline switching and filtering preserve','Selecting Save All opens a schedule approval dialog','Labor intensity is derived rather than stored.')],
  ui:['src/modules/production/components/ScheduleReviewDialog.tsx'],
  boundary:'Ordinary Production Timeline is available independently of disabled Phase/Item Planning. Staging does not save; approval and explicit confirmation are required. Read-only accounts may view but cannot stage changes.'},
 {id:'manpower',title:'Manpower Reporting work identity and filters',modules:['manpower'],terms:'manpower reporting labor labour filter job jobs worker task date search hours reporting group temporary label total',permission:'readOperationalData',additionalPermissions:['writeBusinessData'],route:'/manpower-reporting',path:'Manpower Reporting → Job / Search',
  docs:[doc(manifest,'Manpower Reporting records labor','Persistent reporting groups organize','Total hours derive from AM plus PM')],
  ui:['src/modules/manpower/ManpowerWorkspace.tsx'],
  boundary:'Job dropdown filtering uses business-write-gated controls in the released UI. Read-only accounts retain search/authorized deep-link review. Reporting groups are not Jobs.'},
 {id:'samples',title:'Samples, formulations, Batch and Blend Sheets',modules:['samples'],terms:'sample samples color plate formulation batch blend sheet pour working production quantity prepare save issue import historical',permission:'readOperationalData',additionalPermissions:['writeBusinessData'],route:'/samples',path:'Samples → Sample Draft Library',
  docs:[],
  ui:['src/modules/samples/SampleWorkspace.tsx'],excludeUI:'blend|batch|production|issue|post to|formula tutorial|PRINT COLOR PLATE LABEL',contracts:['src/modules/samples/queries.ts'],
  boundary:'Samples and Blend Sheets use the established generator and saved/issued revisions. Production Blend management actions require a separate explicit permission. Imported shop quantities do not automatically establish Batch authority. Only supplied source text establishes a workflow; a control label alone is not a sequence.'},
 {id:'blend',title:'Production Batch and Blend planning',modules:['samples'],terms:'batch blend sheet formula planned chip quantity preparation production output working issued',permission:'readOperationalData',additionalPermissions:['writeBusinessData','production_blend.manage'],route:'/samples',path:'Samples → Plan Production Blend',docs:[],ui:['src/modules/samples/ProductionBatchOutput.tsx'],contracts:['src/modules/samples/batch-projection.ts','src/modules/samples/queries.ts'],boundary:'Production Blend planning requires the separate explicit Production Blend management grant as well as operational-read and business-write access. Use the existing Samples formulation and Plan Production Blend workflow. Saved Sample, working Batch plan and issued Blend revisions remain distinct; issuing a document does not imply Inventory mutation or a promised lead time. Controls alone do not establish additional workflow steps.'},
 {id:'sample-bid',title:'Bid-context Samples and existing Sample links',modules:['intake','samples'],terms:'sample samples bid bids attach link existing standalone context create related tools',permission:'viewIntake',additionalPermissions:['accessIntake','readOperationalData','writeBusinessData'],route:'/pre-production',path:'Intake → Bid → Tools → Open related Samples',
  docs:[],ui:['src/modules/pre-production/BidTools.tsx'],contracts:['src/modules/samples/queries.ts','supabase/migrations/20260923215900_intake_early_access.sql'],
  // Narrow source ranges avoid unrelated formulation/Blend grant controls.
  ranges:[{path:'src/modules/samples/SampleWorkspace.tsx',from:'Bid-context Samples',to:'<section className="mt-5 border border-slate-300 bg-white">'}],
  boundary:'The released Bid-context Samples screen links an existing standalone Sample with Existing standalone Sample → Link Sample. A Sample already linked to another Bid cannot be reassigned by this action. Create Sample in Bid Tools starts a new canonical Sample with Bid, Customer and Project context. Existing generated documents are not changed.'},
 {id:'proposals',title:'Proposal drafts, issuance and historical revisions',modules:['proposals'],terms:'proposal proposals quote estimate draft create issue issued revision pdf customer bid job standalone',permission:'proposal.access',additionalPermissions:['writeBusinessData'],route:'/proposals',path:'Proposals → Proposal Generator',
  docs:[doc(state,'- Proposal and Transmittal document domains are implemented.')],ui:['src/modules/proposals/ProposalPanel.tsx'],
  boundary:'Proposal access requires an existing explicit grant or administrator access, independently of access to a Job or Bid. Issued snapshots remain historical; later customer edits and context do not rewrite them.'},
 {id:'inventory',title:'Inventory balances, reservations and receiving',modules:['inventory'],terms:'inventory stock balance lot reserve reservation reserved receive receiving incoming pending receivals quantity location movement activity undo',permission:'readOperationalData',route:'/inventory',path:'Inventory → Pending Receivals / Inventory Activity',
  docs:[doc(manifest,'Pending Receivals represent incoming material.','Receiving preserves material identity,','Pending Receivals open collapsed')],ui:[],
  boundary:'Viewing is distinct from mutation. Receiving additionally requires receiving permission and business-write permission; adjustments require Inventory adjustment permission and business-write permission. Reservations and movements follow existing write/RLS checks. Incoming stock is not on-hand availability.'},
 {id:'purchasing',title:'Purchase Order drafts, issuance, PDFs and receiving projection',modules:['purchasing','inventory'],terms:'purchasing purchase order po procurement vendor catalog draft issue pdf pending receivals chip resin lines',permission:'readOperationalData',additionalPermissions:['writeBusinessData'],route:'/purchasing',path:'Purchasing → New Purchase Order',
  docs:[doc('docs/workflows/PURCHASING.md','Phase 1 supports New Purchase Order,','The optional PO-level Production Job','Catalog selection proposes identity','A saved, automatically numbered Draft','Retrying the same revision','After issuance succeeds,','After the permanent document is generated,')],ui:[],
  boundary:'These are generic workflow descriptions; no live financial records or prices are included. Issued documents are immutable and PDF failure does not undo issuance. Pending Receivals creation is explicit after permanent PDF generation; incoming material does not become Inventory until receiving.'},
 {id:'contacts',title:'Shared Contacts and Customer Inspector',modules:['contacts'],terms:'contact contacts customer customers company edit saved details phone email address linked jobs directory',permission:'writeBusinessData',additionalPermissions:['editProductionJobDetails'],route:'/contacts',path:'Toolbox → Resources → Contacts → Customer Inspector',
  docs:[],ui:['src/modules/production/contacts/CustomerInspector.tsx'],
  boundary:'Saved customer editing requires existing business-write and customer-detail editing permissions. Future selections use updated directory values; existing Jobs/issued Proposals retain their captured values. Customer search and Linked Jobs are available separately with operational-read access.'},
 {id:'messaging',title:'Messaging groups, personal DMs and conversation privacy',modules:['messaging','my-work'],terms:'messaging message messages dm personal direct group conversation create participant reply attach file share job unread private',permission:'messaging.write',route:'/my-work',path:'Messaging → New group',
  docs:[doc(state,'- My Work and Inbox are participant/private domains.')],ui:[],
  boundary:'Employees can create creator-managed groups, send messages and attachments, and reply within an authorized conversation. Adding a third person to an existing personal DM is not supported: create a separate group; old DM history stays private and is not copied. A native Share Job control or Job card is not verified; missing documentation does not prove absence. Supported ordinary communication is to type the appropriate Job reference as message text, or choose Attach for an authorized file, then choose Send. Creating a group alone does not share a Job. Official TenOps system notices retain separate authority. TenBot does not independently retrieve employee Messaging records.'},
 {id:'notifications',title:'Device notifications and iPhone prerequisites',modules:['messaging','settings'],terms:'notification notifications push iphone ios phone device settings enable safari home screen permission unread delivery',permission:'readOperationalData',route:'/settings',path:'Settings → device notifications',
  docs:[],ui:['src/components/PushNotificationSettings.tsx'],
  boundary:'iPhone Web Push requires the Home Screen app: Safari → Share → Add to Home Screen, then open that installed app before enabling notifications in Settings. Browser/OS permission and a healthy device registration are distinct from guaranteed presentation. Preserve ordinary unread state and account-owned subscriptions.'},
 {id:'intake',title:'Intake Bids, related records and Production handoff',modules:['intake'],terms:'intake bid bids preproduction pre production customer project owner overview tools related records won deposit convert handoff projection timeline proposal sample',permission:'viewIntake',additionalPermissions:['accessIntake','writeBusinessData'],route:'/pre-production',path:'Intake → Bid → Overview / Updates / Files / Tools',
  docs:[doc(manifest,"Chris's October 27 Product reconciliation supersedes")],ui:['src/modules/pre-production/BidTools.tsx'],
  boundary:'The Intake graduation runtime is released. Ordinary Bid activity does not require governing documents or manufacturing inputs. Won plus a recorded deposit is the conversion gate; conversion additionally requires Production Job creation permission. Committed carried/new dates require Production scheduling permission. One Bid creates/links one canonical Production Job; no pseudo Job or automatic Job number is fabricated.'},
 {id:'intake-timeline',title:'Intake projected windows and combined Timeline',modules:['intake','timeline'],terms:'intake bid bids projected tentative window dates planning timeline production combined overlay fit today zoom',permission:'viewIntake',additionalPermissions:['accessIntake','writeBusinessData'],route:'/pre-production',path:'Intake → Timeline / Bid → Projected Production Window',docs:[],ui:['src/modules/pre-production/BidPlanningCard.tsx'],
  boundary:'Intake projected windows and its Timeline are available, distinct from disabled Production Phase/Item Planning. A projected window does not reserve Production capacity or set a Proposal due date. Use Save projected window to persist authorized edits. Production-only combined Timeline is read-only in Intake; committed scheduling belongs to Production.'},
 {id:'material-assessment',title:'Material requirements, supply evidence and lead-time boundaries',modules:['intake','samples','inventory','purchasing'],terms:'material materials requirements estimate lead time times blend sheet supplier package catalog shortage availability stock incoming eta readiness assessment',permission:'viewIntake',additionalPermissions:['readOperationalData','proposal.access'],route:null,path:'',availability:'partial',docs:[],ui:[],contracts:['src/modules/intake-materials/requirements.ts','src/modules/intake-materials/data.ts','src/modules/pre-production/BidWorkspace.tsx','supabase/migrations/20261026110000_bid_accepted_scope.sql'],
  boundary:'Current Bid Inspector does not mount a material-assessment editor or Refresh read-only availability control. A Blend Sheet does not automatically predict supplier delivery or promise a Production date. Other employee-facing estimator controls cannot be verified from these sources; this does not declare every assessment workflow absent. Released retained scope/material services can calculate requirements from exact saved Sample/issued Blend authority and reviewed quantity/unit mappings. Useful supplier/catalog lead-time evidence or documented manual estimates may support assessment; missing evidence remains unknown. Available stock, own-Job reservations, reservations elsewhere, incoming supply and on-hand shortages remain distinct. No stock, reservation, order or material-status mutation occurs through read-only assessment. Formulations and Blend Sheets are authored in Samples; ask Product about an employee-facing assessment workflow.'},
];

// Reviewed prose formerly maintained only in the optional agent overlay. These
// patches retain the existing IDs and permissions and now carry real source pins
// for every consumer of the published registry, including Qwen fallback.
export const refreshes=[{
 ids:['sample-bid','knowledge-sample-bid','knowledge-intake'],release:'bidPreparation',
 sourceFiles:['src/modules/pre-production/BidWorkspace.tsx','src/modules/pre-production/BidTools.tsx','src/modules/samples/queries.ts'],
 appendTerms:'overview bid preparation create proposal sample',
 path:'Intake → Bid → Overview → Bid Preparation',
 guidance:'Open Intake and select the Bid, then open Overview. Bid Preparation contains Create Proposal, Create Sample, Open related Proposals and Open related Samples; there is no Tools tab. Create Sample starts a new canonical Sample in the established generator with this Bid, Customer and Project context. Save the Sample there. Open related Samples opens Bid-context Samples, where Existing standalone Sample → Link Sample links an existing standalone Sample. A Sample linked to another Bid cannot be reassigned by this action. Creating or linking Samples requires the existing Intake, operational-read and business-write permissions. Create Proposal opens the established Proposal Generator with this Bid attached; Proposal access is independently required in addition to Intake and business-write permission. A Proposal can exist and be issued without a Production Job. Existing generated documents retain their historical contents.',
 source:'TenOps released Bid Preparation · October 28, 2026',
},{
 ids:['knowledge-manpower','workflow-manpower-history'],release:'manpower',
 sourceFiles:['src/modules/manpower/ManpowerWorkspace.tsx','src/modules/manpower/group-presentation.ts','src/modules/manpower/progressive-history.ts'],
 appendTerms:'default order sort groups reporting date job name newest alphabetical',
 path:'Manpower Reporting → Sort groups',
 guidance:'Manpower Reporting defaults Sort groups to Reporting date, newest first. Groups with a leading reporting date in their name are ordered by that date, newest first; groups without a valid leading date follow, with creation time, name and ID as stable fallbacks. Editing a Job or labor entry does not move its group by modification time. Groups start collapsed. Rows in an expanded group are ordered by Work Date, newest first. To sort by Job name, use Sort groups → Job name, A–Z. Work date, newest first is the other alternative and uses the latest work date in each group. Mixed-Job groups use their alphabetically first Job or work label; empty groups follow. Sorting applies to loaded complete groups, and the order can change while older groups load. Analytics use the selected period; expanded groups retain complete membership across all dates. Wait for All available history loaded before treating search as exhaustive. Search and Product Category filters change displayed rows and totals without changing saved data. Reporting groups are not Jobs.',
 source:'TenOps released Manpower ordering · October 29, 2026',
}];
