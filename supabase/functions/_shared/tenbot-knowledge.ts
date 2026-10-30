// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports; Next excludes Edge sources.
import {generatedKnowledge,generatedKnowledgePatches,knowledgeSnapshot} from './tenbot-knowledge-snapshot.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports; Next excludes Edge sources.
import {workflowSupplement} from './tenbot-workflow-supplement.ts';
export {knowledgeSnapshot};

// Employee-safe workflow excerpts only. Never import this server registry into the client bundle.
// Release evidence, sourceFiles and examples are internal maintenance checks.
export const snapshot = {
 revision: ['bc628bd',...new Set((generatedKnowledgePatches as unknown as {releaseBoundary?:{revision:string}}[]).flatMap(entry=>entry.releaseBoundary?[entry.releaseBoundary.revision.slice(0,8)]:[])),knowledgeSnapshot.architectureDigest.slice(0,12)].join('+'),
 verifiedAt: (generatedKnowledgePatches as unknown as {releaseBoundary?:{verifiedAt:string}}[]).reduce((date,entry)=>entry.releaseBoundary&&entry.releaseBoundary.verifiedAt>date?entry.releaseBoundary.verifiedAt:date,'2026-10-27'),
 receipt: 'docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026',
};
export type CapabilityEntry = {
 id:string; title:string; modules:string[]; terms:string; requiredTerms:string[][];
 status:'deployed'|'local'|'planned'|'unknown'; availability?:'unavailable'|'partial';
 permission:string; additionalPermissions?:string[]; route:string|null; path:string;
 guidance:string; source:string; evidence:string; sourceFiles:string[]; examples:string[];
 architecture?:KnowledgeArchitecture;
 capabilityAvailability?:{application:'released'|'partial'|'unverified';assistant:'guidance-only'|'read-if-registered'};
 // Maintenance-only: never spread these bindings into employee/model responses.
 relatedRecordIds?:string[]; toolNames?:string[]; recordDigest?:string;
 releaseBoundary?:{id:string;revision:string;verifiedAt:string;receipt:string;receiptKind:string};
};
export type KnowledgeArchitecture={
 entities:string[];
 relationships:{from:string;relation:string;to:string;cardinality?:string}[];
 facts:{text:string;classification:'schema-contract'|'product-convention'|'operational-rule';verification:'repository-contract'|'released-source'}[];
 preconditions:string[];effects:string[];approvalRequirements:string[];limitations:string[];
};
const authoredRegistry:CapabilityEntry[] = [
 {
  "id": "group",
  "modules": [
   "messaging"
  ],
  "title": "Create a group conversation",
  "terms": "group conversation message messaging people chat new start begin make",
  "status": "deployed",
  "permission": "messaging.write",
  "route": "/my-work",
  "path": "Messaging → New group",
  "guidance": "Open Messaging from the app header. Choose New group, enter a group name, select at least one other participant, then choose Create group. Only the creator can rename the group or add/remove participants. Current members share the full history; removed members lose access. Previously signed attachment links may remain usable for up to ten minutes.",
  "source": "Messaging groups and replies · released October 22",
  "evidence": "docs/project-memory/2026-10-22-messaging-groups-replies-candidate.md#executed-release--2026-10-22",
  "requiredTerms": [
   [
    "group"
   ],
   [
    "create",
    "new",
    "start",
    "begin",
    "make",
    "conversation"
   ]
  ],
  "examples": [
   "How do I create a group conversation?",
   "Where do I start a new group chat?",
   "Create a group in Messaging"
  ],
  "sourceFiles": [
   "src/modules/my-work/InboxDialog.tsx",
   "supabase/migrations/20261022120000_messaging_groups_replies.sql"
  ]
 },
 {
  "id": "dm",
  "modules": [
   "messaging"
  ],
  "title": "Add someone to a personal DM",
  "terms": "add someone existing personal dm direct message third person",
  "status": "deployed",
  "permission": "messaging.write",
  "route": "/my-work",
  "path": "Messaging → New group",
  "guidance": "Partially: you can start a new group, but you cannot add a third person to a personal DM. Create a new group instead. The old DM stays private and its history is not copied into the group.",
  "source": "Messaging privacy contract · released October 22",
  "evidence": "docs/project-memory/2026-10-22-messaging-groups-replies-candidate.md#executed-release--2026-10-22",
  "requiredTerms": [
   [
    "dm",
    "direct",
    "personal"
   ],
   [
    "add",
    "third",
    "someone"
   ]
  ],
  "examples": [
   "Can I add someone to an existing personal DM?",
   "Can I add a third person to a direct message?"
  ],
  "sourceFiles": [
   "src/modules/my-work/InboxDialog.tsx",
   "supabase/migrations/20261022120000_messaging_groups_replies.sql"
  ]
 },
 {
  "id": "notifications",
  "modules": [
   "settings",
   "messaging"
  ],
  "title": "Enable phone notifications",
  "terms": "enable notification notifications phone iphone push home screen",
  "status": "deployed",
  "permission": "readOperationalData",
  "route": "/settings",
  "path": "Settings → device notifications",
  "guidance": "On iPhone, open TenOps in Safari, choose Share → Add to Home Screen, then open the Home Screen app. In Settings, find device notifications and choose Enable notifications on this device. Allow the system permission prompt. If permission was denied, allow notifications in iPhone Settings and retry. Device registration does not guarantee that every notification will be presented.",
  "source": "Device notification guide · reliability release October 22",
  "evidence": "docs/project-memory/2026-10-22-web-push-registration-reliability.md#executed-release--october-22-2026",
  "requiredTerms": [
   [
    "notification",
    "notifications",
    "push"
   ],
   [
    "enable",
    "allow",
    "activate",
    "phone",
    "iphone",
    "device"
   ]
  ],
  "examples": [
   "How do I enable iPhone notifications?",
   "How do I enable notifications on my phone?"
  ],
  "sourceFiles": [
   "src/components/PushNotificationSettings.tsx"
  ]
 },
 {
  "id": "recurring",
  "modules": [
   "my-work"
  ],
  "title": "Recurring tasks",
  "terms": "recurring repeat repeating task tasks schedule daily weekly automate automatic automation",
  "status": "unknown",
  "permission": "readOperationalData",
  "route": null,
  "path": "",
  "guidance": "The TenOps Guide does not have enough verified information to confirm recurring tasks. This does not mean the feature is unavailable. Please check with Product.",
  "source": "Deployed capability review · October 27",
  "evidence": "docs/project-memory/2026-10-27-tenbot-candidate.md",
  "requiredTerms": [
   [
    "recurring",
    "repeat",
    "repeating",
    "weekly",
    "daily"
   ],
   [
    "task",
    "tasks"
   ]
  ],
  "examples": [
   "Can I set a recurring task?"
  ],
  "sourceFiles": []
 },
 {
  "id": "share-job",
  "modules": [
   "messaging"
  ],
  "title": "Share a Job in a message",
  "terms": "share job message link send",
  "status": "unknown",
  "permission": "messaging.write",
  "route": null,
  "path": "",
  "guidance": "I cannot verify a native Share Job control or Job card in Messaging. This is a documentation limit, not proof that the feature is absent. Ordinary text and attachments are supported in conversations you are authorized to access: type the appropriate Job reference as message text, or choose Attach for a file you are allowed to share, then choose Send. Creating a group by itself does not share a Job. TenBot does not independently retrieve private Job records. You may explicitly submit text for your own answer; the configured AI provider processes that text.",
  "source": "Messaging capability review · October 27",
  "evidence": "docs/project-memory/2026-10-22-messaging-groups-replies-candidate.md#executed-release--2026-10-22",
  "requiredTerms": [
   [
    "job",
    "jobs"
   ],
   [
    "message",
    "messages",
    "messaging",
    "chat",
    "dm"
   ],
   [
    "share",
    "send",
    "link"
   ]
  ],
  "examples": [
   "Can I share a Job inside a message?"
  ],
  "sourceFiles": [
   "src/modules/my-work/InboxDialog.tsx",
   "src/modules/my-work/messaging/useAttachmentQueue.ts",
   "supabase/migrations/20261022120000_messaging_groups_replies.sql",
   "supabase/migrations/20261005120000_read_only_messaging_write.sql"
  ]
 },
 {
  "id": "sample-bid",
  "modules": [
   "intake",
   "samples"
  ],
  "title": "Attach a Sample to a Bid",
  "terms": "attach link sample bid samples",
  "status": "deployed",
  "permission": "viewIntake",
  "route": "/pre-production",
  "path": "Intake → Bid → Tools → Open related Samples → Existing standalone Sample → Link Sample",
  "guidance": "Open Intake and select the Bid. In Tools, choose Open related Samples. In Bid-context Samples, choose an Existing standalone Sample, then Link Sample. A Sample already linked to another Bid cannot be moved by this action. To make a new Sample instead, choose Create Sample in the Bid’s Tools; the established generator retains Bid, Customer and Project context, then save the Sample. The Sample editor also provides Bid context when saving a draft. Existing generated documents are not changed by linking. Existing Intake-management, operational-read and business-write permissions are required.",
  "source": "TenOps Samples and Intake · deployed October 27",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
  "requiredTerms": [
   [
    "sample",
    "samples"
   ],
   [
    "bid",
    "bids"
   ],
   [
    "attach",
    "link"
   ]
  ],
  "examples": [
   "How do I attach a Sample to a Bid?"
  ],
  "sourceFiles": [
   "src/modules/pre-production/BidTools.tsx",
   "src/modules/samples/SampleWorkspace.tsx",
   "src/modules/samples/queries.ts",
   "supabase/migrations/20260923215900_intake_early_access.sql",
   "supabase/migrations/20261005120000_read_only_messaging_write.sql"
  ],
  "additionalPermissions": [
   "accessIntake",
   "readOperationalData",
   "writeBusinessData"
  ]
 },
 {
  "id": "customer-history",
  "modules": [
   "contacts"
  ],
  "title": "Find a customer’s previous Jobs",
  "terms": "customer previous jobs history contacts customers find search view past linked",
  "status": "deployed",
  "permission": "readOperationalData",
  "route": "/contacts",
  "path": "Contacts → Search customers → Linked Jobs → select a Job",
  "guidance": "Open Contacts and search for the beginning of the customer’s company name. Choose Linked Jobs beside that customer, then select a Job to open it. This shows only visible Production Jobs linked to that directory customer. Historical customer text and Bid names do not establish a link; Proposal customer details are independent snapshots. Saved directory changes affect future selections; existing Jobs and issued Proposals keep their captured information.",
  "source": "Contacts guide · deployed release verified October 22",
  "evidence": "docs/project-memory/2026-10-22-web-push-registration-reliability.md#executed-release--october-22-2026",
  "requiredTerms": [
   [
    "customer",
    "customers",
    "contact",
    "contacts"
   ],
   [
    "job",
    "jobs",
    "history"
   ],
   [
    "find",
    "search",
    "view",
    "previous",
    "history",
    "past",
    "linked"
   ]
  ],
  "examples": [
   "How do I find an existing customer's Jobs?",
   "How do I find a customer’s Production Jobs?",
   "Where do I find a customer’s previous jobs?"
  ],
  "sourceFiles": [
   "src/modules/production/contacts/ContactsWorkspace.tsx",
   "src/modules/production/contacts/queries.ts",
   "src/modules/production/contacts/CustomerInspector.tsx"
  ]
 },
 {
  "id": "customer-edit",
  "modules": [
   "contacts"
  ],
  "title": "Edit a saved customer’s details",
  "terms": "edit update change correct modify saved customer customers details contact contacts company name phone email address",
  "requiredTerms": [
   [
    "customer",
    "customers",
    "contact",
    "contacts",
    "company"
   ],
   [
    "edit",
    "update",
    "change",
    "correct",
    "modify"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "additionalPermissions": [
   "editProductionJobDetails"
  ],
  "route": "/contacts",
  "path": "Toolbox → Resources → Contacts → Search customers → customer name → Customer Inspector → Save Changes",
  "guidance": "Open Toolbox → Resources → Contacts. Search for the beginning of the customer’s company name, then select the company name to open Customer Inspector. Edit Customer / Company Name, or expand Additional Information (Optional) to edit Contact Name, Phone Number or Email Address. Choose Save Changes. Lead/Admin access is required to edit a saved customer; read-only accounts cannot save changes. Saved changes apply to future selections. Existing Jobs and Proposals keep their captured information.",
  "source": "Contacts guide · released October 20",
  "evidence": "docs/project-memory/2026-10-20-contacts-release.md",
  "examples": [
   "how do i edit a saved customers details",
   "How do I change a customer phone number in Contacts?"
  ],
  "sourceFiles": [
   "src/modules/production/contacts/CustomerInspector.tsx",
   "src/modules/production/contacts/ContactsWorkspace.tsx",
   "supabase/migrations/20261014190000_production_contact_configuration.sql"
  ]
 },
 {
  "id": "material-lead",
  "modules": [
   "intake",
   "inventory",
   "samples"
  ],
  "title": "Material requirements and lead-time guidance",
  "terms": "estimate material lead time times blend sheet inventory readiness accepted scope requirements intake",
  "status": "deployed",
  "permission": "viewIntake",
  "route": null,
  "path": "",
  "guidance": "The current Bid Inspector does not expose a material lead-time estimator. A Blend Sheet does not automatically predict supplier delivery or promise a Production date. I cannot verify another employee-facing estimator from these sources. Released retained assessment services can combine exact saved Sample or issued Blend authority, reviewed Inventory mappings, catalog supplier evidence and documented manual lead-time estimates; that backend capability does not establish a UI workflow. Supplier/catalog lead-time information and documented manual estimates are useful evidence, while missing evidence stays unknown. On-hand stock, reservations, incoming ETAs and shortages remain distinct; incoming supply is not on-hand stock. Assessment does not create reservations, orders or stock changes. Ask Product about the employee-facing assessment workflow.",
  "source": "TenOps material assessment boundaries · deployed October 27",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
  "requiredTerms": [
   [
    "material",
    "materials",
    "lead",
    "blend"
   ],
   [
    "estimate",
    "lead",
    "requirements",
    "readiness",
    "time",
    "times"
   ]
  ],
  "examples": [
   "Can I estimate lead times from a Blend Sheet?"
  ],
  "sourceFiles": [
   "src/modules/intake-materials/requirements.ts",
   "src/modules/intake-materials/data.ts",
   "src/modules/pre-production/BidWorkspace.tsx",
   "supabase/migrations/20261026110000_bid_accepted_scope.sql"
  ],
  "availability": "partial",
  "additionalPermissions": [
   "readOperationalData",
   "proposal.access"
  ]
 },
 {
  "id": "intake-future",
  "modules": [
   "intake",
   "samples"
  ],
  "title": "Further Intake intelligence",
  "terms": "automatic supplier prediction historical sample intelligence forecast",
  "status": "planned",
  "permission": "viewIntake",
  "route": null,
  "path": "",
  "guidance": "Further Intake intelligence is planned or deferred; I cannot describe it as available. A feature suggestion can capture the problem and desired behavior.",
  "source": "Intake deferred boundaries",
  "evidence": "docs/project-memory/OPEN_QUESTIONS.md",
  "requiredTerms": [
   [
    "supplier",
    "sample",
    "intake"
   ],
   [
    "automatic",
    "prediction",
    "predict",
    "forecast",
    "intelligence"
   ]
  ],
  "examples": [
   "Can I use automatic supplier prediction and forecasting?"
  ],
  "sourceFiles": []
 },
 {
  "id": "production-find-job",
  "title": "Find a Production Job",
  "modules": [
   "production"
  ],
  "terms": "find search locate open view existing saved job jobs project projects production archived archive filters filter",
  "requiredTerms": [
   [
    "job",
    "jobs",
    "project",
    "projects"
   ],
   [
    "find",
    "search",
    "locate",
    "open",
    "view",
    "filter"
   ]
  ],
  "status": "deployed",
  "permission": "readOperationalData",
  "route": "/production",
  "path": "Production → Production Pipeline → Search jobs → select a Job",
  "guidance": "Authorized operational readers can find the same Production Jobs in Overview, Table or Timeline. Open Production → Production Pipeline and use Search jobs. Search matches project name, customer, Job number, estimate number, work order, color plate and remarks. Select a Job to open its Inspector. Filters can restrict Scheduled/Unscheduled and Production Status; business writers can use Include Archived when looking for archived Jobs. Read-only accounts can search the current visible list. Search and filters change the displayed Jobs, not their saved records.",
  "source": "Production Job guide",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
  "sourceFiles": [
   "src/modules/production/ProductionWorkspace.tsx"
  ],
  "examples": [
   "How do I find a Job in Production?",
   "Where can I search for an archived Production project?",
   "How do I open an existing Job?"
  ]
 },
 {
  "id": "production-create-job",
  "title": "Create a Production Job",
  "modules": [
   "production"
  ],
  "terms": "create add new start blank job jobs project projects production name",
  "requiredTerms": [
   [
    "job",
    "jobs",
    "project",
    "projects"
   ],
   [
    "create",
    "add",
    "new",
    "blank"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "additionalPermissions": ["createProductionJob"],
  "route": "/production",
  "path": "Production → New Job → Create Blank Job → Create Job",
  "guidance": "Authorized business writers can create a canonical Production Job. Open Production → New Job → Create Blank Job. Enter Project name, add available Job information, then choose Create Job. Project name is required; other identifiers can be added later. A Job number cannot duplicate an existing Job. Saved customer/contact selections require the existing Production contact-edit permission. Planned dates use the separate staged scheduling workflow; creating the Job does not save a proposed schedule.",
  "source": "Production Job creation guide",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
  "sourceFiles": [
   "src/modules/production/components/ProductionJobCreator.tsx",
   "src/modules/production/ProductionWorkspace.tsx",
   "src/modules/production/jobs.ts",
   "supabase/migrations/20261014222000_preserve_archived_project_contact_refresh.sql"
  ],
  "examples": [
   "How do I create a Production Job?",
   "Can I add a blank Job without a Job number?",
   "Where do I enter a new Production project?"
  ]
 },
 {
  "id": "production-schedule",
  "title": "Schedule or reschedule a Production Job",
  "modules": [
   "production"
  ],
  "terms": "schedule reschedule scheduling planned start finish dates timeline move resize job jobs production save review discard",
  "requiredTerms": [
   [
    "job",
    "jobs",
    "production",
    "timeline"
   ],
   [
    "schedule",
    "reschedule",
    "scheduling",
    "dates",
    "planned",
    "resize"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "route": "/production",
  "path": "Production → Job → Details → Planned start / Planned finish → Review changes → Save all changes",
  "guidance": "Authorized business writers can stage Production schedules. Open a Job and enter both Planned start and Planned finish in Details, or adjust its bar in Timeline. Review changes, then choose Save all changes. Editing dates or releasing a Timeline drag stages the proposal without saving it. Finish must be on or after start. Save ordinary Inspector details first if prompted. Red scheduling errors block saving; warnings do not. Discard all restores the saved dates. A stale or failed save retains proposals for review rather than silently replacing them.",
  "source": "Production scheduling guide",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
  "sourceFiles": [
   "src/modules/production/ProductionWorkspace.tsx",
   "src/modules/production/components/ProductionJobInspector.tsx",
   "src/modules/production/components/ScheduleReviewDialog.tsx",
   "src/modules/production/schedule-staging.ts",
   "src/modules/production/schedule-batch-contract.ts"
  ],
  "examples": [
   "How do I schedule a Job in Production?",
   "Can I reschedule a Production Job on the Timeline?",
   "Why are my Production planned dates still pending?"
  ]
 },
 {
  "id": "production-rework-create",
  "title": "Initiate Job Rework",
  "modules": [
   "production",
   "rework"
  ],
  "terms": "initiate create start begin add rework job jobs complete completed reason scope return production",
  "requiredTerms": [
   [
    "rework"
   ],
   [
    "initiate",
    "create",
    "start",
    "begin",
    "add"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "route": "/production",
  "path": "Production → completed Job → Create Rework → Create Rework",
  "guidance": "Authorized business writers can create Rework for a completed Production Job. Open the Job in Production and select Create Rework. Choose a Reason, describe Rework Scope / Work Required, enter Intake / Return Date, then select Create Rework. The Job must be complete, unarchived and have no active Rework cycle. Only one Rework cycle can be active at a time. Rework remains on the same canonical Job and preserves original Production status and dates. Scope is a whole-Job description, not structured piece or Color Plate tracking.",
  "source": "Job Rework guide",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
  "sourceFiles": [
   "src/modules/production/components/ReworkQuickAction.tsx",
   "src/modules/production/components/CreateReworkDialog.tsx",
   "src/modules/production/components/ProductionJobInspector.tsx",
   "src/modules/production/rework.ts",
   "supabase/migrations/20260817_003_production_rework_cycles.sql",
   "docs/architecture/production-rework.md"
  ],
  "examples": [
   "how do i initiate a rework for a job?",
   "How do I create Rework for a completed Job?",
   "Can I start another Rework cycle on a Job?"
  ]
 },
 {
  "id": "production-rework-status",
  "title": "Complete or cancel Job Rework",
  "modules": [
   "production",
   "rework"
  ],
  "terms": "rework complete finish cancel cancelled status update change job production lifecycle",
  "requiredTerms": [
   [
    "rework"
   ],
   [
    "complete",
    "finish",
    "cancel",
    "cancelled",
    "status"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "route": "/production",
  "path": "Production → active Rework Job → Details → Production status → Save changes",
  "guidance": "Authorized business writers can update the active Rework lifecycle. Open its Job in Production, open Details, change Production status to Complete or Cancelled, then choose Save changes. Save other Job-detail changes separately before changing Rework status. This updates the active Rework cycle, not the original Production lifecycle. Completed or cancelled Rework is historical and cannot be changed. Existing Rework history remains attached to the same Job.",
  "source": "Job Rework lifecycle guide",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
  "sourceFiles": [
   "src/modules/production/components/ProductionJobInspector.tsx",
   "src/modules/production/jobs.ts",
   "src/modules/production/status-visuals.ts",
   "supabase/migrations/20260817_003_production_rework_cycles.sql"
  ],
  "examples": [
   "How do I complete a Rework?",
   "Can I cancel an active Job Rework?",
   "How do I change Rework status?"
  ]
 },
 {
  "id": "production-files",
  "title": "Attach supporting files to a Production Job",
  "modules": [
   "production"
  ],
  "terms": "attach upload add file files attachment attachments document documents photo photos job jobs production",
  "requiredTerms": [
   [
    "job",
    "jobs",
    "production"
   ],
   [
    "file",
    "files",
    "document",
    "documents",
    "photo",
    "photos",
    "attachment",
    "attachments"
   ],
   [
    "attach",
    "upload",
    "add",
    "open",
    "view"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "route": "/production",
  "path": "Production → Job → Files → Document type → Add Attachment",
  "guidance": "Authorized business writers can attach supporting files to a Production Job. Open the Job → Files, choose Document type, select Add Attachment and choose one or more files. Select an attached file's name to open it. Files belong to the Job and retain existing private-storage access rules. Removing a file asks for confirmation. Uploading or opening a Job attachment does not send its contents to TenBot.",
  "source": "Production Job files guide",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
  "sourceFiles": [
   "src/modules/production/components/ProductionJobInspector.tsx",
   "src/modules/production/jobs.ts",
   "supabase/migrations/20261005120000_read_only_messaging_write.sql"
  ],
  "examples": [
   "How do I upload files to a Production Job?",
   "Where can I attach a photo to a Job?",
   "How do I add supporting documents to a Job?"
  ]
 },
 {
  "id": "planning-phase",
  "title": "Planning Phases",
  "modules": [
   "production",
   "planning"
  ],
  "terms": "planning phase phases create add coordination overlay pause library",
  "requiredTerms": [
   [
    "planning",
    "phase",
    "phases"
   ],
   [
    "phase",
    "phases",
    "overlay",
    "pause",
    "coordination"
   ]
  ],
  "status": "deployed",
  "permission": "readOperationalData",
  "route": null,
  "path": "",
  "guidance": "Planning Phases and Items support Job coordination, but Planning is not enabled in the verified Production application. Its tab and Timeline overlays are unavailable in that deployment. I cannot give live navigation steps for these controls. Please check with Product before relying on a Planning workflow.",
  "source": "Planning deployment availability",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
  "sourceFiles": [
   "src/modules/production/ProductionWorkspace.tsx",
   "src/modules/production/components/ProductionJobInspector.tsx",
   "src/modules/planning/timeline-model.mjs",
   "src/modules/planning/PlanningPanel.tsx",
   "src/modules/planning/PlanningPhaseEditor.tsx",
   "src/modules/planning/data.ts"
  ],
  "examples": [
   "How do I add a Planning Phase?",
   "Can I create a Pause in Planning?",
   "Where are Planning Phases?"
  ],
  "availability": "unavailable"
 },
 {
  "id": "planning-items",
  "title": "Planning Items and Execution Progress",
  "modules": [
   "production",
   "planning"
  ],
  "terms": "planning item items progress execution complete completion estimated hours checkpoint checkpoints",
  "requiredTerms": [
   [
    "planning"
   ],
   [
    "item",
    "items",
    "progress",
    "checkpoint",
    "checkpoints"
   ]
  ],
  "status": "deployed",
  "permission": "readOperationalData",
  "route": null,
  "path": "",
  "guidance": "Planning Phases and Items support Job coordination, but Planning is not enabled in the verified Production application. Its tab and Timeline overlays are unavailable in that deployment. I cannot give live navigation steps for these controls. Please check with Product before relying on a Planning workflow.",
  "source": "Planning deployment availability",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
  "sourceFiles": [
   "src/modules/planning/timeline-model.mjs",
   "src/modules/planning/PlanningPanel.tsx",
   "src/modules/planning/PlanningItemEditor.tsx",
   "src/modules/planning/progress.mjs"
  ],
  "examples": [
   "How do I add an Item in Planning?",
   "Can I mark Planning Items complete?",
   "What does Planning Execution Progress mean?"
  ],
  "availability": "unavailable"
 },
 {
  "id": "manpower-job-filter",
  "title": "Filter Manpower Reporting by Job",
  "modules": [
   "manpower"
  ],
  "terms": "manpower reporting labor labour job jobs filter filtering review show search product category period history",
  "requiredTerms": [
   [
    "manpower",
    "labor",
    "labour"
   ],
   [
    "job",
    "jobs"
   ],
   [
    "filter",
    "filtering",
    "review",
    "show",
    "find",
    "search",
    "select",
    "choose"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "route": "/manpower-reporting",
  "path": "Reporting → Manpower Reporting → Job labor review",
  "guidance": "Employees with business-write access can filter labor by Production Job. Open Reporting → Manpower Reporting, then choose the Job in Job labor review. Use Clear job filter or All reporting groups to reset. After selecting a Job, Product Category filter narrows products. Analytics use the selected reporting period; reporting rows are loaded complete groups with all their dates. Search and filters are not exhaustive until all available history is loaded. Read-only accounts cannot change the current Job labor review selector, but can use Search manpower or open a Job’s Current Hours link from Production.",
  "source": "Manpower Reporting guide · released workflow verified October 27",
  "sourceFiles": [
   "src/modules/manpower/ManpowerWorkspace.tsx",
   "src/components/BusinessWriteControls.tsx",
   "src/modules/manpower/manpower.ts",
   "src/app/client-layout-shell.tsx",
   "docs/project-memory/2026-10-20-manpower-progressive-release.md"
  ],
  "examples": [
   "how do i filter by jobs in manpower reporting",
   "How can I review manpower labor for one Job?",
   "Show labor by Job and Product Category in Manpower Reporting"
  ],
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026"
 },
 {
  "id": "manpower-record-labor",
  "title": "Record labor in Manpower Reporting",
  "modules": [
   "manpower"
  ],
  "terms": "manpower reporting labor labour record recording add adding enter hours time group groups new entry entries worker task product category",
  "requiredTerms": [
   [
    "manpower",
    "labor",
    "labour"
   ],
   [
    "record",
    "recording",
    "add",
    "adding",
    "enter",
    "create",
    "new"
   ],
   [
    "hours",
    "time",
    "group",
    "groups",
    "entry",
    "entries",
    "labor",
    "labour"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "route": "/manpower-reporting",
  "path": "Reporting → Manpower Reporting → New Group or Add New Line → Add Entry",
  "guidance": "Employees with business-write access can record labor. Open Reporting → Manpower Reporting. Clear search, Job and product filters before creating an empty group. Choose New Group, name it and Create, or expand an existing group and choose Add New Line. Complete work date, active Product Category, Worker, Task, Job or temporary work label, and AM/PM hours, then Add Entry. Hours must be nonnegative and total no more than 24 per entry. Split hours into separate lines for different products. A temporary work label is not a Production Job link; its hours do not appear in Production until linked. Clear filters before changing a whole group’s Job.",
  "source": "Manpower Reporting guide · released workflow verified October 27",
  "sourceFiles": [
   "src/modules/manpower/ManpowerWorkspace.tsx",
   "src/modules/manpower/product-reporting.ts",
   "src/modules/manpower/work-target.ts",
   "src/components/BusinessWriteControls.tsx",
   "src/lib/rbac.ts",
   "docs/project-memory/2026-10-20-manpower-progressive-release.md"
  ],
  "examples": [
   "How do I record labor hours in Manpower Reporting?",
   "How can I create a new manpower reporting group?",
   "How do I add a labor entry for a worker?"
  ],
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026"
 },
 {
  "id": "inventory-stock-search",
  "title": "Find current Inventory stock and lots",
  "modules": [
   "inventory"
  ],
  "terms": "inventory stock material materials lot lots search searching find check look view show quantity quantities location pallet reservation current",
  "requiredTerms": [
   [
    "inventory",
    "stock",
    "lot",
    "lots"
   ],
   [
    "search",
    "searching",
    "find",
    "check",
    "look",
    "view",
    "show",
    "locate"
   ]
  ],
  "status": "deployed",
  "permission": "readOperationalData",
  "route": "/inventory",
  "path": "Inventory → Current Inventory → Search current stock",
  "guidance": "Employees with operational-read access can review current stock. Open Inventory → Current Inventory and use Search current stock. Search vendor, material, size, category, quantity, unit, location, pallet, reservation or notes. Open a material group to inspect its details. If it contains several lots, select the individual lot. The table shows a combined total; selected-lot details and stock movements affect that lot. Job-reserved, temporary-reserved and general stock remain separate identities. This view shows current stock, not a promise of future material availability.",
  "source": "Inventory guide · released workflow verified October 27",
  "sourceFiles": [
   "src/app/inventory/page.tsx",
   "src/modules/inventory/retrieval.ts",
   "src/app/client-layout-shell.tsx",
   "src/lib/rbac.ts",
   "docs/project-memory/2026-10-19-manpower-inventory-wave4.md"
  ],
  "examples": [
   "How do I find material in Inventory?",
   "How can I check stock quantities and pallet locations?",
   "Where can I view Inventory lots and reservations?"
  ],
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026"
 },
 {
  "id": "inventory-pending-create",
  "title": "Add or edit a Pending Receival",
  "modules": [
   "inventory"
  ],
  "terms": "inventory pending receival receivals incoming expected material materials order eta create add edit update record",
  "requiredTerms": [
   [
    "pending",
    "receival",
    "receivals",
    "incoming"
   ],
   [
    "create",
    "add",
    "edit",
    "update",
    "record",
    "recording",
    "enter"
   ]
  ],
  "status": "deployed",
  "permission": "adjustInventory",
  "additionalPermissions": [
   "writeBusinessData"
  ],
  "route": "/inventory",
  "path": "Inventory → Pending Receivals → + Pending Receival → Add Pending Receivals",
  "guidance": "Employees with Inventory-adjustment and business-write access can record expected incoming material. Open Inventory → Pending Receivals, expand the section and choose + Pending Receival. Enter Vendor, Ordered By, Order Date, and at least one material line with a positive expected quantity. Add optional ETA, location, pallet or notes. For a reservation, select either an existing Production Job or a temporary work label. Choose Add Pending Receivals. Existing pending rows offer Edit and Save Changes. Expected quantity cannot be reduced below the amount already received. Pending Receivals record expectations only; material enters on-hand Inventory when someone receives it.",
  "source": "Inventory guide · released workflow verified October 27",
  "sourceFiles": [
   "src/app/inventory/page.tsx",
   "src/components/BusinessWriteControls.tsx",
   "src/lib/rbac.ts",
   "supabase/migrations/20260824_001_pending_receival_rbac_enforcement.sql",
   "supabase/migrations/20260923160200_partial_pending_receipts.sql"
  ],
  "examples": [
   "How do I add a pending receival in Inventory?",
   "How can I record incoming material before delivery?",
   "How do I edit the expected quantity of a pending receival?"
  ],
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026"
 },
 {
  "id": "inventory-pending-receive",
  "title": "Receive pending material into Inventory",
  "modules": [
   "inventory"
  ],
  "terms": "inventory pending receival receivals incoming delivery deliveries receive receiving received receipt partial quantity remaining",
  "requiredTerms": [
   [
    "pending",
    "receival",
    "receivals",
    "incoming",
    "delivery",
    "deliveries"
   ],
   [
    "receive",
    "receiving",
    "received",
    "receipt",
    "partial"
   ]
  ],
  "status": "deployed",
  "permission": "receiveInventory",
  "additionalPermissions": [
   "writeBusinessData"
  ],
  "route": "/inventory",
  "path": "Inventory → Pending Receivals → Receive → Confirm Receive",
  "guidance": "Employees with Inventory-receiving and business-write access can receive incoming material. Open Inventory → Pending Receivals, expand the section and choose Receive on an outstanding line. Enter Received By and Quantity received now, then Confirm Receive. Quantity must be positive and no greater than the remaining amount. Only that quantity enters Inventory; the balance stays pending and the existing reservation carries through. If the result is uncertain, keep the dialog open and retry the same quantity there. Receive selected receives the full remaining quantities of selected rows. Undo latest receipt is a separate Inventory-adjustment action and is blocked if the received stock changed.",
  "source": "Inventory guide · released workflow verified October 27",
  "sourceFiles": [
   "src/app/inventory/page.tsx",
   "src/components/BusinessWriteControls.tsx",
   "src/lib/rbac.ts",
   "supabase/migrations/20260824_001_pending_receival_rbac_enforcement.sql",
   "supabase/migrations/20260923160200_partial_pending_receipts.sql"
  ],
  "examples": [
   "How do I receive a pending receival into Inventory?",
   "Can I receive only part of an incoming material delivery?",
   "How does Receive selected work for pending receivals?"
  ],
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026"
 },
 {
  "id": "inventory-stock-reservation",
  "title": "Reserve Inventory stock or return it to general stock",
  "modules": [
   "inventory"
  ],
  "terms": "inventory stock lot lots reserve reserving reservation reservations earmark earmarked allocate allocating release releasing return general job temporary label quantity",
  "requiredTerms": [
   [
    "inventory",
    "stock",
    "lot",
    "lots"
   ],
   [
    "reserve",
    "reserving",
    "earmark",
    "earmarked",
    "allocate",
    "allocating",
    "release",
    "releasing",
    "return"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "route": "/inventory",
  "path": "Inventory → Current Inventory → material group → selected lot → Reservation → Save Details",
  "guidance": "Employees with business-write access can reserve stock. Open Inventory → Current Inventory, open a material group and select its lot. Enter Your Name, set Reservation to Production job or Temporary / unlisted job, choose the Job or enter a label, and enter a positive Reservation Quantity no greater than that lot, or reserve the entire lot. Save Details. A partial reservation creates a separate reserved lot; a temporary label is not a canonical Job link. To release, enter Your Name, choose No reservation and Save Details. Selected reserved lots also offer Return to General Stock. Compatible general lots may merge. Save material-identity corrections separately before splitting or releasing a reservation.",
  "source": "Inventory guide · released workflow verified October 27",
  "sourceFiles": [
   "src/app/inventory/page.tsx",
   "src/components/BusinessWriteControls.tsx",
   "src/lib/rbac.ts",
   "supabase/migrations/20260721_001_atomic_inventory_reservations.sql"
  ],
  "examples": [
   "How do I reserve Inventory stock for a Job?",
   "Can I reserve part of an Inventory lot with a temporary work label?",
   "How do I return reserved stock to general stock?"
  ],
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026"
 },
 {
  "id": "inventory-stock-movement",
  "title": "Record Inventory stock intake or outtake",
  "modules": [
   "inventory"
  ],
  "terms": "inventory stock lot lots record recording intake outtake movement movements add adding remove removing quantity material lines",
  "requiredTerms": [
   [
    "inventory",
    "stock",
    "lot",
    "lots"
   ],
   [
    "record",
    "recording",
    "intake",
    "outtake",
    "movement",
    "movements",
    "add",
    "adding",
    "remove",
    "removing"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "route": "/inventory",
  "path": "Inventory → Current Inventory → Record Stock → Intake or Outtake → Record Intake Lines or Record Outtake Lines",
  "guidance": "Employees with business-write access can record stock movements. Open Inventory → Current Inventory → Record Stock. Choose Intake or Outtake, enter Your Name and material lines with positive quantities, units and matching lot details, then Record Intake Lines or Record Outtake Lines. Intake adds to a matching lot or creates one; Outtake draws from matching lots and cannot exceed available matching stock. Each line updates Inventory immediately and creates an Activity transaction. For one lot, open its material group, select the lot, use Stock Movement, enter quantity and optional Reason / Note, then Record Intake or Record Outtake. Inventory Intake means a stock movement, not the Pre-Production Intake workspace.",
  "source": "Inventory guide · released workflow verified October 27",
  "sourceFiles": [
   "src/app/inventory/page.tsx",
   "src/components/BusinessWriteControls.tsx",
   "src/lib/rbac.ts"
  ],
  "examples": [
   "How do I record an intake in Inventory?",
   "How can I remove stock using Inventory outtake?",
   "How do I add multiple stock lines in Inventory?"
  ],
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026"
 },
 {
  "id": "inventory-activity",
  "title": "Review Inventory transaction history",
  "modules": [
   "inventory"
  ],
  "terms": "inventory activity ledger transaction transactions history review view search searching find filter filtering audit intake outtake adjustment",
  "requiredTerms": [
   [
    "activity",
    "ledger",
    "transaction",
    "transactions"
   ],
   [
    "review",
    "view",
    "search",
    "searching",
    "find",
    "filter",
    "filtering",
    "audit",
    "history",
    "open",
    "where"
   ]
  ],
  "status": "deployed",
  "permission": "readOperationalData",
  "route": "/activity",
  "path": "Inventory → Inventory Activity → Search Inventory Activity",
  "guidance": "Employees with operational-read access can review the Inventory transaction ledger. Open Inventory → Inventory Activity. Use Search Inventory Activity to find a transaction by material, vendor, size, quantity, unit, location, reservation or notes. Use Show → All, Intake, Outtake or Adjustment to filter transaction types. Open a transaction row for its details. Activity is a read-only history view; it does not perform a new stock movement. Current on-hand quantities and selected-lot actions are in Current Inventory.",
  "source": "Inventory guide · released workflow verified October 27",
  "sourceFiles": [
   "src/app/activity/page.tsx",
   "src/modules/inventory/retrieval.ts",
   "src/app/client-layout-shell.tsx",
   "src/lib/rbac.ts",
   "docs/project-memory/2026-10-19-manpower-inventory-wave4.md"
  ],
  "examples": [
   "How do I review Inventory Activity history?",
   "Where can I find old Inventory transactions?",
   "How can I filter Inventory Activity to outtakes?"
  ],
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026"
 },
 {
  "id": "sample-save",
  "title": "Create and save a Sample formula",
  "modules": [
   "samples"
  ],
  "terms": "sample samples formula formulation create new edit update save saved draft changes resin system",
  "requiredTerms": [
   [
    "sample",
    "samples",
    "formula",
    "formulation"
   ],
   [
    "create",
    "new",
    "edit",
    "update",
    "save",
    "saved",
    "draft"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "additionalPermissions": [
   "readOperationalData"
  ],
  "route": "/samples",
  "path": "Toolbox → Tools → Sample Form Generator → New Sample → Save Sample",
  "guidance": "Employees with operational access and business-write permission can build and save a working Sample formula without requiring a Production Job. Open Toolbox → Tools → Sample Form Generator and choose New Sample. Select a Resin System in Formulation setup, review and apply the configured profile when prompted, and complete the Sample and formulation details. Choose Save Sample; an existing draft uses Save Changes. Resolve resin-identity conflicts before saving. Suggested Color Plate numbers are assigned when saved; unusual or conflicting identifiers require review. Saving a draft does not generate a Sample Work Order.",
  "source": "Samples workflow guide · deployed application",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md",
  "sourceFiles": [
   "src/components/ToolboxLauncher.tsx",
   "src/modules/samples/SampleWorkspace.tsx",
   "src/modules/samples/SampleResinSystemSelector.tsx",
   "supabase/migrations/20261006190000_sample_color_plate_allocation.sql",
   "supabase/migrations/20261005120000_read_only_messaging_write.sql"
  ],
  "examples": [
   "How do I create a Sample?",
   "How do I save a Sample formula?",
   "Can I edit an existing Sample draft?"
  ]
 },
 {
  "id": "sample-work-order",
  "title": "Generate a Sample Work Order or retry its PDF",
  "modules": [
   "samples"
  ],
  "terms": "sample samples work order generate issue issued print pdf retry document documents prepared quantities",
  "requiredTerms": [
   [
    "sample",
    "samples"
   ],
   [
    "generate",
    "issue",
    "issued",
    "print",
    "pdf",
    "retry",
    "order"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "additionalPermissions": [
   "readOperationalData"
  ],
  "route": "/samples",
  "path": "Toolbox → Tools → Sample Form Generator → open Sample → Generate Sample Work Order",
  "guidance": "Employees with operational access and business-write permission can generate a Sample Work Order. Open the Sample in Toolbox → Tools → Sample Form Generator. Confirm Prepared By, review the Resin System, preparation quantities and validation messages, then choose Generate Sample Work Order. This saves current changes and captures an issued document before generating its PDF. Complete the required preparation components and reconcile the aggregate blend; draft saving and document generation have different requirements. If document capture succeeds but its PDF fails, use Retry PDF on that existing entry under Sample Work Orders instead of generating another issued document. Ready PDFs use View.",
  "source": "Sample Work Order guide · deployed application",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md",
  "sourceFiles": [
   "src/components/ToolboxLauncher.tsx",
   "src/modules/samples/SampleWorkspace.tsx",
   "src/modules/samples/sample-errors.ts",
   "src/modules/samples/sample-validation-view.ts",
   "supabase/migrations/20261001010000_sample_batch_first_authority.sql",
   "supabase/migrations/20261005120000_read_only_messaging_write.sql"
  ],
  "examples": [
   "How do I generate a Sample Work Order?",
   "How do I retry a failed Sample PDF?",
   "What do I need before printing a Sample Work Order?"
  ]
 },
 {
  "id": "proposal-create",
  "title": "Create, save and preview a Proposal draft",
  "modules": [
   "proposals"
  ],
  "terms": "proposal proposals create new draft save preview estimate customer document generator",
  "requiredTerms": [
   [
    "proposal",
    "proposals"
   ],
   [
    "create",
    "new",
    "draft",
    "save",
    "preview"
   ]
  ],
  "status": "deployed",
  "permission": "proposal.access",
  "additionalPermissions": [
   "writeBusinessData"
  ],
  "route": "/proposals",
  "path": "Toolbox → Tools → Proposal Generator → Create Proposal",
  "guidance": "Active administrators and accounts explicitly granted Proposal access can create drafts if they also have business-write permission. A Proposal can exist independently of a Production Job. Open Toolbox → Tools → Proposal Generator and choose Create Proposal. Review Internal Estimate and Customer Proposal, completing the relevant customer, project and line-item details. Choose Save Draft to retain changes and Preview PDF to review the customer document. Previewing a draft does not issue it. Proposal access is a separate account grant; ordinary operational access alone does not grant access.",
  "source": "Proposal workflow guide · deployed application",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md",
  "sourceFiles": [
   "src/components/ToolboxLauncher.tsx",
   "src/modules/proposals/ProposalWorkspace.tsx",
   "src/modules/proposals/ProposalPanel.tsx",
   "src/modules/proposals/queries.ts",
   "supabase/migrations/20260827_004_proposal_generator_v1.sql",
   "supabase/migrations/20260828_014_generic_proposal_creation.sql",
   "supabase/migrations/20261005120000_read_only_messaging_write.sql"
  ],
  "examples": [
   "How do I create a Proposal?",
   "Can I create a Proposal without a Job?",
   "How do I preview a Proposal draft?"
  ]
 },
 {
  "id": "proposal-issue-revise",
  "title": "Issue a Proposal or revise an issued Proposal",
  "modules": [
   "proposals"
  ],
  "terms": "proposal proposals issue issued generate pdf revise revision change edit immutable estimate history",
  "requiredTerms": [
   [
    "proposal",
    "proposals"
   ],
   [
    "issue",
    "issued",
    "generate",
    "revise",
    "revision",
    "change",
    "edit"
   ]
  ],
  "status": "deployed",
  "permission": "proposal.access",
  "additionalPermissions": [
   "writeBusinessData"
  ],
  "route": "/proposals",
  "path": "Toolbox → Tools → Proposal Generator → open draft → Issue / Generate PDF; issued Proposal → Create Revision",
  "guidance": "Active administrators and accounts explicitly granted Proposal access can issue or revise Proposals if they also have business-write permission. In Toolbox → Tools → Proposal Generator, open the draft and review Customer Proposal and Internal Estimate. Choose Issue / Generate PDF and confirm issuance. Issued customer Proposals and internal Estimate snapshots become immutable. To change an issued Proposal, choose Create Revision from Proposal history or the issued Proposal, edit the new draft, review it and issue that revision. Editing a revision does not rewrite the previously issued document.",
  "source": "Proposal issuance and revision guide · deployed application",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md",
  "sourceFiles": [
   "src/components/ToolboxLauncher.tsx",
   "src/modules/proposals/ProposalWorkspace.tsx",
   "src/modules/proposals/ProposalPanel.tsx",
   "supabase/migrations/20260827_004_proposal_generator_v1.sql",
   "supabase/migrations/20260908_004_proposal_generator_v2.sql",
   "supabase/migrations/20261005120000_read_only_messaging_write.sql"
  ],
  "examples": [
   "How do I issue a Proposal?",
   "Can I edit an issued Proposal?",
   "How do I create a Proposal revision?"
  ]
 },
 {
  "id": "my-work-create",
  "title": "Create a private or shared My Work task",
  "modules": [
   "my-work"
  ],
  "terms": "my work task tasks create add new assign share shared private title due notes estimated time",
  "requiredTerms": [
   [
    "task",
    "tasks"
   ],
   [
    "create",
    "add",
    "new",
    "assign",
    "share"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "additionalPermissions": [
   "readOperationalData"
  ],
  "route": "/my-work",
  "path": "My Work → What needs to get done? → Share → Add task",
  "guidance": "Employees with operational access and business-write permission can create My Work tasks. In My Work, enter a title in What needs to get done?. Optionally add Notes, Due, Estimated time, a Job or attachments. Leave Share as Keep private for a task private to you, or select another user to create a Shared Task between you and that person. Choose Add task. Only the creator may change sharing later. Shared Tasks are visible to their participants, not every employee; administrative authority does not grant routine access to private task contents.",
  "source": "My Work task guide · deployed application",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md",
  "sourceFiles": [
   "src/modules/my-work/MyWorkPage.tsx",
   "src/modules/my-work/queries.ts",
   "supabase/migrations/20260827_012_my_work_mvp.sql",
   "supabase/migrations/20260831_021_my_work_task_estimated_time.sql",
   "supabase/migrations/20261005120000_read_only_messaging_write.sql"
  ],
  "examples": [
   "How do I add a task in My Work?",
   "How do I share a task with another employee?",
   "Can I create a private task?"
  ]
 },
 {
  "id": "my-work-complete",
  "title": "Complete or reopen a My Work task",
  "modules": [
   "my-work"
  ],
  "terms": "my work task tasks complete completed finish finished done reopen open mark quick actions",
  "requiredTerms": [
   [
    "task",
    "tasks"
   ],
   [
    "complete",
    "completed",
    "finish",
    "finished",
    "done",
    "reopen"
   ]
  ],
  "status": "deployed",
  "permission": "writeBusinessData",
  "additionalPermissions": [
   "readOperationalData"
  ],
  "route": "/my-work",
  "path": "My Work → task completion circle or Quick actions → Mark complete / Mark open",
  "guidance": "Employees with operational access and business-write permission can complete a task they own or participate in. Open My Work and find the task. Use its completion circle, or Quick actions → Mark complete. Reopen a completed task with Mark open. My Tasks shows your private tasks; Shared Tasks shows tasks exchanged with another user; All Tasks includes both sets visible to you. Completing an assigned Shared Task may notify its creator. These controls do not grant access to another employee's private tasks.",
  "source": "My Work completion guide · deployed application",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md",
  "sourceFiles": [
   "src/modules/my-work/MyWorkPage.tsx",
   "src/modules/my-work/queries.ts",
   "supabase/migrations/20260827_012_my_work_mvp.sql",
   "supabase/migrations/20261005120000_read_only_messaging_write.sql"
  ],
  "examples": [
   "How do I complete a My Work task?",
   "How do I reopen a completed task?",
   "Can I mark a Shared Task done?"
  ]
 },
 {
  "id": "message-reply",
  "title": "Reply to a specific employee message",
  "modules": [
   "messaging"
  ],
  "terms": "message messages messaging dm conversation group reply quote quoted specific original",
  "requiredTerms": [
   [
    "message",
    "messages",
    "messaging",
    "dm",
    "conversation",
    "group"
   ],
   [
    "reply",
    "quote",
    "quoted"
   ]
  ],
  "status": "deployed",
  "permission": "messaging.write",
  "route": "/my-work",
  "path": "Messaging → conversation → Message actions → Reply → Send",
  "guidance": "Employees with Messaging participation permission can reply inside a DM or group they are authorized to access. Open Messaging and the conversation, open Message actions on an ordinary employee message, and choose Reply. Type your reply and choose Send. The quoted preview links back to the original when it remains available to you. Replies stay in the same authorized conversation; they do not share the message with another conversation. Official system messages do not offer ordinary employee message actions.",
  "source": "Messaging reply guide · released conversation contract",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md",
  "sourceFiles": [
   "src/modules/my-work/InboxDialog.tsx",
   "supabase/migrations/20261022120000_messaging_groups_replies.sql",
   "supabase/migrations/20261022140000_messaging_removed_sender_entry_guards.sql",
   "supabase/migrations/20261005120000_read_only_messaging_write.sql"
  ],
  "examples": [
   "How do I reply to a specific message?",
   "Can I quote a message in a group conversation?",
   "How do I find the original message from a reply?"
  ]
 },
 {
  "id": "message-attachments",
  "title": "Send files or images in an employee conversation",
  "modules": [
   "messaging"
  ],
  "terms": "message messages messaging dm conversation chat attach attachment attachments file files image images photo photos upload paste drop send",
  "requiredTerms": [
   [
    "message",
    "messages",
    "messaging",
    "dm",
    "conversation",
    "chat"
   ],
   [
    "file",
    "files",
    "image",
    "images",
    "photo",
    "photos",
    "attachment",
    "attachments"
   ],
   [
    "attach",
    "send",
    "share",
    "upload",
    "paste",
    "drop"
   ]
  ],
  "status": "deployed",
  "permission": "messaging.write",
  "route": "/my-work",
  "path": "Messaging → authorized DM or group → Attach → Send",
  "guidance": "Employees with Messaging participation permission can send attachments inside an authorized DM or group. Open Messaging and the conversation, choose Attach, and select files. Supported browsers also allow pasting images or files, or dropping them into the composer. Review the attachments, optionally add text, then choose Send. Limits are 50 MB per file and 200 MB per message. Clipboard support varies by browser. The transfer must finish before the attachment message is delivered. Attachments remain subject to the conversation's access rules; TenBot does not independently retrieve those attachments; explicitly submitted text is processed for your own answer.",
  "source": "Messaging attachment guide · deployed application",
  "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md",
  "sourceFiles": [
   "src/modules/my-work/InboxDialog.tsx",
   "src/modules/my-work/messaging/useAttachmentQueue.ts",
   "supabase/migrations/20261022120000_messaging_groups_replies.sql",
   "supabase/migrations/20261005120000_read_only_messaging_write.sql"
  ],
  "examples": [
   "How do I attach a file to a message?",
   "Can I send images in a DM?",
   "How do I paste a photo into a Messaging conversation?"
  ]
 },
 ...workflowSupplement,
];
const patches=new Map((generatedKnowledgePatches as unknown as (Partial<CapabilityEntry>&{id:string})[]).map(patch=>[patch.id,patch]));
const applyKnowledgePatch=(entry:CapabilityEntry):CapabilityEntry=>({...entry,...patches.get(entry.id)});
export const registry=authoredRegistry.map(applyKnowledgePatch);
export const knowledgeEntries=(generatedKnowledge as CapabilityEntry[]).map(applyKnowledgePatch);

/** One allowlisted projection for tool results and retained-source freshness checks. */
export function publishedKnowledgeSource(entry:CapabilityEntry){
 const {id,title,status,guidance,path,route}=entry;
 if(entry.capabilityAvailability&&(!['released','partial','unverified'].includes(entry.capabilityAvailability.application)||!['guidance-only','read-if-registered'].includes(entry.capabilityAvailability.assistant)))throw new Error('Invalid published capability availability.');
 return {id,title,status,availability:entry.availability??'available',guidance,path,route,
  ...(entry.capabilityAvailability?{capabilityAvailability:{application:entry.capabilityAvailability.application,assistant:entry.capabilityAvailability.assistant}}:{}),
  ...(entry.architecture?{architecture:employeeArchitecture(entry.architecture)}:{})};
}
/** Authority is hashed internally, never sent to the model or employee. */
export function knowledgeProofValue(entry:CapabilityEntry,source:unknown=publishedKnowledgeSource(entry)){
 return {source,authority:{permission:entry.permission,additionalPermissions:entry.additionalPermissions??[],recordDigest:entry.recordDigest??'',releaseBoundary:entry.releaseBoundary??null,relatedRecordIds:entry.relatedRecordIds??[],toolNames:entry.toolNames??[]}};
}
function employeeArchitecture(value:KnowledgeArchitecture):KnowledgeArchitecture{
 const fail=()=>{throw new Error('Invalid published architecture knowledge.');};
 const text=(item:unknown,max=500):string=>{
  if(typeof item!=='string'||!item.trim()||item.length>max||/NEXT_PUBLIC_|SUPABASE_|CLOUDFLARE_|Bearer\s|\b[a-z]+_[a-z_]+\b|\b(?:RLS|JWT|SECURITY DEFINER)\b|\b(?:public|auth|storage)\.[a-z_]+|https?:\/\/|\b[a-f0-9]{40,64}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(item))return fail();
  return item;
 };
 const list=<T>(items:unknown,convert:(item:unknown)=>T):T[]=>Array.isArray(items)&&items.length<=8?items.map(convert):fail();
 const object=(item:unknown,keys:string[])=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!keys.includes(key)))return fail();
  return item as Record<string,unknown>;
 };
 const input=object(value,['entities','relationships','facts','preconditions','effects','approvalRequirements','limitations']);
 const result={entities:list(input.entities,item=>text(item,80)),relationships:list(input.relationships,item=>{
  const relation=object(item,['from','relation','to','cardinality']);
  return {from:text(relation.from,80),relation:text(relation.relation,120),to:text(relation.to,80),...(relation.cardinality===undefined?{}:{cardinality:text(relation.cardinality,80)})};
 }),facts:list(input.facts,item=>{
  const fact=object(item,['text','classification','verification']);
  if(!['schema-contract','product-convention','operational-rule'].includes(String(fact.classification))||!['repository-contract','released-source'].includes(String(fact.verification)))return fail();
  return {text:text(fact.text),classification:fact.classification as KnowledgeArchitecture['facts'][number]['classification'],verification:fact.verification as KnowledgeArchitecture['facts'][number]['verification']};
 }),preconditions:list(input.preconditions,item=>text(item)),effects:list(input.effects,item=>text(item)),approvalRequirements:list(input.approvalRequirements,item=>text(item)),limitations:list(input.limitations,item=>text(item))};
 if(new TextEncoder().encode(JSON.stringify(result)).byteLength>3000)return fail();
 return result;
}

const stop=new Set('how do i can a an the to in is it my on of for me you someone'.split(' '));
// Explicit module names constrain guide relevance. Current-route context does
// not: an employee can ask about another module while working elsewhere.
const moduleNames:[string,RegExp][]=[
 ['manpower',/\bmanpower(?:[ -]+reporting)?\b/],
 ['messaging',/\b(?:messaging|inbox|dm|messages?|chat|conversations?)\b/],
 ['rework',/\brework\b/],
 ['planning',/\bplanning\b/],
 ['my-work',/\bmy[ -]+work\b/],
 ['settings',/\bsettings\b/],
 ['contacts',/\bcontacts\b/],
 ['intake',/\b(?:intake|pre[ -]+production)\b/],
 ['samples',/\bsamples?\b/],
 ['proposals',/\bproposals?\b/],
 ['inventory',/\binventory\b/],
 ['purchasing',/\bpurchasing\b/],
 ['catalog',/\bcatalog\b/],
 ['material-usage',/\bmaterial[ -]+usage\b/],
 ['transmittals',/\btransmittals?\b/],
 ['production',/\b(?:in|from|using) (?:the )?production\b|\bproduction (?:module|workspace|pipeline)\b/],
];
const genericRecordWords=new Set(['job','jobs','project','projects','existing']);
const genericActionWords=new Set('how where what can create add new find search open view edit update change save use'.split(' '));
// These explicit actions need coverage in the selected workflow. A shared noun
// must not turn an unsupported export/delete/prediction into ordinary guidance.
const specificActions=new Set('delete remove export import predict forecast automate sync train invite approve'.split(' '));
// Catalog matching may identify a denied public workflow, but only authorized
// entries may supply instructions, links or inference context.
export function hasGuidePermission(entry:CapabilityEntry,permissions:Set<string>){return [entry.permission,...entry.additionalPermissions||[]].every(permission=>permissions.has(permission));}
export function matchGuides(question:string){
 const query=expand(question);
 // No released credential/account-editing guidance is maintained here.
 // A Contacts module word cannot turn a password question into Customer edits.
 if(/\b(?:password|passwd|credentials?|login|log in)\b/.test(query))return [];
 // Inventory's Intake movement is distinct from the Pre-Production module.
 const stockIntake=/\binventory\b/.test(query)&&/\b(?:record|stock|movement|outtake|quantity|lot)\b/.test(query)&&!/\bpre[ -]+production\b/.test(query);
 const explicitModules=moduleNames.filter(([module,pattern])=>pattern.test(query)&&!(module==='intake'&&stockIntake)).map(([module])=>module);
 const moduleWords=new Set(moduleNames.flatMap(([,pattern])=>query.match(pattern)?.[0].match(/[a-z]+/g)||[]));
 const words=[...new Set(query.match(/[a-z]+/g)||[])].filter(w=>w.length>1&&!stop.has(w));
 // A transfer question can also ask about its Proposal/Sample relationships.
 // Those clauses must not exclude the authoritative Bid handoff procedure.
 // Keep this explicit intent narrow; unrelated shared module words still use
 // the strict intersection below, including unsupported-action protection.
 const bidToProduction=/\bbids?\b/.test(query)&&(
  /\b(?:get|move|put|bring|take|convert|hand off)\s+(?:it|that|this|(?:(?:a|the|my|our|this|that|won|existing)\s+)*bids?)\s+(?:into|to)\s+(?:(?:a|the)\s+)?production\b/.test(query)
  ||/\bbid\s+(?:conversion|handoff)\s+(?:into|to)\s+(?:the\s+)?production\b/.test(query));
 const inventoryHistory=/\b(?:inventory|stock)\b/.test(query)&&/\b(?:history|old|past|previous|historical)\b/.test(query)
  &&/\b(?:inspect|review|view|read|look|search|find|see)\b/.test(query)&&explicitModules.every(module=>module==='inventory');
 const contactHistory=/\b(?:customer|contact|phone|email|directory)\b/.test(query)&&/\b(?:jobs?|proposals?|snapshots?|captured|historical)\b/.test(query)
  &&/\b(?:rewrite|affect|preserve|retain|keep|historical|linked)\b/.test(query)&&explicitModules.every(module=>['contacts','proposals','production'].includes(module));
 const partialReceipt=/\b(?:incoming|pending|receivals?|delivery|deliveries)\b/.test(query)&&/\b(?:partial|receive|receiving|receipt)\b/.test(query)&&explicitModules.every(module=>module==='inventory');
 const taskGroupComparison=/\btask groups?\b/.test(query)&&/\b(?:shar\w*|messaging)\b/.test(query)&&explicitModules.every(module=>['my-work','messaging'].includes(module));
 const manpowerPeriod=/\b(?:expanded|reporting) groups?\b/.test(query)&&/\b(?:period|dates?|analytics)\b/.test(query)&&explicitModules.every(module=>module==='manpower');
 const priority=inventoryHistory?'inventory-activity':contactHistory?'customer-history':partialReceipt?'inventory-pending-receive':taskGroupComparison?'workflow-task-groups':manpowerPeriod?'workflow-manpower-history':bidToProduction?'workflow-intake-convert':null;
 const procedure=priority?registry.filter(e=>e.id===priority
  &&words.filter(word=>specificActions.has(word)).every(word=>e.terms.split(' ').includes(word))):[];
 if(inventoryHistory||contactHistory||manpowerPeriod||taskGroupComparison)return procedure;
 const strict=registry.filter(e=>explicitModules.every(module=>e.modules.includes(module)))
  // Receiving is distinct from adding the incoming expectation, even when
  // the employee uses the generic verb "record" for the receipt.
  .filter(e=>!(partialReceipt&&e.id==='inventory-pending-create'))
  // Each required group needs one exact token: editing words and field names
  // alone must not turn unrelated Job/account questions into Contacts advice.
  .filter(e=>!e.requiredTerms||e.requiredTerms.every(group=>group.some(word=>words.includes(word))))
  .filter(e=>words.filter(word=>specificActions.has(word)).every(word=>(' '+e.terms+' ').includes(' '+word+' ')))
  .filter(e=>!(words.includes('filter')&&!explicitModules.length&&e.id==='production-find-job'))
  .map(e=>({e,matches:words.filter(w=>(' '+e.terms+' ').includes(' '+w+' '))}))
  .filter(({matches})=>matches.some(word=>!genericRecordWords.has(word)&&!moduleWords.has(word)))
  .map(item=>({...item,score:item.matches.reduce((score,word)=>score+(genericRecordWords.has(word)||moduleWords.has(word)?0:genericActionWords.has(word)?1:3),0)}))
  .sort((a,b)=>b.score-a.score).map(x=>x.e);
 return [...new Map([...procedure,...strict].map(entry=>[entry.id,entry])).values()];
}
export function retrieve(question:string,permissions:Set<string>){return matchGuides(question).filter(entry=>hasGuidePermission(entry,permissions)).slice(0,3);}

// High-recall context for one conversational request; the model interprets the
// actual question across these sources. Direct search keeps its strict matcher.
const expand=(text:string)=>text.toLowerCase().replace(/\bre[- ]work\b/g,'rework').replace(/\bredo\b/g,'rework').replace(/\bkick off\b/g,'initiate').replace(/\brecur\b/g,'recurring').replace(/\bnarrow\b/g,'filter')
 .replace(/\bfliter\b/g,'filter').replace(/\breceivers?\b/g,'receive').replace(/\bonly part\b/g,'partial')
 .replace(/\bconverted\b/g,'convert').replace(/\bintake\s*\/\s*return\b/g,'return');
export function conversationMatches(text:string){
 const clauses=expand(text).split(/[?;]|\band\b|\balso\b|(?=\b(?:how do|how can|can i|can my|will that|what if|please draft)\b)/).filter(Boolean);
 const full=matchGuides(expand(text));
 const matches=[...new Map([...full,...clauses.flatMap(clause=>matchGuides(clause))].map(entry=>[entry.id,entry])).values()];
 // A preservation/history question can mention issued Proposals without
 // asking for the unrelated privileged action of issuing a new Proposal.
 return full[0]?.id==='customer-history'&&/\b(?:rewrite|affect|preserve|retain|captured)\b/i.test(text)
  ?matches.filter(entry=>entry.permission==='readOperationalData'&&!entry.additionalPermissions?.length):matches;
}
// Resolve dependent wording only against the recent authenticated assistant
// topic. Generic dates/state words must not introduce another Job workflow.
// Explicit workflow requests and module changes still stand on their own.
const dependentQuestion=/\b(?:that|it|they|those|them|same|instead)\b|\bwhat (?:about|if)\b|\b(?:final (?:button|step)|expanded group|period i picked|conversion.*(?:times? out|retried|retry)|document was captured)\b/i;
const workflowAction=/\b(?:how (?:do|can|would|should) (?:i|we)|(?:can|may|should) (?:i|we|you)|(?:want|need) to)\s+(?:\w+\s+){0,2}(?:create|start|initiate|schedule|reschedule|edit|update|change|save|find|search|filter|send|share|attach|receive|adjust|issue|convert|add|remove|delete|export|import)\b/i;
function namedTopics(text:string){
 const query=expand(text),named=moduleNames.filter(([,pattern])=>pattern.test(query)).map(([module])=>module);
 if(/\b(?:purchase orders?|po)\b/.test(query))named.push('purchasing');
 if(/\bbids?\b/.test(query))named.push('intake');
 if(!named.length&&/\b(?:customers?|company|contacts?)\b/.test(query))named.push('contacts');
 if(/\b(?:timeline|scheduled|scheduling)\b/.test(query))named.push('timeline');
 if(/\b(?:notifications?|iphone|push)\b/.test(query))named.push('settings');
 return named;
}
export function conversationQuestion(question:string,context:string[]=[]):string{
 const follow=(text:string,topic:string)=>{
  if(!topic||!dependentQuestion.test(text)||/\b(?:new topic|switch(?:ing)? to|back to)\b/i.test(text))return expand(text);
  const current=conversationMatches(text);
  if(current.length&&workflowAction.test(text))return expand(text);
  const activeModules=conversationMatches(topic)[0]?.modules||namedTopics(topic);
  if(namedTopics(text).some(module=>!activeModules.includes(module)))return expand(text);
  return `${topic} ${expand(text)}`;
 };
 // Fold chronologically so a new generated-only or unknown topic supersedes
 // older authored guides, while a chain of dependent questions keeps its topic.
 let topic='';
 for(const text of context.filter(item=>item.startsWith('Conversation context:\n'))){
  for(const match of text.matchAll(/(?:^|\n)Employee: ([\s\S]*?)\nTenBot: ([^\n]*)/g)){
   // The bounded history may retain only a pronoun follow-up. Recover its
   // topic from the accepted own reply using public vocabulary, never its
   // claims as capability authority or new knowledge.
   if(!topic&&dependentQuestion.test(match[1]))topic=conversationMatches(match[2])[0]?.title||namedTopics(match[2]).join(' ');
   topic=follow(match[1],topic);
  }
 }
 if(!topic||!dependentQuestion.test(question))return question;
 const resolved=follow(question,topic);
 return resolved===expand(question)?question:resolved;
}
export function conversationGuides(question:string,context:string[]=[]):CapabilityEntry[]{
 const resolved=conversationQuestion(question,context),dependent=resolved!==question;
 question=resolved;
 const related=(text:string)=>{
  const query=expand(text),words=new Set(query.match(/[a-z]+/g)||[]);
  const named=moduleNames.filter(([,pattern])=>pattern.test(query)).map(([name])=>name);
  return registry.filter(entry=>entry.requiredTerms[0].some(word=>words.has(word)&&!genericRecordWords.has(word))&&(!named.length||entry.modules.some(module=>named.includes(module))))
   .filter(entry=>[...words].filter(word=>specificActions.has(word)).every(word=>entry.terms.split(' ').includes(word)))
   .map(entry=>({entry,score:entry.terms.split(' ').filter(word=>words.has(word)&&!genericRecordWords.has(word)&&!genericActionWords.has(word)).length}))
   .filter(item=>item.score>0).sort((a,b)=>b.score-a.score).map(item=>item.entry);
 };
 const generated=(text:string)=>{
  const query=expand(text),words=[...new Set(query.match(/[a-z]+/g)||[])].filter(word=>word.length>2&&!stop.has(word)&&!genericRecordWords.has(word)&&!genericActionWords.has(word));
  const named=namedTopics(query);
  return knowledgeEntries.filter(entry=>!named.length||entry.modules.some(module=>named.includes(module)))
   // Ordinary Inventory words do not request the distinct retained material
   // assessment service or its Proposal permission boundary.
   .filter(entry=>entry.id!=='knowledge-material-assessment'||/\b(?:assessment|requirements?|supply|supplier|procurement|lead[- ]?times?|estimat\w*|guarantee\w*)\b/.test(query))
   .filter(entry=>!(/\blead[- ]?times?\b/.test(query)&&entry.id!=='knowledge-material-assessment'))
   .map(entry=>({entry,score:words.reduce((score,word)=>score+(entry.terms.split(' ').includes(word)?3:entry.guidance.toLowerCase().includes(word)?0.1:0),0)+(named.includes(entry.id.replace(/^knowledge-/,''))?1:0)}))
   .filter(item=>item.score>=3).sort((a,b)=>b.score-a.score).map(item=>item.entry);
 };
 const current=dependent?matchGuides(question):conversationMatches(question);
 // Conversion starts with saving the existing Bid. Reuse its verified edit
 // procedure rather than infer a Save control from broad interface labels.
 const prerequisites=current[0]?.id==='workflow-intake-convert'?registry.filter(entry=>entry.id==='workflow-intake-bid'):[];
 const broad=generated(question).filter(entry=>!current.length||current.some(workflow=>dependent
  ?workflow.modules.every(module=>entry.modules.includes(module))
  :workflow.modules.some(module=>entry.modules.includes(module))));
 const fallback=current.length?[]:related(question);
 // Exact workflows come first when known; broader release-pinned sources add
 // facts for intent interpretation and synthesis without changing direct search.
 return [...new Map([...current,...prerequisites,...broad.slice(0,current.length?(prerequisites.length?1:2):3),...fallback].map(entry=>[entry.id,entry])).values()].slice(0,4);
}
