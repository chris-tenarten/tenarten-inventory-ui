# Bids CRM workstream closure — accepted Early Access release

Decision date: 2026-10-13, America/Chicago. Authority: Chris's explicit “BIDS CRM WORKSTREAM CLOSURE” instruction.

## Closed and accepted

The Bids UI/UX workstream is closed at its accepted staged Early Access Production release, commit `4597d804608622d47ee584e2b05db4f8c36af1ea`. Completed: Bid Inspector UX parity, Planning View interactions, existing Bid editing/Updates compatibility and Early Access presentation. This identifies the accepted Bids release boundary, not a claim that it remains the latest global Production SHA. No hosted reinspection was needed for this documentation-only closure.

This decision supersedes earlier instructions to proceed toward backend activation. It authorizes no additional Product changes, migrations, backend deployment or reminder activation.

## Preserved local candidate and evidence

- Collaboration candidate: `8ac1dba42e09c8f7045aefeec93cb305569d7c6a`.
- Branch: `feature/bids-crm-ux-overhaul`.
- Worktree: `/private/tmp/tenops-bids-crm-ux-overhaul`.
- Candidate includes the accepted Inspector/Planning foundation `a62508429059f5a505e0b25da64cf65152108f8d`.
- Release branch/worktree: `release/bids-early-access-staged`, `/private/tmp/tenops-bids-early-access-release`, commit `4597d804608622d47ee584e2b05db4f8c36af1ea`.
- Candidate evidence: `docs/project-memory/2026-10-09-bids-crm-ux-overhaul.md`, `scripts/verify-bids-crm-backend.mjs`, `scripts/verify-bids-crm-browser.mjs`, `scripts/support/bids-crm-database.mjs`, local review tooling and `supabase/operations/bid-reminders/README.md`, all preserved with the candidate.
- Release evidence: `docs/project-memory/2026-10-09-bids-production-staged-release.md` and staged-release/browser verifiers, preserved with the release commit. Historical served-export verification also resides at `/private/tmp/tenops-bids-production-release-result.json`; temporary artifacts are supplementary, not the sole durable evidence.

Candidate HEAD and a clean candidate worktree were verified during closure. No candidate files, branches or worktrees were deleted, merged, cleaned or rewritten. Other experimental worktrees and unrelated dirty work were left untouched. Local server availability is not asserted by this closure.

## Deferred Product backlog — not activation-authorized

All of the following are formally deferred: Bid Update @mention activation; Bid Update attachments; Bid-linked My Work tasks; task attachments; advance/due-date reminders; all three draft backend migrations; reminder scheduler activation. Production collaboration remains explicitly preview-only at the accepted release boundary; no persistence success is simulated.

| Draft migration | Preserved SHA-256 |
| --- | --- |
| `20261009100000_bid_update_collaboration.sql` | `7181c4751f3e2f693366915f00952191a0cdf3d504fe3a2510087b9381d47e98` |
| `20261009101000_bid_my_work_context.sql` | `16eb9f9ee31d50018db3d84adb42ba3fca64881b143b0479887e4fde62dd1d7d` |
| `20261009102000_bid_task_reminders.sql` | `be9c81db5b174c390aafccc6856c9b30a07e223cab8a15e8631b9d58746546aa` |

Future activation dependencies, to revisit only under a new Product decision:

1. Reconcile the preserved candidate against then-current canonical code and hosted schema. Review each migration independently, verify exact checksums, dependencies and data preservation; never apply a general pending-migration batch.
2. Complete focused hosted compatibility gates for existing My Work Job tasks, assignment/completion, notifications, Production mentions, attachments, historical Bid Updates, conversion and Proposal relationships. The focused local database replay is not full hosted compatibility proof.
3. Verify effective RLS/grants and Storage retrieval/upload authority for active, inactive, read-only, unauthorized and participant identities; preserve Intake scope and task privacy without an administrative content-reading bypass.
4. Reconfirm atomic creation/edit/finalization, retry-safe mention/task creation and partial attachment recovery. Bid tasks must remain independent of a fabricated Production Job, and cleanup must preserve private task content/files.
5. Verify hosted service-only dispatcher and actual scheduler configuration before reminder activation. Require deduplication under concurrent retries, current recipient authorization, completion/cancellation/reassignment handling, due-date changes and DST tests. Delivery contract: 8:00 a.m. America/Chicago; configurable timezones remain backlog.
6. Obtain fresh explicit approval for the exact migration/application, backend deployment, scheduler and Production activation boundary. Preserve isolated Production build, excluded `.env.local`, explicit `NEXT_PUBLIC_DEV_BRANDING=false`, branding verifier and hosted TenOps / OPERATIONS CONTROL verification.

Dependencies between drafts: My Work extension uses collaboration authority helpers; reminders depend on the task extension. Scheduler activation is a separate operational dependency and decision. None of these deferred requirements blocks closure of the accepted UI/UX workstream.

## Closure verification

Documentation-only Tier 1: inspected Git/worktree state and preserved artifacts/checksums; reviewed this record and checked formatting. No application build or regression suite was run. No hosted migrations, backend components, reminders, business-data mutations, pushes or deployments occurred during closure. Stop after recording closure.
