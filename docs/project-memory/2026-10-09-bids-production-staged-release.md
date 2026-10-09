# Bids Early Access — controlled Production frontend release

## Authorization and reconciliation

Chris's latest explicit decision authorizes Production at https://tenops.pages.dev, superseding the interim TenDev direction. Accepted candidate: `8ac1dba42e09c8f7045aefeec93cb305569d7c6a`. Fetched canonical main/dev and the served Production SHA were `095f3215d4a57c7439aa974e59a617f54ccdeba9`. Release preserves the accepted Inspector/Planning foundation `a62508429059f5a505e0b25da64cf65152108f8d`, adds an isolated non-saving preview, and corrects pointer-drag Escape focus. No wholesale dev merge, history rewrite or experimental candidate promotion.

## Enabled / deferred boundary

A — functional: guarded Inspector dismissal, draft protections, focus restoration/body scroll lock, Planning zoom reset, compact/comfortable density, proposed dates, drag cancellation and existing planning persistence. Existing Bid editing, historical Updates/body-only posting, Bid files, conversion and Proposal relationships keep their original backend contracts. Bids retains EARLY ACCESS.

B — preview only: interactive mention selection, Update attachment affordances, Bid task title/description/assignee/due-date configuration and task attachment affordances. Separate labeled panels state “Not Yet Available — preview only” and explicitly explain no save/upload/send. All submission/upload actions are disabled. Preview suggestions reuse already-visible Bid owners; they do not claim future recipient eligibility. The existing body-only Update composer stays functional and separate. No simulated success.

C — preview only: due/advance reminder configuration, showing 8:00 a.m. America/Chicago / DST. No dispatcher or cron installed/enabled. Timezone configuration remains backlog.

Transactional collaboration remains available only in the isolated local candidate at http://localhost:3108/pre-production?bidId=10000000-0000-4000-8000-000000000001. The complete backend candidate remains preserved on `feature/bids-crm-ux-overhaul`.

## Individual migration review — none included or applied

| Draft migration | SHA-256 | Review / disposition |
| --- | --- | --- |
| 20261009100000_bid_update_collaboration.sql | 7181c4751f3e2f693366915f00952191a0cdf3d504fe3a2510087b9381d47e98 | Adds identity/file associations, collaborator/create RPCs and generic deduplicated notifications. Local checks pass; full hosted runtime compatibility/authorization gate not completed. Deferred with dependent UI. |
| 20261009101000_bid_my_work_context.sql | 16eb9f9ee31d50018db3d84adb42ba3fca64881b143b0479887e4fde62dd1d7d | Extends shared work_tasks, replaces shared create/edit/finalization and patches listing. A focused repository replay is not full hosted compatibility proof; stop this activation rather than risk current My Work. Deferred. |
| 20261009102000_bid_task_reminders.sql | be9c81db5b174c390aafccc6856c9b30a07e223cab8a15e8631b9d58746546aa | Service-only DST-aware idempotent dispatcher. Depends on deferred task schema and verified scheduler. Deferred. |

Hosted read-only inspection confirmed all three absent, new RPCs absent, existing My Work RPC signatures installed, private bid-files/my-work-attachments/job-attachments buckets, participant task/attachment policies, restrictive Intake Storage policy and self-only account notification reads. Only existing `tenops-messaging-abandoned-drafts` cron (17 * * * *) was present. No reminder scheduler. No migration, Edge function, cron, bucket, grant, policy or business record was changed. No pending migration batch was applied. No Material Readiness or Inventory mapping migration included.

## Downstream regression evidence

Risk Tier 2 / Testing Level 2 for the released frontend subset. Full candidate remains Tier 3 and local. `verify-bids-staged-release.mjs` proves byte-identical source versus canonical for My Work, AccountNotifications, all Production code (including @mentions and Job attachments), Bid queries/types, Bid Proposal card, Proposals, auth, branding configuration and all Supabase migrations/functions/operations. Thus existing assignment/completion, notification contracts, attachment retrieval/upload contracts, conversion, Proposal relationships and Intake permissions receive no implementation changes.

Focused exported-app browser verification passes guarded dismissal/drafts/focus, mobile, planning zoom/density, drag cancellation including checking preview disappearance before pointer-up, historical Update reading and existing body-only Update posting, existing Bid save RPC, preview mention selection/task inputs and disabled buttons. It rejects new collaboration RPCs and Storage requests. All API traffic is intercepted; no hosted business records created or modified. An initially weak cancellation assertion observed no write before an async write arrived; the extended assertion caught the focus issue and the corrected final check passes.

Shared Production mention composer reconstruction and Intake Planning model checks pass. TypeScript/production webpack build, targeted ESLint, diff check and branding verifier pass. No unrelated Sample/Inventory/Reporting/Blend suites ran. Real hosted assignment, completion, upload/download, conversion and Proposal mutation smoke remain manual on legitimate user work; source/schema continuity checks are not claims of live transactional tests.

## Branding and deployment gates

Isolated worktree `/private/tmp/tenops-bids-early-access-release`, verified Pages project `tenops`, production branch `main`, publish directory `out`. Build consumes existing Pages Production public environment in memory, asserts backend `vxdxjhazkqhpkwdqtobp.supabase.co`, explicitly sets `NEXT_PUBLIC_DEV_BRANDING=false` and `CF_PAGES_URL=https://tenops.pages.dev`. `.env.local` is absent. No credentials stored in this report. Local rendered build verified TenOps / OPERATIONS CONTROL with zero development branding nodes; screenshot `/private/tmp/tenops-bids-built-branding.png`. Existing branding resolver and verifier remain unchanged.

Only frontend export and release verification/docs are promoted. Material Readiness, Inventory mapping, Samples, Geometry and performance candidate work remain excluded and untouched. Final deployment SHA/served export and hosted branding are checked after promotion, with evidence outside the commit in `/private/tmp/tenops-bids-production-release-result.json`.

## Exact code/test file boundary against canonical

- src/modules/pre-production/BidWorkspace.tsx
- src/modules/pre-production/BidPlanningCard.tsx
- src/modules/pre-production/IntakePlanningTimeline.tsx
- src/modules/pre-production/BidCollaborationPreview.tsx
- scripts/verify-bids-inspector-planning-browser.mjs
- scripts/verify-bids-staged-release.mjs

Documentation: this report and the historical local increment record `2026-10-09-bids-crm-ux-overhaul.md`. The latter is an archived checkpoint superseded by subsequent authorizations, not current release status.
