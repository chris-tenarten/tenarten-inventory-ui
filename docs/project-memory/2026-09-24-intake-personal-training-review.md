# Personal Intake TEST workflow — local review

Status: implemented locally on normal `dev`, within the existing uncommitted Intake polish boundary. Base remains `1aa6e27dfc3e26ee3c8f3c9ee7e7e082d76846ad`. No hosted mutations or migration application, no commit/push/deployment. Prior [Planning polish review](2026-09-24-intake-polish-review.md) remains applicable except for the expressly approved personal-training exception below.

## Authoritative model and capabilities

`intake_training_grants` contains a named `managePersonalIntakeTest` entitlement for specific active users. It is separate from role-wide `accessIntake` and does not change `has_app_capability` or unrelated role grants. Initial migration resolves Patrick Soldow, Giovanni Coppola and Anthony Iorio by exact display name and fails unless each resolves to exactly one active account. Fresh hosted read-only inspection found all three uniquely, each currently Lead. No application code or policy contains their UUIDs. Trusted administration can deliberately grant/revoke this entitlement later; no new grant-management UI is included.

`intake_training_workflows` is the authoritative owner → Bid → optional canonical Production Job registry. Owner is its primary key; Bid and Job IDs are unique foreign keys. Client roles cannot insert/update/delete registry or grant rows. Creating a personal TEST Bid locks the active user and creates Bid plus registry in one transaction. A second concurrent creation fails. Lost or converted records retain the slot until explicitly reset; changing a name or stage never releases it or changes its security classification.

Existing Chris-owned curated demos have no registry entries and acquire no training privileges. A normal Bid named TEST is still normal. Owner/creator cannot be changed for registered training Bids. A visible TEST prefix is maintained independently of authority. Job identity is separately protected.

## Final matrix

| User | Intake read | Ordinary Intake writes | Personal TEST workflow | Real Production |
| --- | --- | --- | --- | --- |
| Admin | Yes | Existing | Can manage/clean existing TEST workflows; initial personal-create entitlement is only for the three named trainees | Existing independent guards |
| Developer | Yes | Existing | No automatic training grant or cleanup privilege | No new create/convert/delete authority |
| Pat / Gio / Anthony | Yes | Read-only unless independently granted management | Own one Bid: edits, Updates, files, Planning, conversion and guarded cleanup | Existing Lead capabilities only; no raw permanent deletion |
| Other active Lead / Member / Guest | Yes | Read-only unless independently granted | None unless explicitly granted later | Existing capabilities |
| Anonymous / inactive | No Intake access | No | No | Anonymous direct Jobs access revoked; no training access |

Updates use the normal append behavior; this does not invent an Update-edit API. Existing Proposal/Sample management is not granted by training.

## Conversion and numbering

Uses the existing `convert_bid_to_production` RPC, Bid serialization/retry behavior, Won + saved deposit gate and carry/new/unscheduled date choices. Only an authorized personal owner receives the narrow exception to general conversion/scheduling capabilities for that Bid. Ordinary conversions still require existing capabilities. Developer access alone still cannot convert.

The converted record is a real canonical `public.jobs` row with protected training lineage. Its number is deterministic `TEST-<Bid UUID>` (canonical casing), outside normal operational numbering; arbitrary numbers are rejected for training conversion. No sequential Production number is allocated or consumed. TEST names/numbers keep these rows visually identifiable in existing Production surfaces.

Inspected conversion/scheduling code and installed Jobs/activity triggers create only the Job, explicit initial schedule batch/activity, and Bid conversion history/relationship. No customer communication, external integration, purchasing, inventory, Proposal/Sample or notification action is called by this path. Disposable checks verify notification, Inventory, Proposal and Sample counts remain unchanged. No hosted TEST conversion was performed.

## Narrow Production hardening

Fresh hosted inspection found permissive legacy Jobs policies plus effective SELECT/INSERT/UPDATE/DELETE privileges for both `anon` and `authenticated`. Chris explicitly approved narrowing this boundary in this pass. The superseded broad RBAC migration is not applied or copied wholesale.

The corrected migration retains the separately approved denial of direct anonymous Jobs access and authenticated raw DELETE. It **does not add authenticated INSERT/UPDATE policies, change their grants, or impose new capability checks on normal Job edits**. Normal Jobs return immediately from the TEST identity trigger; their existing authorization remains authoritative. No role capability is granted to repair the regression.

For registered TEST Jobs, existing Production editing authority remains valid alongside the narrow owner conversion/reset path. Ordinary Production authority does not authorize another user's TEST Intake edits or cleanup. The trigger only preserves registered TEST ID/number and visible labeling; protected lineage remains private to the RPC workflow. Existing dependency-aware Admin deletion RPCs and service-role tooling remain compatible. This is not a platform-wide RBAC cutover.

The blocked version incorrectly required `editProductionJobDetails` for Member Requested delivery edits. Its new UPDATE policy admitted the Member through `editProductionJobRoutine` (including the implicit WITH CHECK); the added trigger was the source of 42501. Current hosted Jobs have table-wide authenticated UPDATE and no column-specific ACLs. Removing that overreach, plus the unnecessary general INSERT/UPDATE restrictions, preserves the captured Production contract without changing UI controls.

## Cleanup and recovery

The Intake inspector shows a personal TEST section. Delete the converted TEST Job first, remove Bid attachments using the existing Files lifecycle, then Delete / Reset Test Bid. Typed confirmation is `DELETE TEST`. A successful reset releases the slot. The normal Admin deletion action is hidden for personal TEST Bids in favor of the guarded path.

Cleanup locks the Bid, registry and Job; verifies reciprocal conversion lineage; refuses Proposal/Sample/shared-file relationships; and inspects all foreign keys referencing the Bid/Job. Unknown future dependencies, even CASCADE/SET NULL relationships, block cleanup. Job attachments, labor, reservations, purchasing, Updates, planning phases, Rework and other operational dependencies require Admin review. Only the initial exclusive conversion/schedule history is removable; later/shared schedule batches or additional activity block self-service cleanup. Deletion audit rows are deliberately retained. Missing/incomplete history metadata fails closed.

Bid attachments are not silently cascaded or deleted through SQL. They must finish the existing Storage removal lifecycle before Bid reset. Incomplete uploads or dependencies that cannot be cleared normally require review. A cleanup error rolls back SQL changes. A revoked entitlement leaves its existing workflow available for Admin recovery rather than silently deleting it.

## Migrations (prepared, not applied)

1. `20260924180000_intake_view_access.sql` — all-active-role Intake reads, existing writer separation. SHA-256 `943beeeff7b392e64487e2c0156b9836a7f8a2e887b603361b0c564c69760bbe`.
2. `20260924190000_intake_personal_training.sql` — protected grants/lineage, scoped RPC/Storage authority, creation/reset, narrow Jobs hardening. SHA-256 `0da1d801ac95f78878c3f80289a798eb53ec4ec59deac99f725ea0432e74f30a`.

Applied migration files are unchanged. The unapplied training migration was corrected after the blocked gate; its previous d3df7398 hash is superseded. Mutation RPC replacements guard the freshly captured installed function definitions before replacement, retaining signatures, ownership, grants and security attributes. No historical business rows are rewritten. The new migration inserts only the three explicitly authorized configuration grants when eventually applied.

## Validation and review limits

Level 3 because this changes database authorization and canonical-record cleanup/conversion. `scripts/verify-intake-view-access.mjs --baseline-dir=<approved capture> --training` runs disposable PostgreSQL only, including the existing read/write/Storage matrix plus `scripts/fixtures/intake-personal-training.sql`:

- Own creation/edit/Updates/files/projected dates and Won/deposit conversion; second creation and simultaneous creation denied.
- Gio cannot edit Pat's Intake Bid, remove its files or use personal cleanup on his TEST Job; Anthony independently creates. Gio retains existing ordinary Production editing rights on the TEST Job, with its immutable TEST identity preserved.
- Real/curated Bids stay read-only, renaming cannot transfer training ownership, registry spoofing denied.
- Authoritative Job lineage, separate number and carried dates; own cleanup/retry; Admin cleanup.
- Added synthetic CASCADE dependency blocks cleanup; raw normal Job deletion denied.
- Thirty-five before/after normal-Job cases across Admin/Developer/Lead/Member/Guest match exactly, including Member Requested delivery, reads, inserts, routine/details edits, dates and archive. Jobs policies and role-capability assignments are unchanged. Normal Bid conversion still retains its separate Production capability gate; Developer cannot bypass it.
- Anonymous and ungranted accounts denied; original real Job and eight synthetic curated Bids preserved.
- Notification, Inventory, Proposal and Sample counts unchanged; no training workflow residue after cleanup.

Focused headless fixtures cover role-derived controls and own-Bid Planning, along with existing pan/zoom/Today/Fit and Combined vertical framing. TypeScript, targeted ESLint, diff checks and Production build passed. Ten focused role/Planning/Fit checks passed; the corrected personal-training selector check and the light/dark responsive badge check then passed (two tests). The initial training test failure was a label-selector mismatch; the captured Owner control was correctly disabled. A sandbox-blocked Turbopack CSS worker required rerunning the final build with local-port permission; that build passed. No visible Chrome or broad unrelated suites.

Hosted schema/identity inspection was read-only. Neither migration is installed, so actual Lead/Member/Guest hosted Intake reads and personal TEST actions are not available yet. Localhost can review the already-working Admin/Developer polish; training lifecycle/roles are currently demonstrated by disposable/headless fixtures. Hosted application requires separate authorization and a current compatibility gate.

All width/controls/Combined Fit/UNDER DEVELOPMENT work and the blue-light/red-dark Today line are preserved. The existing unrelated 768px global-header overflow noted in the previous review remains outside this scope.


## Workspace handoff

All work remains uncommitted on `dev`. Application changes extend `BidWorkspace`, `BidPlanningCard` and `IntakePlanning` with `training.ts`; supporting changes add the training migration and disposable fixture and extend the existing authorization runner/headless fixture. Existing demo tooling remains untouched. The unrelated untracked `docs/project-memory/2026-09-24-denton-task-regroup.md` appeared during this pass and was not edited or included in the Intake boundary.

No remaining Product decision blocks this local implementation. Production numbering uses the separate deterministic TEST namespace described above. A fresh hosted release gate and explicit migration/release authorization remain required; passing disposable tests is not hosted application evidence.


## Correction validation

Focused Level 3 replay with the previously captured current Production definitions passed: 35 normal-Job operation pairs, unchanged Jobs policies/role assignments, personal ownership/one-workflow concurrency, file lifecycle, conversion/Won/deposit/retry, normal conversion with Planning, guarded cleanup and service-role compatibility. No application source or UI controls changed in this correction; prior TypeScript/lint/build/headless evidence is reused. Detailed correction evidence is in `output/intake-production-gate-20260924-correction/REPORT.md`. The old blocked report remains historical evidence; this correction does not authorize hosted application or release.
