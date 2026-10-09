# Bids CRM UX overhaul — local increment and backend boundary

Historical checkpoint, superseded by backend authorization and the [controlled Production frontend release](2026-10-09-bids-production-staged-release.md).

Status at this checkpoint: partial local candidate; full overhaul is not complete or release-ready. No push, deployment, hosted mutation, or migration application authorized/performed.

## Authority and baseline

Chris's October 9 kickoff authorizes local implementation and local candidate commits. It explicitly preserves lifecycle/conversion semantics and requires stopping at genuinely new schema/permission/hosted boundaries. It overrides the general lifecycle implementation hold only for the stated UX/collaboration scope; no lifecycle redesign is inferred.

Fetched origin/dev and origin/main both resolve to `095f3215d4a57c7439aa974e59a617f54ccdeba9`. Dedicated branch: `feature/bids-crm-ux-overhaul`; worktree: `/private/tmp/tenops-bids-crm-ux-overhaul`. Existing Material Readiness worktree/candidates and original untracked research remain untouched.

## Implemented independent increment

- Bid Inspector follows Production's guarded dismissal and focus-loop conventions. Backdrop dismissal requires targeting the backdrop itself; inside interactions remain open. Escape, focus restoration, body scroll lock, and browser unload protection are included. In-flight writes prevent dismissal.
- Unsaved Bid fields, Update text, and planning dates require discard confirmation. Leaving Overview protects its planning draft. Planning save refreshes its own authoritative record without replacing unrelated unsaved Bid fields. Ordinary Bid refresh preserves the planning draft. Explicit planning refresh confirms discard.
- Planning retains existing movement/edge-resize persistence and adds center-preserving default zoom, compact/comfortable rows, proposed-date preview, selected drag ring, and cancellation on lost pointer capture. Existing date math, stale-write protection, conversion, Production scheduling, relationship navigation, colors, permissions and branding are retained.

## Repository evidence for backend boundary

- `src/modules/pre-production/queries.ts`: `create_bid_update(uuid,text)` and `list_bid_updates(uuid)` carry body/author/date only. `uploadBidFiles` already uses canonical file metadata, private `bid-files` Storage, 25 MB limit, staged upload/finalization and cleanup. `createBidFileUrl` requests a short-lived signed URL.
- `src/modules/production/components/JobUpdatesPanel.tsx` and `JobUpdateMentionTextarea.tsx`: reusable mention/composer behavior exists. Job attachment metadata associates attachments with Job Updates. Bid-specific authorization must be maintained rather than passing fake Job IDs.
- `supabase/migrations/20260831_021_my_work_task_estimated_time.sql`: both complete-create and edit RPCs explicitly reject context types other than `job`. `20260827_012_my_work_mvp.sql` also constrains the table to Job context. Listing is private to task participants, including in security-definer RPCs.
- No due/advance task reminder dispatcher was found in repository migrations/functions. Messaging cleanup has an operational cron pattern in `supabase/operations/messaging/cleanup-setup.sql`; it is not a reminder scheduler.
- These findings concern repository state. Hosted schema, policies, grants and Storage have not been inspected or claimed verified.

## Proposed narrow backend extension for review

Prepare append-only migrations locally, with separate independently testable boundaries:

1. **Bid Updates collaboration.** Add `(update_id,user_id)` mention associations and link existing canonical Bid files to Updates. Verify Update and file belong to the same Bid and active/ready file relationship. Reuse current mention tokenization and authorized user identities. An atomic create RPC validates actor, Bid management, recipients' Intake access, selected mention IDs and file IDs before writing. Preserve the old body-only RPC signature as a compatibility entry point. Notify through existing `account_notifications` with dedupe keys based on Update + recipient; resolve Bid context through the existing notification client. Signed Storage access remains under existing Bid authority; do not add public URLs or broaden bucket policies. Historical Updates remain valid with empty associations. Existing file removal and Bid deletion must handle the new association without dangling metadata or unnecessary file duplication.
2. **Bid-linked My Work.** Extend the existing context constraint/create/edit paths to accept `bid`, validate the Bid and both participants' applicable Intake authority server-side, and retain participant privacy. Reuse existing task attachments. Carry optional originating Update only after verifying it belongs to that Bid. Preserve legacy Job/task RPC signatures and behavior. Add Bid context navigation in My Work without using Job fields or fabricating a Job. Creating from an Update remains explicit. Existing task edits must retain Bid context instead of silently clearing it through the Job-only editor. Bid destructive cleanup must explicitly preserve private tasks/attachments and avoid a content-reading bypass; this compatibility path needs focused adversarial review before implementation is accepted.
3. **Reminders.** Extend existing task metadata with optional advance days and use a service-only dispatcher that writes ordinary account notifications. Recheck task completion, current assignment, active recipient and Bid access at dispatch. Dedupe by task + assignee + due date + reminder type + advance days where applicable. Serialize against completion/date/reassignment edits, and never notify a former assignee on retry. Keep notification read/unread behavior. Local delivery tests must cover due-date edits, advance-day edits, cancellation/completion, retries, access revocation, DST and late dispatch. Production cron installation remains separately unauthorized.

Chris confirmed Texas/Central Time. Use `America/Chicago` (CST/CDT automatically), with the proposed 8:00 a.m. local delivery for advance and due-date notifications. Configurable user/organization timezone is backlog; do not add a preference model in this pass. Advance days are calendar days before the actual due date, not offsets from midnight UTC.

## Review environment and deployment

Port 3000 is owned by PID 82208, running `scripts/start-production-blend-review.mts --material-readiness` from `/private/tmp/tenops-connected-navigation`. It was left untouched. Port 3107 is used only for internal fixture browser checks; it is not offered as Chris's complete functional review environment.

The candidate's production export uses a loopback-only dummy Supabase URL/key and `NEXT_PUBLIC_DEV_BRANDING=false`. No `.env.local` is copied. Fixture browser checks intercept REST/auth traffic and assert there is no external origin. They validate UI behavior, not PostgreSQL RLS or real Storage/PDF generation. A full database-backed localhost:3000 review environment remains outstanding until the backend extension is implemented and verified.

TenDev and Production deployment: none. TenDev shares Production Supabase and must not receive a deceptively functional backend-dependent UI.

## Branding/release path

`node scripts/verify-dev-branding.mjs` passes. `next.config.ts` retains authoritative branding resolution. `package.json` exposes branding verification as a separate command; `build` does not invoke it. No repository deployment pipeline enforcing that verifier automatically was found in the inspected release/deployment paths. Therefore automatic release enforcement is not established; keep the explicit mandatory release gate. Deployment pipeline redesign is out of scope.

## Validation scope

Overall workstream is Tier 3. This independent UI increment uses Testing Level 2 because it changes dismissal/unsaved-draft behavior, while preserving existing data contracts. TypeScript, targeted ESLint, diff checks, focused Planning model checks, production export and fixture browser checks are the relevant gates. Backend migrations will require Level 3, including participant privacy, denied direct RPC/table/Storage paths, compatibility and notification retry tests.

The default Turbopack build cannot follow the reused dependency symlink outside this worktree root; the production webpack export succeeds. This is a local dependency-layout limitation. Do not change canonical branding or build configuration to bypass it.

Production Blend, Sample generation/PDFs, geometry, Material Readiness, historical relationship/access matrices and hosted permissions are intentionally not reverified by this UI increment; relevant source was not changed. Do not claim the full final Product review checklist is satisfied.

### Actual local outcomes

- TypeScript: passed (standalone and final production build).
- Targeted ESLint and `git diff --check`: passed after final source changes.
- `scripts/verify-intake-planning-model.ts`: passed.
- `scripts/verify-dev-branding.mjs`: passed.
- Production webpack export: passed with explicit loopback backend and development branding disabled; no `.env.local` present.
- `scripts/verify-bids-inspector-planning-browser.mjs`: passed on the final export. Covers inside/backdrop/Escape behavior, discarded/retained drafts, focus return, body scroll lock, planning-tab draft protection, reset zoom, density, date-drag preview/cancellation and mobile width. Screenshot `/private/tmp/tenops-bids-crm-mobile.png` visually inspected.
- Browser harness initially needed exposed count headers and a title-independent dialog locator. Earlier failed attempts are not counted as passing evidence. No hosted requests or writes were made.

### Exact candidate changed-file boundary

- `src/modules/pre-production/BidWorkspace.tsx`
- `src/modules/pre-production/BidPlanningCard.tsx`
- `src/modules/pre-production/IntakePlanningTimeline.tsx`
- `scripts/verify-bids-inspector-planning-browser.mjs`
- `docs/project-memory/2026-10-09-bids-crm-ux-overhaul.md`

No migration has been added or applied in this increment. The backend extension above is proposed design, not implemented behavior. Stop here for the kickoff's new schema boundary review; do not describe this as the complete Bids overhaul.
