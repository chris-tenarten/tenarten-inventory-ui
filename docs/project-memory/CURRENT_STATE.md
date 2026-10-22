# Current State

Dated snapshot: **October 21, 2026, 3:51 p.m. America/Chicago**. Reinspect relevant Git and hosted facts before acting. This is an index of status and evidence, not a transcript or a new source of Product authority. Status meanings and the compact handoff are in the [execution standard](../project/ENGINEERING_EXECUTION_STANDARD.md#compact-handoff-and-status).

## Independently verified release boundary

Fresh `git fetch origin --no-prune`, `git ls-remote origin refs/heads/main refs/heads/dev` and local ref inspection agree:

| Boundary | Verified revision / observation |
| --- | --- |
| Local `main`, `dev`, fetched `origin/main`, `origin/dev`, live remote heads | `64ded3e845b62ed3cbf59f90ab2f99ad20f2c1cc` |
| TenDev canonical Pages deployment (`dev`) | `bc73f0d1-4938-4d75-b825-fb16b87ec31d`; runtime `c99316c1ec30463c40333a3f725857b0de6eb9f8`; success |
| TenOps canonical Pages deployment (`main`) | `20538973-44e1-4d9e-87bf-52b0b0b66ab1`; runtime `c99316c1ec30463c40333a3f725857b0de6eb9f8`; success |

Both projects were rechecked directly through the Cloudflare project API at **20:49 UTC**. At **20:51 UTC**, fresh public GETs for each canonical domain's `/`, `/settings`, `/manifest.webmanifest` and `/sw.js`, plus all **25 referenced runtime assets per environment**, matched SHA-256 values in the retained environment-specific GA artifact manifests. Each domain's root also matched its current deployment URL. This confirms the served GA export as well as control-plane identity; no browser workflow, build, application test, worker execution or hosted database audit was run. The [executed GA receipt](2026-10-21-web-push-general-availability.md#executed-release) owns the earlier worker/migration acceptance evidence.

**Release order reconciled against the actual Git graph:** `372a7007` mobile UI polish (October 21, 14:24 CDT) → `29d1930` diagnostics → `c99316c` Web Push GA (14:47 CDT) → `64ded3e` release documentation (14:53 CDT). The completed mobile-polish receipt recorded both environments at `372a7007` at 14:30 CDT; that was an earlier deployment, not a release after GA. All three mobile application files (`globals.css`, `InboxDialog.tsx`, `MyWorkPage.tsx`) are byte-identical between `372a7007` and the served `c99316c` revision. Thus mobile polish is included in today's verified runtime. `64ded3e` is one documentation/evidence-only commit after runtime, with no runtime-source difference or redeployment requirement.

The root workspace remains detached at `051f23b` to preserve overlapping local research/receipts; it is not canonical HEAD. This continuity candidate reuses `.worktrees/web-push-ga` on local branch `docs/continuity-refresh-20261021`, based on `64ded3e`; no main/dev promotion or push is included. Reinspect rather than infer branch state from a directory name. TenDev branding does not prove backend isolation; the GA receipt records the shared Supabase project and distinct rollout flags.

## Canonical domains and routes

- `/` and `/production`: Production Dashboard/Pipeline with Overview, Table, Timeline, Inspector, planning readiness, attachments, activity, scheduling, archive/restore, Job Updates, and job-scoped Planning.
- `/inventory` and `/activity`: Inventory, reservations, Pending Receivals, receipt/undo lineage, and Inventory Activity.
- `/purchasing` and `/catalog`: Purchase Orders, immutable issuance/PDF pipeline, Vendor configuration, Vendor Catalog, and PO-to-Pending-Receival projection.
- `/manpower-reporting` and `/material-usage`: distinct operational reporting streams linked to canonical Jobs or permitted temporary work identity.
- `/proposals`: Proposal generator plus generic Proposal workspace/creation.
- `/transmittals`: explicit Job-linked or standalone Letter of Transmittal entry and immutable document history.
- `/my-work`: private/shared tasks, estimated effort/workload, attachments, Inbox, Inbox attachments, release communications, private typing authorization, and Admin lifecycle cleanup.
- `/settings`: account/administrative settings and Toolbox entry points supported by the current shell.
- `/contacts`, `/pre-production` (Bids) and `/samples`: shared Contacts, accepted Bids Early Access, and existing Sample/document workflows; broader lifecycle or collaboration activation requires its own accepted scope.
- `/transactions`: legacy route outside primary navigation.

## Canonical Production Job boundary

`public.jobs` is the one canonical Production Job entity. Its UUID anchors Production scheduling and planning, reservations, labor, material usage, documents, attachments, activity, and related operational context. Names and business numbers are mutable presentation attributes, not relationship keys.

Pre-Production must not create pseudo Jobs or reserve Job numbers to stand in for a Bid. Current confirmed direction is one Bid entering Production maps 1:1 to one canonical Production Job, with deposit receipt the known practical gate; exact lifecycle and transfer semantics remain Product decisions.

## Implemented architecture

- Production scheduling uses staged proposals and an atomic batch boundary; Planning phases/items and execution progress remain job-scoped.
- Inventory preserves canonical-or-temporary reservation identity through receiving and history. Undo Receive is lineage-aware and audit-preserving.
- Purchasing owns structured drafts, immutable issuance snapshots, retryable private PDFs, Vendor data, Vendor Catalog pricing, and guarded projection into Pending Receivals.
- Material Usage and Manpower remain separate facts and use canonical Job links where available; reporting groups are not Jobs.
- Proposal and Transmittal document domains are implemented. Job-linked LoTs derive identity from canonical Job Numbers; explicitly standalone LoTs remain unlinked and require a manual document number. Issued artifacts are historical snapshots and must not be silently rewritten after later Job/Bid relationships change.
- My Work and Inbox are participant/private domains. Task estimated effort supports workload views; attachments and typing/Realtime authorization preserve private boundaries.
- Admin lifecycle cleanup exists but does not grant routine private-content reading authority.
- Job Update collaboration, assignment, editing, deletion, mentions/notifications, seen state, and Production rework cycles are implemented.

## Security and migration state

Supabase Auth/RBAC infrastructure and later compatibility/enforcement work exist, but security conclusions require inspection of actual policies, grants, functions, Storage, and Realtime behavior. Do not resurrect older descriptions of the app as solely anonymous/client-gated, and do not assume every surface has reached the same least-privilege maturity.

The repository includes later Bid, Sample, Messaging and Web Push migration families beyond the original Proposal/My Work/Inbox foundation. File or ledger presence is not proof of hosted application. Use the exact scoped receipt and inspect required objects/grants/behavior when needed; applied migration files remain immutable. This refresh independently checked Git and Cloudflare only, not Supabase.

`supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql` is superseded and must never be applied wholesale.

## Active scope, accepted work and deferred boundaries

| Work | Status and next boundary |
| --- | --- |
| Continuity refresh | **Accepted structure**, implemented locally in `e0d4884`. This follow-up only reconciles Current State and release references with fresh Git, Cloudflare and public served-byte observations. No application work, main/dev promotion or release authorized. |
| Mobile UI, Contacts and Web Push | **Accepted and deployed** within the canonical runtime above. GA includes the earlier accepted UI/release boundaries; consult the [executed GA receipt](2026-10-21-web-push-general-availability.md#executed-release) for the runtime boundary. The [mobile navigation](2026-10-21-mobile-nav-announcement-retirement.md) and [mobile polish](2026-10-21-mobile-responsive-polish-review.md) records describe their earlier candidate stages, not deployment proof. Per-release receipts remain historical snapshots, not claims that each old SHA is today's global runtime. |
| Group Messaging | **Proposed next workstream**; no implementation/acceptance contract is supplied by this continuity refresh. Product scope, privacy and acceptance remain the next decision. |
| Bids collaboration/reminders | Accepted Early Access UI is closed; collaboration backend, attachments, tasks and reminder activation are **deferred**, with a preserved implemented candidate. [Bids closure](2026-10-13-bids-workstream-closure.md) owns the exact split and future gates. Its former temporary worktree paths are historical; branch refs survive housekeeping. |
| Further Bid/Sample lifecycle work | **Proposed/unresolved** beyond later scoped approvals. Reuse existing domains and read the relevant dated contract; the general hold in AGENTS/[Open Questions](OPEN_QUESTIONS.md) remains for new semantics. [Batch-first authority](2026-10-01-sample-batch-first-authority.md) is an example of a focused superseding decision, not a new release authorization. |

An unmatched branch does not establish active priority, Product acceptance or missing deployment. The October 21 housekeeping pass preserved all 126 local branches and existing checkouts; 24 stale registrations were retired reversibly, leaving 64 registrations including three deliberately deferred invalid/missing entries. Reinspect the current inventory before reuse; no further cleanup is authorized by this document.

### Known limits and historical status corrections

- The GA record leaves the historical intermittent worker failure cause unproven; diagnostics are deployed. This is not a fresh claim of an active incident or permission for speculative timeout/retry changes.
- The old September 25 “pending Messaging V1.1” heading is superseded as a current-status label: canonical Git contains implementation commit `1ff0a13` and the deployed runtime contains its client descendants. Keep the [original candidate report](2026-09-25-messaging-v11-candidate.md) as dated evidence; no fresh hosted migration verification is implied.
- Older mobile/PWA-abandoned, Sample-not-implemented and Auth/RBAC-deferred descriptions are historical. Preserve their dated rationale while following subsequent scoped acceptance and actual implementation evidence.
- Physical-device acceptance and hosted privacy/role guarantees must be attributed to the applicable receipt. Synthetic bundle fixtures do not establish new live-account, RLS or physical-device acceptance.

## Receipt retention completed October 21

Fourteen completed October 19–21 release report/JSON pairs and the superseded mobile-navigation stopped pair are now retained unchanged at their existing project-memory paths in local branch `docs/source-control-hygiene-20261021`, based on canonical `4f0228f`. The [completed mobile polish receipt](2026-10-21-mobile-responsive-polish-release.md) and [completed navigation receipt](2026-10-21-mobile-nav-release.md) retain their historical runtime boundaries. Their earlier local/uncommitted wording describes those releases, not current retention. This hygiene pass commits locally; main/dev promotion and push are separate actions.

The stopped Mobile Early Access preflight is retained. The attachment/OCR investigation is represented by [anonymized findings](evidence/2026-10-20-production-job-blend-attachments.json); its exact raw original, including business identifiers and Storage/download paths, is preserved privately with restoration metadata in the original workspace's `.git/private-archives/2026-10-21-source-control-hygiene/`, outside versioned content. The housekeeping review is retained as dated recovery history. The architecture duplicate reuses the [already canonical record](2026-10-20-ios-web-push-architecture.md).

The [research archive and retention receipt](../audits/retained-2026-10-21/README.md#source-control-retention-receipt) links all audit packages, while its manifest accounts for the original 267 files. Earlier research versions are isolated from the nine existing canonical prototype files. Original copies were removed only after committed/private SHA-256 verification; only two unreferenced, reproducible ZIP wrappers were discarded. No application source, historical evidence, research worktree, deployment, Supabase state or ignore policy changed.

## Durable references

- [AGENTS](../../AGENTS.md): authority, authorization and preservation rules.
- [Project Manifest](../project/PROJECT_MANIFEST.md): Product Canon and architecture.
- [Execution standard](../project/ENGINEERING_EXECUTION_STANDARD.md): handoff/workflow and proportionate checks.
- [Open Questions](OPEN_QUESTIONS.md): unresolved decisions and dated exceptions; not a release ledger.
- [Documentation index](../README.md): focused workflow/schema/architecture references; Blueprint and Learnings retain rationale and observations.

## Released Messaging groups/replies — 2026-10-22

[Groups and replies release record](2026-10-22-messaging-groups-replies-candidate.md#executed-release--2026-10-22) records accepted creator-managed groups, member-private history/attachments, per-user unread state and same-conversation replies, released to TenDev then TenOps at runtime `17299e2f48d24c097f03822529a974955fd5dc3f`. Migrations `20261022120000`, `20261022130000` and corrective `20261022140000` were applied atomically in order; hosted removed-sender body/manifest/status/edit, attachment metadata/Storage signing eligibility, and DM isolation/immutability probes passed with rolled-back fixtures. Both runtime exports and mobile auth gates passed focused deployment checks. Web Push aliases are TenDev v27 and TenOps v16; normal device opt-in, authorization, previews, Production transport/Cron and disabled TenDev transport are preserved. Chris accepted the existing 600-second attachment-URL expiry after removal; new signing eligibility is denied immediately. One transient worker 503 was followed by seven successful sweeps and pending=0. Physical iPhone/group-delivery acceptance is pending Chris's own post-release test. See the record for exact deployment IDs, evidence, limitations and rollback refs; its earlier blocked-preflight sections are retained history.

## Web Push registration reliability — October 22 local candidate

[Local correction and focused evidence](2026-10-22-web-push-registration-reliability.md) on dev separates transient auth verification suspension from deliberate push revocation, keeps protected access fail-closed, and adds truthful Settings verification with owner-scoped endpoint identity checks. Forward migration `20261022160000` is prepared, not applied. Validation: 24 controller, 5 local database and 12 selected actual-component browser groups; TypeScript, targeted lint, diff and isolated build passed. Read-only Production status at 2:14 p.m. Chicago shows Chris/Patrick/Marcos/Gio/Anthony each with one healthy active generation-1 device, previews on; transport/Cron unchanged. Implemented and committed locally only; no push/deployment/hosted mutation. Product release approval remains the next gate.
