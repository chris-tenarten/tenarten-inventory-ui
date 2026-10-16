# Sample Post to Job — trusted rich announcement qualification

LOCAL CANDIDATE / STOP FOR PRODUCT REVIEW. Canonical base: `0375b8a0472ee8bc64fc590da871f4b3230e77cf`. Persistent worktree: `/Users/chrisngo/source/worktrees/tenops/sample-post-spotlight`, branch `feature/sample-post-spotlight`. The complete accepted presentation and trusted-delivery extension are committed locally at completion; the candidate SHA is the commit containing this report (`git rev-parse HEAD`) and is returned in the final handoff. No push, hosted migration, upload, notification, message, Edge deployment or application deployment.

## Accepted experience preserved

The announcement, five existing JPEGs, captions, styling and shared Messaging image viewer are unchanged. No recapture or frontend/build/browser-suite repeat was necessary for this continuation. Original focused presentation/build/TypeScript/lint/desktop/mobile/keyboard evidence is [preserved](evidence/sample-post-spotlight/validation.json). Captions travel through existing attachment filenames, ordered by existing `created_at,id` semantics; navigation stays within one message. Screenshot hashes still match the accepted record.

## Final identities

Read-only `app_users` name resolution plus authenticated-user lookup verified unique IDs, active status, no current auth ban, and Messaging eligibility under the existing active-user receive contract. These IDs are pinned in the publisher's approved recipient preview; identity drift fails closed. No accounts or permissions changed.

| Recipient | Authenticated user ID | Role |
| --- | --- | --- |
| Anthony Iorio | `92edea19-e431-4493-9a1b-3c3ecf32aeae` | lead |
| Giovanni Coppola | `29bed5b3-2ed8-43aa-9af2-45578b00388e` | lead |
| Patrick Soldow | `c85c852e-6775-4ee7-bfb7-f6ff0778243b` | lead |
| Chris Ngo | `553948ec-f71e-4c06-9da8-6ad3755584d7` | admin |

Explicitly excluded: Marcos Alvarado, Jason Allen and chris developer. Not an active-user broadcast; no future-user subscription. The server-only CLI defaults to read-only preview and refuses ambiguous, missing, inactive, banned, replaced or duplicate recipient identities.

## Trusted publishing mechanism

One additive migration extends `tenops_release_communications` with explicit recipient IDs, immutable bounded attachment manifest and uploader audit identity. It adds service-role-only preparation/completion RPCs, and extends the existing `deliver_tenops_release_communication(text)` / internal per-user publisher with a rich branch. Existing text/account-notification branches remain compatible; original definition hashes are prerequisite guards. No second announcement store or sender exists.

The approved sender remains `sender_kind=system`, `sender_user_id=NULL`, `system_sender_key=tenops`, UI conversation `00000000-0000-0000-0000-000000000001`. Chris Ngo is the uploader audit identity, not the message sender. Ordinary users cannot call the trusted RPCs or insert system messages. Effective EXECUTE denial was tested with explicit anonymous default grants simulated only in the disposable database; the migration changes no global defaults.

Stable announcement key: `sample_post_to_job_20261015`. Preparation reserves four hidden draft rows and exactly five ordered attachment/preview reservations per recipient, atomically. Registry/message conflicts fail closed. No ready row is exposed by preparation. The trusted Node publisher uses existing private bucket `my-work-inbox-attachments`, uploads with `upsert:false`, downloads every original and preview, checks byte length and SHA-256 against the accepted JPEGs, then attests the ordered hashes to the service-only completion RPC. Existing Storage metadata/guard checks must also pass before publication.

Each original and bounded preview uses the same approved JPEG bytes in separate existing paths (`message/attachment/file`, `message/attachment/preview.jpg`). The service process is responsible for physical-byte hashing; PostgreSQL checks its trusted hash attestation and actual Storage row metadata. Neither browser roles nor ordinary clients can attest verification. No service credential is imported into browser source.

Completion publishes the ready row and its deterministic `inbox-system-message:<key>` notification in one transaction through the existing publisher. Ready recipients are skipped on resume; unique message/notification keys and row locks prevent duplicate persistence. Explicit attachment timestamps preserve screenshot order. Normal message/attachment/preview RLS and Storage policies are unchanged; private access requires the intended recipient's ready message. The uploader receives no cross-recipient content-reading bypass.

## Failure and resume

Upload/network/mismatched-byte failures stop immediately, retaining referenced objects only in hidden drafts. No overwrite or premature notification. A subsequent authorized invocation verifies existing bytes and resumes missing uploads. A lost response after committed delivery is reconciled from ready state and does not resend that recipient. Content/audience/manifest conflicts stop rather than replacing accepted content. Completion failure rolls back ready state and verification changes. Stale drafts remain subject to existing abandoned-transfer cleanup; if cleanup is in progress, the publisher stops rather than reviving a canceling draft. No permanent ready content is deleted or reset by this tooling.

## Focused validation — PASS

Tier 3 / Testing Level 3 for the new trusted persistence contract. One consolidated focused verifier, `scripts/verify-rich-release-communications.mjs`, reused the existing Inbox ancestor fixture in a newly named disposable `postgres:17.6` container. No existing database/container/volume was modified. Only the verifier-owned container was stopped. Harness corrections were needed for ancestor extraction, the fixture notification ID column and receipt-writing import; all checks then completed successfully.

Results in [delivery evidence](evidence/sample-post-spotlight/delivery-validation.json): correct system sender; exactly four approved recipients and excluded accounts absent; five attachments and exact captions/order; private recipient access; cross-recipient/Admin, unrelated, inactive and anonymous denial; ordinary-user system impersonation denial; effective RPC grants; unchanged policies; hidden partial-upload failure; corrupt same-length bytes rejected; lost-response resume; zero duplicate messages/notifications/references; zero orphaned Storage rows; existing system welcome/account-notification compatibility; historical message continuity. Resolver ambiguity/inactivity failure checks also passed. New publisher/verifier targeted ESLint passed; diff check passed. No application source changed in this continuation, so accepted TypeScript/build/browser evidence was reused.

Limit: physical-byte upload/download uses a deterministic Storage adapter; actual PostgreSQL RLS, Storage trigger, message/attachment persistence and notification behavior were executed. A new live Storage HTTP/TUS suite was not run. Existing attachment infrastructure evidence is reused. No hosted delivery was tested or performed.

## Final announcement and screenshot manifest

New in TenOps: Post Sample Documents to Jobs

You can now send Sample Work Orders, Working Sheets and Blend Sheets directly to Production Jobs—without downloading and reuploading PDFs.

Follow the quick walkthrough below to see how.

Posting shares a PDF; it does not approve or issue a Sample. Sample Work Orders use an existing issued document.

1. [01.jpg](evidence/sample-post-spotlight/01.jpg) — Open a Sample and select Post to Job.
2. [02.jpg](evidence/sample-post-spotlight/02.jpg) — Choose the Sample document you want to share.
3. [03.jpg](evidence/sample-post-spotlight/03.jpg) — Select the Production Job that should receive it.
4. [04.jpg](evidence/sample-post-spotlight/04.jpg) — Add a message if you’d like. Type @ to mention a coworker and notify them.
5. [05.jpg](evidence/sample-post-spotlight/05.jpg) — Post the document. Your PDF and message will appear in the Job’s Updates.

Exact file bytes/hashes, dimensions and ordered filenames are in [the final preview manifest](evidence/sample-post-spotlight/final-recipient-resolution.json). The approved images were not altered.

## Local Product review

http://localhost:3000/?inbox=1&inboxUserId=00000000-0000-0000-0000-000000000001 — actual TenOps Inbox and accepted image viewer, normal TenOps sign-in through existing guarded auth. All review business data and images are local synthetic fixtures; employee conversations are never fetched. Existing listener remains running; no new review environment or recapture. No hosted message or notification occurs during review.

## Migration and release dependencies

Required local migration: `supabase/migrations/20261015230000_rich_release_communications.sql`.
SHA-256: `3ed5424ff5d8939063f78738083591c7e2fc3ecf1b847c15d8d41841759db7bc`.
Dependencies: released Inbox, attachments, durable communication registry (`20260831_016/017/018`), large attachments (`20260925120000`) and Messaging V1.1 previews/guard (`20260925200000`). Exact old publisher bodies must match the migration's prerequisite guards; hosted compatibility/readback is a future release gate. No Edge deployment required. No policies, ordinary role capabilities or global default privileges change.

After separate authorization: apply this migration with focused hosted grant/object readback; release the accepted small viewer change to TenOps only; refresh and verify the pinned four-person roster/approved content and screenshot hashes; explicitly authorize delivery; run the server-only publisher with `--deliver` and `TENOPS_RELEASE_DELIVERY_CONFIRM=DELIVER_APPROVED_SAMPLE_POST_SPOTLIGHT` in a trusted environment. Do not run a full active-user broadcast. The CLI's default mode performs no writes. Preserve TenDev's experimental Sample Matcher. No release or delivery stage is authorized by this local candidate.

## Exact changed files (20)

- `src/modules/my-work/InboxDialog.tsx`
- `src/modules/my-work/messaging/AttachmentImageViewer.tsx`
- `scripts/start-sample-spotlight-review.mts`
- `scripts/verify-sample-spotlight.mjs`
- `scripts/publish-sample-post-spotlight.mjs`
- `scripts/verify-rich-release-communications.mjs`
- `scripts/support/rich-release-checks.mjs`
- `supabase/migrations/20261015230000_rich_release_communications.sql`
- `docs/project-memory/2026-10-15-sample-post-spotlight-local-review.md`
- `docs/project-memory/2026-10-15-sample-post-spotlight-rich-local-review.md`
- `docs/project-memory/evidence/sample-post-spotlight/announcement.json`
- `docs/project-memory/evidence/sample-post-spotlight/recipient-preview.json`
- `docs/project-memory/evidence/sample-post-spotlight/validation.json`
- `docs/project-memory/evidence/sample-post-spotlight/final-recipient-resolution.json`
- `docs/project-memory/evidence/sample-post-spotlight/delivery-validation.json`
- `docs/project-memory/evidence/sample-post-spotlight/01.jpg`
- `docs/project-memory/evidence/sample-post-spotlight/02.jpg`
- `docs/project-memory/evidence/sample-post-spotlight/03.jpg`
- `docs/project-memory/evidence/sample-post-spotlight/04.jpg`
- `docs/project-memory/evidence/sample-post-spotlight/05.jpg`

STOP FOR PRODUCT REVIEW. DO NOT SEND.
