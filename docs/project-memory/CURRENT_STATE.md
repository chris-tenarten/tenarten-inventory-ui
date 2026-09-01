# Current State

This is a concise map of the released/current TenOps architecture as of September 2026. Source, migrations, Git, and narrowly verified hosted behavior remain authoritative; re-inspect them before relying on this snapshot.

## Release boundary

- Production branch: `main`; Cloudflare Production deploys from `main`.
- `dev` may contain intentional unreleased work. Do not infer release status from ancestry or merge `dev` wholesale.
- The hosted Supabase migration ledger is not reliable evidence for this repository. Verify required hosted objects and behavior directly.

## Canonical domains and routes

- `/` and `/production`: Production Dashboard/Pipeline with Overview, Table, Timeline, Inspector, planning readiness, attachments, activity, scheduling, archive/restore, Job Updates, and job-scoped Planning.
- `/inventory` and `/activity`: Inventory, reservations, Pending Receivals, receipt/undo lineage, and Inventory Activity.
- `/purchasing` and `/catalog`: Purchase Orders, immutable issuance/PDF pipeline, Vendor configuration, Vendor Catalog, and PO-to-Pending-Receival projection.
- `/manpower-reporting` and `/material-usage`: distinct operational reporting streams linked to canonical Jobs or permitted temporary work identity.
- `/proposals`: Proposal generator plus generic Proposal workspace/creation.
- `/transmittals`: generic Transmittal entry and immutable document history.
- `/my-work`: private/shared tasks, estimated effort/workload, attachments, Inbox, Inbox attachments, release communications, private typing authorization, and Admin lifecycle cleanup.
- `/settings`: account/administrative settings and Toolbox entry points supported by the current shell.
- `/transactions`: legacy route outside primary navigation.

## Canonical Production Job boundary

`public.jobs` is the one canonical Production Job entity. Its UUID anchors Production scheduling and planning, reservations, labor, material usage, documents, attachments, activity, and related operational context. Names and business numbers are mutable presentation attributes, not relationship keys.

Pre-Production must not create pseudo Jobs or reserve Job numbers to stand in for a Bid. Current confirmed direction is one Bid entering Production maps 1:1 to one canonical Production Job, with deposit receipt the known practical gate; exact lifecycle and transfer semantics remain Product decisions.

## Implemented architecture

- Production scheduling uses staged proposals and an atomic batch boundary; Planning phases/items and execution progress remain job-scoped.
- Inventory preserves canonical-or-temporary reservation identity through receiving and history. Undo Receive is lineage-aware and audit-preserving.
- Purchasing owns structured drafts, immutable issuance snapshots, retryable private PDFs, Vendor data, Vendor Catalog pricing, and guarded projection into Pending Receivals.
- Material Usage and Manpower remain separate facts and use canonical Job links where available; reporting groups are not Jobs.
- Proposal and Transmittal document domains are implemented. Issued artifacts are historical snapshots and must not be silently rewritten after later Job/Bid relationships change.
- My Work and Inbox are participant/private domains. Task estimated effort supports workload views; attachments and typing/Realtime authorization preserve private boundaries.
- Admin lifecycle cleanup exists but does not grant routine private-content reading authority.
- Job Update collaboration, assignment, editing, deletion, mentions/notifications, seen state, and Production rework cycles are implemented.

## Security and migration state

Supabase Auth/RBAC infrastructure and later compatibility/enforcement work exist, but security conclusions require inspection of actual policies, grants, functions, Storage, and Realtime behavior. Do not resurrect older descriptions of the app as solely anonymous/client-gated, and do not assume every surface has reached the same least-privilege maturity.

Recent migration families include Proposal (`_014` generic creation), My Work attachments (`_015`), Inbox (`_016`), Inbox attachments (`_017`), release communications (`_018`), private typing authorization (`_019`), lifecycle/Admin cleanup (`_020`), and estimated task effort (`_021`). Applied migration files are immutable.

`supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql` is superseded and must never be applied wholesale.

## Pre-Production next boundary

Pre-Production/Bid pipeline and generic Sample Form generation are next in Product/Architecture discovery, not implementation. Confirmed direction is recorded separately from unresolved semantics in `OPEN_QUESTIONS.md`. Existing generic Proposal infrastructure and Vendor Catalog capabilities must be reused; the Product Acceptance Contract must precede implementation.

## Durable references

- Product constitution: `docs/project/PROJECT_MANIFEST.md`
- Execution practice: `docs/project/ENGINEERING_EXECUTION_STANDARD.md`
- Durable product principles: `docs/project-memory/BLUEPRINT.md`
- Current unresolved decisions: `docs/project-memory/OPEN_QUESTIONS.md`
- Workflow-specific documentation: `docs/workflows/`
