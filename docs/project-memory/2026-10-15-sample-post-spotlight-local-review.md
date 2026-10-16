# Sample Post to Job spotlight — local Product review

Initial presentation review; superseded for delivery and recipients by [the rich-delivery qualification](2026-10-15-sample-post-spotlight-rich-local-review.md). Local candidate commit is now authorized; no push, deployment, hosted migration, Production message, hosted notification or hosted business-data write. Candidate: `feature/sample-post-spotlight` in `/Users/chrisngo/source/worktrees/tenops/sample-post-spotlight`, based on released `0375b8a0472ee8bc64fc590da871f4b3230e77cf`.

Review: http://localhost:3000/?inbox=1&inboxUserId=00000000-0000-0000-0000-000000000001 . Use normal TenOps sign-in. Only authentication/access lookup goes through the established read-only guard. Messages, Samples, Jobs and Storage are disposable local fixtures. Synthetic auth is used only for unattended screenshots, not the final review server. The confirmed obsolete Sample review listener was replaced; its worktree and files remain intact. Start with `./node_modules/.bin/tsx scripts/start-sample-spotlight-review.mts`; `--fixture-auth` is for automated capture only. Build fixture export with the existing `node scripts/build-sample-job-update-review.mjs`. This export targets localhost and must never be deployed.

## Original mechanism and sender

Narrow read-only hosted inspection confirmed three registry records: `my_work_v1_announcement` and `tasks_messaging_intake_20260902` are account notifications, while `inbox_onboarding_v1` is the existing system Inbox welcome (future-user onboarding enabled). The only observed system message key was `inbox_onboarding_v1`. This distinguishes the original feature notification from the Inbox welcome rather than assuming an ordinary employee sent either.

The existing sender is built-in **TenOps**, persisted as `sender_kind='system'`, `sender_user_id=NULL`, `system_sender_key='tenops'`; the UI uses reserved conversation ID `00000000-0000-0000-0000-000000000001`. No auth/app user is created or impersonated.

Registry `tenops_release_communications` plus service-role-only `deliver_tenops_release_communication(text)` deliver to active `public.app_users`. System messages persist in `my_work_messages`; `(recipient_user_id, system_message_key)` has a unique index. Notifications use deterministic `inbox-system-message:<communication_key>` keys. Existing delivery functions insert ready **text-only** system rows, not attachments. Their active-user iteration includes guests/developers, not every auth account. Browser clients cannot use this system sender to send ordinary messages.

## Draft

New in TenOps: Post Sample Documents to Jobs

You can now send Sample Work Orders, Working Sheets and Blend Sheets directly to Production Jobs—without downloading and reuploading PDFs.

Follow the quick walkthrough below to see how.

Posting shares a PDF; it does not approve or issue a Sample. Sample Work Orders use an existing issued document.

## Five screenshots and captions

Captured from the actual released Sample components at the released base, using disposable Sample/Job/coworker fixtures. Only a blue outline is added to emphasize real controls; controls and states are not fabricated. JPEG crops use real file dimensions and remain below the existing bounded-preview size limit. A saved Working Sheet demonstrates the sequence without issuing a Sample or posting an Update.

1. [Open Sample](evidence/sample-post-spotlight/01.jpg) — Open a Sample and select Post to Job.
2. [Choose document](evidence/sample-post-spotlight/02.jpg) — Choose the Sample document you want to share.
3. [Select Job](evidence/sample-post-spotlight/03.jpg) — Select the Production Job that should receive it.
4. [Mention coworkers](evidence/sample-post-spotlight/04.jpg) — Add a message if you’d like. Type @ to mention a coworker and notify them.
5. [Post Update](evidence/sample-post-spotlight/05.jpg) — Post the document. Your PDF and message will appear in the Job’s Updates.

## Presentation

Actual GlobalMessaging/InboxDialog and existing attachment/InlinePreview contracts. One message contains five ordered image attachments. Click to enlarge; the small shared viewer adds Previous/Next, image position and full filename caption. Captions are ordinary attachment filenames, so no new persistence field or tutorial module is needed. Supports arrow keys, close/Escape, focus restoration and Tab containment; no autoplay or automatic onboarding interruption. Existing signed attachment URL contract remains unchanged. Navigation is limited to previewable images in the selected message. Original attachment downloads remain available.

The application change applies to ordinary multi-image messages too; a single-image attachment still opens the same viewer without Previous/Next. Attachment ordering remains existing `created_at,id`, which future delivery must preserve explicitly. Review screenshots: `output/sample-post-spotlight/messaging-desktop.png`, `messaging-mobile.png`, `expanded-desktop.png`, `expanded-mobile.png`.

## Final Product-approved recipient preview

Supersedes the initial all-active-user preview. Exactly Anthony Iorio, Giovanni Coppola, Patrick Soldow and Chris Ngo. Marcos Alvarado, Jason Allen and chris developer are explicitly excluded. All four pinned authenticated IDs have been resolved uniquely and checked active/eligible. See [final recipient resolution](evidence/sample-post-spotlight/final-recipient-resolution.json) and the rich-delivery qualification. No delivery is authorized.

## Focused validation

Tier 2 / Testing Level 2 bounded UI change. Focused verifier `scripts/verify-sample-spotlight.mjs` passes: correct TenOps identity, five ordered screenshots and exact captions, loaded bounded thumbnails, enlargement, Previous/Next boundaries, arrow navigation, close/Escape returning to Inbox, desktop/mobile layout, one seeded announcement, zero external browser requests, zero page exceptions, zero fixture notifications/Job Updates/uploads. No delivery endpoint is implemented in the fixture. Final guarded sign-in smoke is recorded separately.

Targeted ESLint, TypeScript (build), corrected application build and `git diff --check` pass. Initial lint found synchronous effect state resets; corrected by keying async image resource state to its attachment. A corrective rebuild was required. Visual review found fractional CSS-vs-JPEG dimensions in fixture metadata; corrected to actual JPEG dimensions and reran the affected capture checks. No database, PDF calculation, authorization or broad historical suites were run. Existing backend contracts were inspected, not requalified. Hosted delivery and idempotency were not exercised: duplicate prevention is existing unique-key evidence plus one seeded local message, not a claim of a Production send test.

## Trusted rich-delivery continuation

The previously missing attachment-aware publisher is now prepared and validated locally. See [rich-delivery qualification](2026-10-15-sample-post-spotlight-rich-local-review.md) for the forward-only migration, service-only CLI, exact four-person audience, byte verification, idempotency and remaining release authorization. The existing registry/system-message publisher is extended; ordinary Messaging RLS and Storage policies remain unchanged. Nothing has been sent hosted.

## Exact changed files

- `src/modules/my-work/InboxDialog.tsx`
- `src/modules/my-work/messaging/AttachmentImageViewer.tsx`
- `scripts/start-sample-spotlight-review.mts`
- `scripts/verify-sample-spotlight.mjs`
- `docs/project-memory/2026-10-15-sample-post-spotlight-local-review.md`
- `docs/project-memory/evidence/sample-post-spotlight/announcement.json`
- `docs/project-memory/evidence/sample-post-spotlight/recipient-preview.json`
- `docs/project-memory/evidence/sample-post-spotlight/validation.json`
- `docs/project-memory/evidence/sample-post-spotlight/01.jpg`
- `docs/project-memory/evidence/sample-post-spotlight/02.jpg`
- `docs/project-memory/evidence/sample-post-spotlight/03.jpg`
- `docs/project-memory/evidence/sample-post-spotlight/04.jpg`
- `docs/project-memory/evidence/sample-post-spotlight/05.jpg`

STOP FOR PRODUCT REVIEW.
