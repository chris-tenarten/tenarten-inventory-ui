# Technical inventory: schema, services and TenBot capabilities

This is the lookup entry point for existing technical contracts, not a second schema specification. **Source review: November 2, 2026, America/Chicago**, root `dev` at `b5f7f66bfe924a2876834d0e698decf206eff9bb`; unrelated dirty work was preserved. No hosted query was run for this inventory. Reinspect relevant paths and release evidence before using a claim as current.

> Before proposing new database structures, services, or agent tools, first consult the existing technical inventory. If its freshness or completeness is uncertain, ask Codex to inspect the current source and deployed schema, then recommend the smallest change that reuses existing functionality.

## November 2 reviewed-operation candidate (local, unapplied)

The [focused implementation and Workspace contract](../project-memory/2026-11-02-tenbot-reviewed-actions.md) extends the existing agent registry with independently reusable document/catalog/Purchasing and customer/contact reads and nonpersistent Proposal/Pending Receival preparation. Source: `tenbot-proposal-operations.ts`, `tenbot-business-operations.ts`, `tenbot-reviewed-operations.ts` under `supabase/functions/_shared/`.

The trusted `tenbot-actions.ts`, `tenbot-action-auth.ts`, `tenbot-action-transport.ts` and existing TenBot Edge entry define exact review, password confirmation, preview, status and receipt contracts outside the model. New migration `20261102120000_tenbot_reviewed_actions.sql` is **unapplied** and defaults off; it reuses canonical Proposal create/save and existing Auth/permission epochs. Pending creation is explicitly blocked: the legacy permit commit path needs action-bound enforcement before this password contract can safely enable it. No existing roles/capabilities or canonical business RPCs are changed. Local PostgreSQL was unresponsive, so transaction/concurrency certification is incomplete. Hosted ask/history and all releases/configuration remain untouched. This addendum is source evidence, not a hosted-state assertion.

**Accepted-foundation continuation:** the [canonical execution and host integration section](../project-memory/2026-11-02-tenbot-reviewed-actions.md#accepted-foundation-continuation--canonical-execution-and-host-integration) supersedes the local gaps above. Forward `130000` adds private action-to-canonical-stage/transaction binding and a guard on `invoice_receival_executions`; forward `140000` preserves old employee-history rows while adding private reference/access metadata. `tenbot-hosted-operations.ts` connects the same reusable adapters through the existing hosted session/discovery/publisher under default-OFF `TENBOT_REVIEWED_OPERATIONS_ENABLED`, restricted to TenDev. The public `tenbot.actions.v1` structures remain compatible; ordinary ask can add `documentIds`/`supersedes`, and ask/history can return `actionStatuses`. Isolated application/evidence and shared deployed state must be distinguished in the scoped receipt. No shared migration, deployment, funding or activation is authorized by this continuation.

Real PostgreSQL/Auth/Storage tests in the existing isolated Free fixture prove actual Proposal/Pending persistence, password/session binding, canonical bypass denial, concurrency/replay, rollback, zero stock changes and history compatibility. They exposed the deferred canary trigger's source-only `NEW.id` expression on an execution row without `id`; forward `150000` preserves the existing guard while making that record boundary explicit. Applied SQL remains immutable. The continuation receipt records twelve real groups, synthetic limitations, restored OFF controls and fresh shared Edge49/default-OFF observations. No new action objects/migrations are applied to the shared project; Pages commit metadata remains last accepted because the read-only Cloudflare refresh returned401.

## Schema sources and freshness

**Local Workspace integration — November 2:** [integration receipt](../project-memory/2026-11-02-tenbot-workspace-integration.md)
records the selective combination of accepted backend `afa4bfa` and Workspace
`262c25f`. The [frontend action module](../../src/modules/tenbot/actions/README.md)
connects verified ordinary ask/history statuses to the existing trusted action
transport. `src/lib/auth-action-session.ts` guards the existing Auth storage
handoff; no second session store or RBAC change is introduced. Ordinary document
selection reuses the existing owner-private original upload service; new OCR is
not provided. A canonical disabled-tax default correction uses rate zero, while
unknown line prices remain unknown. Actual local-app verification uses the
existing isolated fixture, real Auth/history/business records and a scripted
provider transport. It does not establish Terra reasoning or shared activation.
No migration or hosted configuration is changed in this integration pass.

| Need | Reuse | Verification boundary |
| --- | --- | --- |
| Tables, columns, types, defaults, constraints, foreign keys, enums, indexes and RPC definitions in source | [Append-only migrations](../../supabase/migrations/) and affected application callers | Repository contracts at the inspected revision; includes superseded/unapplied work and cannot reconstruct every older hosted object. Never apply the directory as an inventory refresh. |
| Current physical metadata | [Read-only inventory query](../../supabase/inspection/technical_inventory_readonly.sql) | Query is supplied but **not executed by this pass**. It derives metadata from PostgreSQL catalogs, without business rows or routine bodies. An authorized execution supplies the actual target/time/scope. |
| Domain meaning | [Jobs](JOBS.md), [Inventory](INVENTORY.md), [Purchasing](PURCHASING.md), [Operational reporting](OPERATIONAL_REPORTING.md), [Attachments](ATTACHMENTS.md), [Conceptual data model](../architecture/DATA_MODEL.md) | Focused/conceptual references, not exhaustive physical schemas or fresh hosted attestations. Some retain historical fields/wording. |
| Retained shared hosted metadata | [October 30 scoped snapshot](../project-memory/evidence/2026-10-30-tenbot-receival-readiness/shared-schema-metadata.json) | `checkedAt=2026-10-30T15:08:37.394Z`; ten selected tables and selected routines, including columns/constraints/FKs/indexes/RLS/triggers. No operational rows/mutations. No complete enum or migration inventory. |
| Migration/deployment state | Exact owning [release receipts](../project-memory/CURRENT_STATE.md), notably the [November 2 TenDev release](../project-memory/2026-11-02-tenbot-conversational-tendev-release.md) | Scope-specific dated evidence. Fixture metadata and applied-migration files are not proof of Production state. Current State's old opening needs reconciliation. |

No complete current physical-schema capture or generated `Database` TypeScript model was found during this review. `src/lib/supabase.ts` uses an unparameterized client. Do not invent a typed-schema generator or mistake the knowledge generator for one.

The retained October 30 shared snapshot covers `app_role_capabilities`, `app_users`, `inventory_items`, `inventory_transactions`, `jobs`, `pending_receivals`, both Vendor Catalog tables, `vendors`, and `storage.objects`, plus selected routines. Adjacent `fixture-*` metadata belongs to an isolated test environment and must not be relabeled as hosted application schema.

For a refresh, use the existing authorized metadata/SQL access path, identify the exact project/database and environment, and execute only the needed catalog sections in the read-only query. Record capture time, repository/release revision, inspected schemas/objects and omissions in the existing task receipt. Keep metadata out of the bootstrap; retain selected sanitized output only where the owning workstream already keeps evidence. Inspect actual grants/RLS/Storage/Realtime separately when the change depends on them. Other inspection scripts may read operational rows or perform cleanup; this is not permission to run them wholesale.

## Existing services and business operations

This is a **source-derived navigation inventory** at the review boundary above, not a claim that every operation is deployed, exposed to TenBot or authorized for the current employee. Inspect the exported implementation, caller, persistence contract and relevant release receipt before extending it.

| Domain / supported source contracts | Owning implementation |
| --- | --- |
| Production Job identity, lifecycle/Rework, scheduling, updates and files | [production/jobs.ts](../../src/modules/production/jobs.ts); [schedule contract](../../src/modules/production/schedule-batch-contract.ts) |
| Inventory reads; manual stock, reservation, receiving and undo operations | [retrieval.ts](../../src/modules/inventory/retrieval.ts); [Inventory workspace](../../src/app/inventory/page.tsx), which still owns direct table/RPC callers |
| Invoice prepared-draft get/prepare/approve/revoke/execute contracts | [invoice-receival-service.ts](../../src/modules/inventory/invoice-receival-service.ts); execution remains separately host/DB-gated |
| Vendors, catalog, Purchase Orders, issuance and receival projection | [purchasing/queries.ts](../../src/modules/purchasing/queries.ts), [mutations.ts](../../src/modules/purchasing/mutations.ts) |
| Proposal drafts, issuance/revisions, estimate conversion and document generation | [proposals/queries.ts](../../src/modules/proposals/queries.ts), [estimate-to-proposal.ts](../../src/modules/proposals/estimate-to-proposal.ts); embedded-text extraction is not proof of a screenshot agent |
| Samples; Intake/Bid planning | [samples/queries.ts](../../src/modules/samples/queries.ts), [pre-production/queries.ts](../../src/modules/pre-production/queries.ts), [planning-data.ts](../../src/modules/pre-production/planning-data.ts) |
| Labor and material reporting | [manpower.ts](../../src/modules/manpower/manpower.ts), [material-usage/actions.ts](../../src/modules/material-usage/actions.ts) |
| Private tasks/Messaging; Transmittals | [my-work/queries.ts](../../src/modules/my-work/queries.ts), [transmittals/queries.ts](../../src/modules/transmittals/queries.ts), [mutations.ts](../../src/modules/transmittals/mutations.ts) |

Discover HTTP entry points under [Supabase functions](../../supabase/functions/) (`*/index.ts`) and [Next API routes](../../src/app/api/) (`*/route.ts`). Many operations call Supabase tables/RPCs directly, so an endpoint list alone is incomplete. Permission vocabulary lives in [client RBAC](../../src/lib/rbac.ts), [server auth](../../src/lib/server-auth.ts) and [Edge RBAC](../../supabase/functions/_shared/rbac.ts); effective hosted grants and current account access need their own verification.

Reuse the existing [knowledge manifest](../../scripts/tenbot-knowledge/manifest.mjs) for module/workflow routes, permissions, service/source paths and release pins; [architecture facets](../../scripts/tenbot-knowledge/architecture.mjs) classify relationships, prerequisites, effects, approvals and limitations. Their [generated snapshot](../../supabase/functions/_shared/tenbot-knowledge-snapshot.ts) retains source hashes/provenance. These are release-pinned guidance, not a full schema export, fresh hosted attestation or execution registry. Manifest/facets were last changed at `b11b757` (October 29); the generated snapshot at `8295bd0` (October 30), with per-module verification pins spanning October 27–29. Recheck those dates when refreshing.

## What TenBot can actually call

Separate four questions: **does the application operation exist; is it registered as an agent tool; is it enabled/authorized; is that boundary deployed?** A knowledge record or capability label answers neither execution nor rollout authority.

| Layer | Source and observed scope |
| --- | --- |
| Tool definitions | [tenbot-agent-operations.ts](../../supabase/functions/_shared/tenbot-agent-operations.ts): five Job reads, `find_jobs`, `get_job_summary`, `get_job_planning`, `get_job_labor_summary`, `get_production_overview`; also workflow-knowledge search and assistant-scope reads |
| Actual session composition and discovery | [tenbot-agent-session.ts](../../supabase/functions/_shared/tenbot-agent-session.ts), [tenbot-agent.ts](../../supabase/functions/_shared/tenbot-agent.ts); runtime discovery is bounded to assembled tools |
| Caller-authorized execution | [tenbot-job-tools.ts](../../supabase/functions/_shared/tenbot-job-tools.ts), [tenbot-job-session.ts](../../supabase/functions/_shared/tenbot-job-session.ts) |
| Conditional invoice read/prepare tools | [tenbot-invoice.ts](../../supabase/functions/_shared/tenbot-invoice.ts): `read_invoice`, `search_catalog`, `check_receival_duplicates`, `prepare_pending_receivals`, subject to session gates; these are not execution tools |
| Hosted rollout/provider/write controls | [tenbot entry point](../../supabase/functions/tenbot/index.ts), [hosted adapter](../../supabase/functions/_shared/tenbot-hosted.ts); inspect exact deployed revision and settings, not only local defaults |

The November 2 receipt records TenDev `27816509`, Production Pages `e71bd981`, shared Edge43, model-directed reads gated to TenDev, ordinary Terra spending OFF and preparation/agent writes OFF. Thus ordinary application Proposal/stock/receival services do not imply available agent writes. The separate local workspace `5cb71fb` has an unwired feature-request adapter; persistence/reporting remain planned. See the [continuity handoff](../project-memory/2026-11-02-chatgpt-context-transfer.md) for acceptance failures and ownership.

## Maintenance contract

The Codex owner of a schema, service, API or TenBot capability change updates the relevant technical reference **in the same implementation/release work**:

1. Update the owning domain/service contract and this lookup map only where its pointers, exposure or verification limits change. Generate/query physical detail from source/catalogs rather than manually copying the full schema.
2. Record exact source revision, environment, timestamp, inspected scope, applied/unapplied migration boundary and validation limits in the existing scoped receipt. Distinguish application availability, agent registration, enabled configuration and observed deployment.
3. For affected TenBot knowledge, follow the [existing synchronization contract](../project-memory/2026-10-29-tenbot-architecture-knowledge.md): review semantic/release impact, use existing `tenbot:knowledge:review-release`, `tenbot:knowledge` and `verify:tenbot-knowledge` commands when appropriate to the approved boundary. Do not advance pins to local HEAD or regenerate unrelated knowledge simply to refresh this index.
4. Have the active owner update Current State and the documentation index as needed. Preserve concurrent dirty files, dated receipts, privacy and release authority. No database, scheduler or automation service is added for inventory upkeep.

When ChatGPT needs detail, ask Codex: “At the current repository and named deployment boundary, locate the existing operation/schema/tool in `docs/schemas/README.md`; inspect its current source and, within authorized access, refresh the relevant deployed metadata. Report the source/time/scope and drift, then propose the smallest reuse-based change.” Missing access or incomplete evidence stays explicitly unverified.

**November 2 executed staging supersession:** The [integrated TenDev staging and real employee acceptance receipt](../project-memory/2026-11-02-tenbot-integrated-staging.md) supersedes the earlier hosted-state observations above: exactly four action migrations applied; TenDev `a0a629d8` / shared Edge 61 JWT ON; both operational objectives failed and all temporary spending/write gates closed. Production Pages remains `e71bd981`. Earlier source/local-only statements and receipts retain their historical scope.

**November 2 focused completion supersession:** [Completion and normal-availability receipt](../project-memory/2026-11-02-tenbot-agentic-completion.md): deployed implementation `5f32795c`, TenDev `a1831baf` / final Edge64 JWT ON, real password-confirmed standalone Proposal Q26-1102-1.0 created. Pending review now publishes but remains held; actual source-quantity exposure gap corrected locally in `231046e5` (not deployed), and the hosted pure canonical quantity probe rejects the equal-total/per-bag example with 22023. No new migration; permanent Pending remains pilot-dependent. All temporary spending/action/enrollment controls closed; ordinary Production Terra spend and employee rollout OFF; Production Pages/config unchanged. This is focused correction required, not completed Pending or Production acceptance.

**November 2 Pending execution supersession:** [Quantity contract and employee completion](../project-memory/2026-11-02-tenbot-pending-quantity-completion.md): source `ec34f539` plus prior `231046e` exposure deployed as TenDev `afb549d1` / final Edge67 JWT ON. Narrow `20261102160000` changes only the existing invoice quantity-basis function, with shared readback/unchanged authorization and schema. Separate same-line 50 LB total + 50 LB/Bag now yields exact1Bag; package-only/annotation/conflict holds remain. Existing trusted fields summarize duplicate findings. Genuine seven-tool Terra follow-up reused the authorized original; Chris's password created canonical Pending `1d7bea71`, received0, stock unchanged. All temporary gates closed; Production Pages/config and accepted Proposal unchanged. General availability remains OFF/pilot-dependent; stop Product review, no Production promotion.

**November 2 initial employee rollout preparation:** [Readiness receipt](../project-memory/2026-11-02-tenbot-initial-rollout-readiness.md) records Product acceptance of the completed TenDev scope and fresh unchanged Pages/Edge67 observations. Local `fbff048` adds persistent configured UUID cohort eligibility (`TENBOT_EMPLOYEE_IDS`, default empty/OFF), exact TenOps action-host compatibility, independent paid-provider eligibility and current-capability-filtered preparation discovery. No role/grant, deployed configuration or funding change occurred. All six November 2 migrations are already present in the shared ledger; quantity body/ACL and current disabled controls were read back narrowly. The existing monthly reserve enforces the shared monthly and per-request caps and step/rate bounds; legacy daily/user-dollar/open-limit columns are historical, not enforced gates.

Permanent Production Pending execution remains blocked by finite pilot/permit contracts. The [exact proposed authorization scope](../project-memory/2026-11-02-tenbot-permanent-pending-activation-plan.md) reuses existing password-authorized action dispatch and canonical core, with no proposed new table, grant or RLS policy. It requires separate Product policy approval, implementation/isolated verification and shared-application approval. No new migration was created or applied. This local preparation does not establish five-user hosted acceptance or activate ordinary Terra.
