# Messaging universal and large attachments — discovery and proposed acceptance contract

Date: 2026-09-25. Historical discovery record. Chris subsequently approved isolated implementation and paste/drop support; see [the candidate report](2026-09-25-messaging-large-attachments-candidate.md) for final behavior and evidence. Hosted release remains unapproved. Risk Tier 3 / intended Testing Level 3 because Storage restrictions, persistence, private access, retries and cleanup are involved.

## Baseline and evidence

- Isolation update: continuing work lives at `/private/tmp/tenops-messaging-large-attachments`, branch `feature/messaging-large-attachments`, based on the exact SHA below. Initial `git status --short` was empty. `.env.local` is confirmed ignored; no environment file is needed/copied for this documentation-only pass. For later local runtime, reuse the existing ignored developer configuration without putting credentials in tracked files or reports. Keep generated output in explicitly ignored locations (do not assume `tmp`/`output` are ignored).
- One copy of this report was written in the normal checkout before Chris's parallel-work safety instruction arrived. It was left untouched afterward because the new instruction prohibits modifying/removing files there. No Messaging application changes exist there. All subsequent edits belong to this worktree. No commit or integration is authorized by the isolation instruction; report candidate boundary/status before any future commit, and do not merge into dirty normal `dev`.
- Working branch: `dev`. HEAD, local `main`, cached remote refs, and live `git ls-remote origin refs/heads/main refs/heads/dev` all resolve to `a76f4f83e66a1d3b149ff31bff44874a39c1b6f3`.
- Existing dirty work: planning data, BidWorkspace, IntakePlanning, pre-production queries, production jobs, Intake tests/config, Intake verifier scripts, `src/lib/complete-rows.ts`, and new Intake agenda/calendar/timeline/model files. No overlap with the proposed Messaging boundary. Preserve all of it; do not promote the entire working tree.
- Read-only linked-host inspection matched the application's configured Supabase project, `vxdxjhazkqhpkwdqtobp`. Inspected bucket settings, attachment constraints, Messaging-specific policies, finalize/discard function definitions. No private message bodies, attachment filenames, paths or contents were read.
- Hosted inspection confirms configuration/definitions, not end-to-end authorization behavior. No uploads, fixture creation, data edits, migrations, configuration updates, commits, pushes or deployments performed.
- Sources: [Inbox data/transfer code](../../src/modules/my-work/inbox.ts), [Inbox UI](../../src/modules/my-work/InboxDialog.tsx), [shared picker](../../src/modules/my-work/AttachmentFileInput.tsx), [global Messaging](../../src/components/GlobalMessaging.tsx), [attachment migration](../../supabase/migrations/20260831_017_my_work_inbox_attachments.sql), [cleanup migration](../../supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql), [performance audit](2026-09-22-platform-performance-audit.md).

## 1. Current architecture

Browser creates a private message draft through an RPC, uploads each File sequentially to private Supabase Storage, inserts attachment metadata, then finalizes the message and notification. Paths are `message UUID/attachment UUID/sanitized filename`, with `upsert:false`. The original filename is stored separately. On error, the client attempts object removal and draft discard. This is a multi-request workflow, not a transaction across Storage and Postgres.

## 2. Allowed and blocked types

Picker `accept` suggests `image/*`, PDF, TXT, CSV and legacy/current Word, Excel and PowerPoint extensions. It is a picker hint, not enforcement. Browser-provided MIME is sent to Storage; empty MIME becomes `application/octet-stream`.

Hosted bucket allows JPEG, PNG, GIF, WebP, HEIC, HEIF, PDF, octet-stream, plain text, CSV and the six listed Office MIME types. ZIP/7z, DWG/DXF, HTML, SVG, scripts, installers and other formats are not consistently accepted: an unlisted MIME is blocked, while an empty/generic MIME can pass. Even some picker-visible image types are blocked by the bucket. There is no reliable universal transfer contract today.

## 3. Limits by layer

| Layer | Current evidence / limit |
| --- | --- |
| Client | `26,214,400` bytes per file (25 MiB, currently labeled 25 MB), checked during upload after draft creation. No aggregate or count limit found. |
| Picker/browser memory | `Promise.all(file.arrayBuffer())` clones every selected file before validation; memory grows with total bytes. Staged images also decode eagerly. This is unsuitable for hundreds of MB. No portable fixed browser memory ceiling. |
| Upload | Standard Supabase multipart-form upload, sequential files, no resumable client/progress/abort integration. |
| Hosted bucket | Verified private; `file_size_limit=26,214,400`; MIME allowlist above. |
| Project global Storage limit/plan | **Unverified**; cannot infer from bucket. Management token was not present in the loaded environment. Must verify through authorized settings access before claiming 250/500 MB is available. |
| Storage policies | Inspected policies gate actor, message and draft state; no aggregate byte quota in these policies. |
| Hosted attachment metadata | Verified `bigint` constrained to 0–26,214,400 bytes. Filename length 1–500 characters; content type at most 255. UUID-scoped path and unique path constraints. |
| Hosted finalize | Checks attachment row count; does not validate actual Storage object presence/size or aggregate bytes. |
| Next.js | Static export; no application server upload/body buffer in this path. |
| Cloudflare | Application-host request-body limits are not in this direct Storage path. Provider infrastructure still applies; do not assume an unverified proxy configuration or service quota. |
| Download | Ten-minute signed URL; no additional file-size check in client. Browser navigates to Storage, rather than fetching the entire file into an application Blob. Actual download headers/range behavior untested. |

Supabase documents a Free-plan global ceiling of 50 MB and a configurable ceiling up to 500 GB on Pro/Team; bucket settings cannot exceed global settings. These are provider capabilities, not this project's verified configuration. [Provider limits](https://supabase.com/docs/guides/storage/uploads/file-limits).

## 4. Does arbitrary transfer already work technically?

Storage and metadata can represent arbitrary bytes, including generic binary files. Some arbitrary files can already pass with octet-stream. The current picker/MIME restrictions and three 25 MiB checks prevent a dependable universal/large-file feature. Changing only `accept` or client size validation is insufficient.

## 5. Preview versus download

Currently any metadata MIME beginning `image/` gets an image-preview button; other files open a signed URL in another tab. There is no separate guaranteed Download action, image-error fallback, or forced attachment disposition. PDF opens through browser navigation, not a dedicated safe Messaging PDF preview.

Proposed: every file gets filename, inferred extension/type, size and Download. Preview is a separate optional action restricted to supported raster formats, rendered only as an image element. No SVG, HTML, script, iframe, object, arbitrary parser, or new PDF preview. Unknown/unsupported/mismatched types use download-only. Decode failures leave Download usable. Use a conservative preview byte budget (proposed 20 MB), and no automatic staged preview for large files; preview limits never restrict transfer.

## 6. Security and filenames

Accept arbitrary file types for transfer without an extension allowlist. Keep active formats and unknown types as generic binary Storage content; display the original extension separately. Do not interpret declared MIME or extension as proof of safety. Raster classification should use bounded signature checks plus the constrained image rendering context; classification is not malware detection. Misleading or ambiguous input falls back to binary download.

Download from the separate Storage origin with attachment disposition. Do not serve uploaded bytes from trusted TenOps routes or construct executable Blob/HTML documents. Verify actual response headers, including disposition, content type and anti-sniffing behavior. Cross-origin `a[download]` alone is insufficient. Use a signed download URL and browser-managed transfer, avoiding a full-file fetch/Blob. Supabase supports a download parameter: [download behavior](https://supabase.com/docs/guides/storage/serving/downloads).

Preserve raw original filenames in metadata and text-render them; isolate bidirectional text, disclose the extension, avoid HTML injection. Keep UUID identity independent of filename; sanitized path suffixes may remain. Header/download filenames require safe encoding and control/path-character handling; operating systems may normalize saved names. In the installed SDK, the custom download name is concatenated into a query before `encodeURI`; use structured URL query encoding so `&`, `#`, `+`, `%`, Unicode and quotes cannot alter parameters. Overlong metadata must fail clearly before uploading, not silently truncate the displayed original.

No antivirus/scanner integration found in inspected application/Storage code or dependencies. Malware scanning/quarantine is a later security enhancement with its own infrastructure and Product scope. Do not label files safe or scanned. Ordinary files can remain dangerous when opened outside TenOps.

## 7. Direct upload design

Keep authenticated browser → private Storage. Retain File references instead of cloning their bytes. Use a lazily imported TUS client, stable per-attempt UUID paths, no overwrite, sequential file scheduling and bounded chunks. Use fresh authenticated credentials on retries; never expose service-role credentials. Store only small transfer state/identifiers, never file bodies or bearer URLs in message payloads, Realtime, logs or durable caches.

## 8–9. Recommended limits

Recommend **250 MB/file and 500 MB/message initially**, explicitly decimal: 250,000,000 and 500,000,000 bytes. This removes the existing MB/MiB ambiguity. Validate selection before any file reads, draft creation or upload. Enforce per-file limits in Storage and DB; enforce aggregate limits atomically on the server as well as in the client.

500 MB/file is architecturally plausible with the same TUS design and appropriate global settings, but is not yet reliability-validated. It doubles worst-case transfer time and recovery/storage exposure without solving a separate architecture problem. Keep it as a later configuration increase after actual 500 MB upload/download, mobile and interrupted-network gates. Do not advertise either target until hosted global limits and end-to-end tests pass. No arbitrary attachment-count cap proposed in this pass; large metadata lists still need bounded fetching/rendering.

## 10. UX and lifecycle requirements

Current: multiple attachments, staged removal, sending/stage labels and errors. No byte progress, explicit cancel, dedicated resume/retry, or abandoned-draft recovery. A retry through Send creates a fresh draft. Closing/changing conversation does not provide a deliberate transfer lifecycle contract.

Minimum proposed UX: per-file and aggregate byte progress; queued/uploading/paused-or-retrying/failed/canceled/finalizing/sent states; bounded automatic transient retries; explicit Retry and Cancel; retain failed selections; avoid edits/removal of the active batch without cancellation. Keep transfer state when the panel closes; warn on leaving the page during an active transfer. Reload recovery may require reselecting the original file; do not promise background upload after the browser closes.

Use one stable send operation and attachment identities across retries. A lost finalization response is an ambiguous success: reconcile message status before cleanup or creating another message. Current catch handling does not do this; finalize is draft-only and not idempotent. Successful finalize must be safely repeatable for the same sender/manifest, with exactly one notification.

Cancellation stops further chunks, reconciles finalize races, removes completed draft objects through the Storage API, then discards metadata/draft only after cleanup succeeds. Retain/report cleanup failures for retry. Do not delete a finalized message as upload cleanup. Hosted discard currently does not guard against surviving objects; harden it. Track uncertain upload outcomes by stable path, including cases where Storage succeeded but the client lost the response.

Staged files are removable today; sent attachment deletion is part of existing explicit Admin whole-message deletion, not a general per-file deletion action. Preserve that behavior. Propose abandoned-draft cleanup after seven days without transfer activity, with a lease/heartbeat to protect active uploads. A narrowly authorized scheduled worker must use Storage deletion APIs and retry failures, then delete draft metadata; never delete Storage catalog rows directly. Retention/scheduling requires Chris's acceptance before implementation/application.

## 11. Resumable upload

Treat resumability as required for a reliable 250/500 MB release. Standard upload can technically accept large files, but does not meet recovery expectations. Supabase recommends TUS above 6 MB; use its direct Storage hostname and documented 6 MiB chunks. Upload URLs expire after 24 hours; expiration starts a new session only after reconciling existing objects. Scope client fingerprints to user, draft, attachment and file identity, not filename alone; clear account-specific state on logout. No S3 credentials or separate multipart architecture needed. [TUS documentation](https://supabase.com/docs/guides/storage/uploads/resumable-uploads), [standard upload guidance](https://supabase.com/docs/guides/storage/uploads/standard-uploads).

## 12. Private download authorization

Inspected hosted definitions allow the sender and the recipient of ready messages; message RLS also requires an active actor. Draft recipients cannot read attachments. Admin has a separate cleanup DELETE policy, not a Messaging-specific SELECT bypass. Preserve this distinction and test all policies together for unrelated permissive-policy leakage.

Signed URL issuance requires authorized Storage access, but an issued URL is a bearer capability: anyone possessing it can use it until expiry. A guessed path alone is insufficient; a leaked valid signed URL is sufficient. Logout or role changes must not be claimed to revoke issued URLs instantly. Keep the existing ten-minute expiry and mint only on explicit actions; test expired-link renewal and long-download/range retries. The request explicitly permits signed access; strictly binding every download request to the currently authorized user would require a different design. [Private access and signed URL lifetime](https://supabase.com/docs/guides/storage/serving/downloads).

## 13. Required schema/Storage/configuration changes

- New forward-only migration: increase the attachment byte constraint; introduce stable send/manifest identity and upload lifecycle tracking as needed; enforce aggregate reservations under a message lock; verify completed objects against authoritative Storage sizes/paths before ready; make finalize idempotent; guard discard against surviving objects.
- Validate reservation/metadata insertion against sender-owned drafts. Direct authenticated inserts must not bypass aggregate enforcement; use a trigger or a narrowly granted reservation RPC with corresponding reviewed grants. Finalize must lock against concurrent insertion/cancellation. Actual Storage sizes must agree with declared/reserved sizes. Any Storage write-policy tightening needs explicit review; retain the same participant authorization semantics.
- Keep bucket private, remove MIME allowlist (`allowed_mime_types=NULL`) and raise bucket size only through explicitly approved change. Generic active-content upload behavior is defense in depth, not a way to hide the allowlist problem.
- Verify global Storage limit/plan and increase only if necessary and authorized; audit other buckets' explicit limits before any global increase.
- Implement narrowly scoped abandoned-draft cleanup/lease handling; schedule only with explicit authorization. No changes to existing applied migrations.

## 14. Exact proposed implementation boundary

Messaging `inbox.ts`, `InboxDialog.tsx`; new Messaging-specific file picker, preview classifier and upload controller; TUS dependency/lockfile; new narrow migration(s); draft-cleanup worker if accepted; focused verifiers and browser tests; this decision record. Preserve shared My Work Task attachment defaults by using a Messaging-specific picker rather than silently changing `AttachmentFileInput.tsx` behavior for Tasks. Touch `GlobalMessaging.tsx` only if needed to preserve controller lifetime on panel close/account changes. No Intake/Calendar, Bid/Sample lifecycle, other upload buckets, unrelated PDFs, Job models or general notification refactor.

No application patch prepared in this pass: the complete feature crosses hosted persistence and cleanup boundaries and is not clearly safe as a purely local/client change. A smaller download-only patch is possible, but would not satisfy the large/universal transfer contract.

## 15. Lazy loading/performance

Preserve dynamically imported full Messaging, narrow closed-state unread reads, bounded recent list, open-only detailed subscriptions, peer-scoped typing, selected-conversation attachment metadata and on-demand signing. Current open Inbox still loads full accessible message history, not paginated per-conversation bodies; retain this as a separate backlog item, not a solved feature. Metadata may load with messages, but no attachment bytes/signatures/previews should load with historical message cards. Lazy-load TUS on first transfer. Chunk attachment metadata queries when needed to avoid long `.in()` URLs and result truncation; no eager prefetch of large files.

## 16. Testing and release

This pass: source/SDK review, live remote refs, read-only hosted configuration/definition queries, primary provider documentation, documentation diff/link checks. No browser behavior, actual upload/download, aggregate throughput or end-to-end privacy test was performed. Documentation-only work does not require a build.

Implementation gate: Tier 3 / Testing Level 3. Add behavioral tests for exact limit/limit+1 and aggregate boundaries, spoofed sizes, missing objects, concurrent reservations, retry/finalize/cancel races, token refresh, 409 recovery, expired TUS sessions, cleanup failures and abandoned drafts. Verify arbitrary formats, active-content fixtures, unknown/mismatched MIME, duplicate and unusual filenames, mobile selection and byte-identical downloads. Test sender, ready recipient, draft recipient, unrelated user, inactive user, anonymous user and unrelated Admin; guessed paths, URL minting, signed-link expiry and private Realtime boundaries.

Run real 250 MB upload and two-file 500 MB aggregate transfers over throttled/interrupted networks, memory sampling, cancel/retry and browser-managed download/header checks. Test 500 MB/file separately before raising its limit. Confirm no file-byte requests on conversation load. Run relevant existing Inbox/privacy/lifecycle verifiers plus new focused tests, browser checks, TypeScript, targeted ESLint, diff check and Production build. Review exact candidate diff/evidence; broader tests only if blast radius warrants. Hosted fixtures, migrations, Storage settings and releases remain separate authorization gates; preserve unrelated dirty work.

## 17. Proposed Product Acceptance Contract

For Chris's acceptance:

1. Messaging accepts ordinary arbitrary business/project files, including archives, CAD/design files, binaries/installers and unknown formats. Transfer never depends on preview support.
2. Initial caps are 250,000,000 bytes/file and 500,000,000 bytes/message; all layers enforce consistent limits. 500 MB/file is deferred until measured validation and explicit acceptance.
3. Every attachment has a readable original filename, type/extension where known, size and explicit Download. Optional bounded raster preview is separate; all unsupported/failed previews remain downloadable. No new arbitrary-format/PDF renderer.
4. Files remain private; sender/ready-recipient access and existing Admin privacy expectations remain. Existing short-lived bearer-link semantics are acknowledged; no public bucket or trusted-origin active-content execution.
5. Direct TUS upload provides progress, cancel and safe retry. One operation produces at most one ready message/notification; ready requires all verified objects and aggregate validation. No orphan deletion on ambiguous finalize success.
6. Panel closure preserves in-page transfer state; browser exit cannot guarantee continued upload. Reload recovery may require file reselection. Seven-day inactive draft cleanup uses leases and retryable Storage deletion, subject to acceptance of the retention policy.
7. Large-file bodies never join message list/Realtime payloads or eager historical previews. Transfer buffering is bounded; original file references are retained.
8. Existing sent-message deletion behavior stays unchanged. No antivirus promise; scanning/quarantine remains future work.
9. Release requires the Level 3 evidence above, verified global Storage capacity and Chris's explicit authorization for hosted changes/deployment. This proposed contract does not itself authorize those actions.
