# Current State

Dated snapshot: **October 21, 2026, 3:36 p.m. America/Chicago**. Reinspect relevant Git and hosted facts before acting. This is an index of status and evidence, not a transcript or a new source of Product authority. Status meanings and the compact handoff are in the [execution standard](../project/ENGINEERING_EXECUTION_STANDARD.md#compact-handoff-and-status).

## Independently verified release boundary

Fresh `git fetch origin --no-prune`, `git ls-remote origin refs/heads/main refs/heads/dev` and local ref inspection agree:

| Boundary | Verified revision / observation |
| --- | --- |
| Local `main`, `dev`, fetched `origin/main`, `origin/dev`, live remote heads | `64ded3e845b62ed3cbf59f90ab2f99ad20f2c1cc` |
| TenDev canonical Pages deployment (`dev`) | `bc73f0d1-4938-4d75-b825-fb16b87ec31d`; runtime `c99316c1ec30463c40333a3f725857b0de6eb9f8`; success |
| TenOps canonical Pages deployment (`main`) | `20538973-44e1-4d9e-87bf-52b0b0b66ab1`; runtime `c99316c1ec30463c40333a3f725857b0de6eb9f8`; success |

Both projects were queried directly through the Cloudflare project API at **20:36 UTC**. This is fresh control-plane evidence, not a new browser/served-byte or hosted database audit. Git comparison confirms `64ded3e` is one documentation/evidence-only commit after `c99316c`; no runtime-source difference or redeployment requirement follows from that gap. The [Web Push GA receipt](2026-10-21-web-push-general-availability.md#executed-release) retains the release's served-byte, worker and migration evidence; those historical checks were not rerun here.

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
| Continuity refresh | **Accepted approach; implemented documentation candidate**, awaiting review of this local commit. Only the five existing entry-point documents change. No application work or release authorized. |
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

## Local receipt retention reviewed October 21

Fourteen completed October 19–21 release report/JSON pairs add deployment, rollback and verification closure beyond canonical candidate reports. They remain preserved **locally in the detached root**, pending selective adoption and publication review; they are not portable links from this committed candidate. The fifteenth pair, `2026-10-21-mobile-nav-release-stopped`, preserves the stopped checkpoint and links to its completed release. No receipts/evidence were added or deleted in this refresh.

Also preserve the unlinked `2026-10-20-mobile-early-access-release-preflight.json` stopped gate and `2026-10-20-production-job-blend-attachments.json` investigation; the latter contains business document metadata/storage paths and needs sensitivity review before repository adoption. The local housekeeping review retains recovery details and qualified disk results without being copied wholesale here. The root's untracked `2026-10-20-ios-web-push-architecture.md` is byte-identical to the [canonical architecture record](2026-10-20-ios-web-push-architecture.md); reuse that version rather than adopting another copy.

## Durable references

- [AGENTS](../../AGENTS.md): authority, authorization and preservation rules.
- [Project Manifest](../project/PROJECT_MANIFEST.md): Product Canon and architecture.
- [Execution standard](../project/ENGINEERING_EXECUTION_STANDARD.md): handoff/workflow and proportionate checks.
- [Open Questions](OPEN_QUESTIONS.md): unresolved decisions and dated exceptions; not a release ledger.
- [Documentation index](../README.md): focused workflow/schema/architecture references; Blueprint and Learnings retain rationale and observations.
