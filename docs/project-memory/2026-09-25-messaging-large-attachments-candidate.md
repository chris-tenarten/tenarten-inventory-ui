# Messaging large/universal attachments — isolated local candidate

Date: 2026-09-25. Implementation approved by Chris, including the follow-up paste/drop contract. Tier 3 / Testing Level 3. This is a local candidate, not a hosted release.

## Isolation and approval boundary

Worktree: `/private/tmp/tenops-messaging-large-attachments`.
Branch: `feature/messaging-large-attachments`.
Base: `a76f4f83e66a1d3b149ff31bff44874a39c1b6f3`.

No normal-checkout edits, branch switches, stashes, resets, cleanup or integration were performed during implementation. The pre-isolation report copy remains untouched. No hosted data/configuration/schema mutations, pushes or deployments occurred. The only database/Storage mutations were in this workstream's disposable local containers. `.env.local` is ignored and untracked and contains synthetic localhost browser-test values, not developer/hosted credentials. `.tmp-*`, node_modules, build output and screenshots remain ignored; none belongs in the commit.

## Final behavior

- Picker, clipboard File/image items and composer-scoped drag/drop all feed one queue. Text paste remains browser-native; mixed meaningful text is not prevented. No HTML/text conversion into files and no Base64 message payloads. Unsupported clipboard byte exposure gives an Attach/drop fallback. Generic clipboard image names become `Screenshot YYYY-MM-DD HH.mm.ss.ext` with collision suffixes. Duplicate delivery of the same native event is ignored; intentional separate additions remain separate attachments.
- Validation uses decimal limits: **250,000,000 bytes/file**, **500,000,000 bytes/message**. Queue additions are atomic across all entry methods. No extension allowlist. Original visible names remain in metadata; object paths use message UUID / attachment UUID / `file`.
- The browser retains File references, reads at most 12 bytes for optional raster classification, and lazily imports `tus-js-client`. All files, including small ones, use the same direct private-Storage TUS path. Production Supabase hostnames use the direct Storage hostname. Chunks are 6 MiB; files upload sequentially. No application body proxy or full-file arrayBuffer copy.
- The complete immutable manifest is reserved in one transaction under an operation lock. Direct authenticated attachment metadata INSERT/DELETE is revoked; clients use narrow RPCs. Per-file bounds are checked by metadata constraints, actual-object validation and bucket settings. Aggregate reservation is checked atomically; finalization verifies object existence and actual sizes.
- Progress shows file and aggregate bytes. Network/408/429/5xx failures receive bounded retries; explicit Retry retains operation/path identity and checks completed objects. A lost finalize response never triggers deletion or a new message. Finalize is repeatable and notification issuance is unique. An Admin-deleted message cannot be recreated by an old operation ID.
- Cancel aborts further browser chunks, serializes against finalization, removes completed draft objects via Storage APIs, then discards metadata only after cleanup succeeds. Cleanup failure remains retryable; Retry after a cancel request only retries cleanup. Incomplete TUS sessions expire through the provider's TUS lifecycle (documented up to 24 hours); canceled drafts reject late object completion. The seven-day worker handles completed abandoned/legacy draft objects and metadata, with a heartbeat protecting active transfers. It is prepared but **not scheduled or run hosted**.
- Transfer state survives panel remounts. Only the operation UUID is kept in account-scoped sessionStorage for page-reload recovery; manifest/message content is reread under the active sender boundary. Already-ready results need no file handles. Interrupted transfers require original-file reselection (name, size, modification time), reuse the same operation, and skip verified completed objects. Clipboard-only files that cannot be reselected can be canceled and added again. No promise of upload continuing after the browser exits. Logout stops transfer activity and clears account-scoped client references.
- Every historical/new attachment card has filename, extension, size and Download. Downloads mint a ten-minute private signed URL on explicit action and use encoded download parameters plus a native browser transfer, not a full-file fetch/Blob. Bounded JPEG/PNG/GIF/WebP previews are optional image elements; signature, extension and MIME agreement classify new raster candidates. Images over 20 MB and all other formats remain downloadable. Preview errors fall back to Download. No arbitrary parser, SVG/HTML renderer or new PDF viewer.
- New Storage objects use `application/octet-stream`, including raster files. The Storage object guard rejects incompatible actual MIME/size. The actual service performs rolled-back metadata-free permission inserts, which the guard permits; those rows can never satisfy finalization without actual size metadata. This behavior was discovered and corrected using the real local Storage service, not assumed from the protocol fixture.
- Selected-conversation metadata fetches are batched/paginated. No attachment bytes or signed URLs load with message lists. Existing global unread/recent-list, lazy full Inbox and open-only detailed Realtime patterns are preserved. Full message-history pagination remains separate backlog work. My Work Task attachments and shared Task picker behavior are unchanged.

## Prepared hosted artifacts and SHA-256

| Artifact | SHA-256 |
| --- | --- |
| `supabase/migrations/20260925120000_messaging_large_attachments.sql` | `13e1967390772e27c1f470c1382662517c90d3957b57db3f91a833be0d818359` |
| `supabase/config-changes/20260925_messaging_attachment_bucket.sql` | `2257da632f2f7d26beff3c523c9b1f03d1ea2031fb35152f089b048935a67d85` |
| `scripts/cleanup-messaging-drafts.mjs` | `6144c8b49de1b85589cfe26494adf63b6f011fc4d8de1feed6d1593c9f201e31` |

The migration does not change bucket/global limits. The separate guarded configuration transaction requires the migration and expected private 25 MiB bucket baseline, sets that bucket to 250,000,000 bytes and clears its MIME allowlist. It never makes the bucket public. Project-wide capacity is deliberately not guessed or changed.

Cleanup defaults to a no-request dry run. Execution requires `--execute`; hosted execution additionally requires `--allow-hosted` plus separately authorized runtime secrets. Schedule daily only after approval. Worker output contains counts, not private paths/content. Multiple/retried claims are safe; draft locks prevent finalization after a cleanup claim.

## Level 3 evidence

All listed final checks passed locally:

| Check | Evidence |
| --- | --- |
| `npx tsx scripts/verify-messaging-attachments.mts` | Exact/over byte limits, arbitrary types, mismatched image hints, bounded classification, unusual filename encoding, progress, retry, lost finalize response, cancel/cleanup retries, all queue sources, screenshot names, duplicate-event handling, atomic aggregate rejection, reload/reselection and stable IDs. |
| `node scripts/verify-messaging-attachments-db.mjs` | Actual Inbox ancestor migrations and candidate on disposable PostgreSQL 17.6 with minimal external schema fixtures. Constraint and aggregate enforcement, actual-object mismatch/missing objects, actor/RLS matrix, immutable replay, concurrent duplicate begins, concurrent cancel/finalize, notification uniqueness, sender-only recovery, permanent-delete tombstone, inactive-recipient replay, legacy/historical preservation and cleanup. |
| `node scripts/verify-messaging-tus-browser.mjs` | Actual Chromium + tus-js-client against a local streaming protocol fixture: two 250 MB files, max chunk 6,291,456 bytes, 503 retry + HEAD resume, byte progress, active abort and native streamed 250 MB download. This is protocol fault injection, not a hosted Storage claim. |
| `node scripts/verify-messaging-storage-local.mjs --reset-local-fixture` | Actual local Supabase Storage 1.66.4/Auth/PostgREST: two 250 MB TUS files, byte-identical 250 MB download (SHA-256 match), attachment disposition, binary type, private sender/ready-recipient access, draft-recipient/unrelated/Admin/inactive/anonymous denial, guessed/public-path denial, signed-link expiry/renewal, repeat finalize, active MIME rejection, actual cancel/remove/discard, actual seven-day worker, original historical PNG bytes and new small TUS PNG preview. |
| `node scripts/verify-messaging-composer-browser.mjs` | Native clipboard text and screenshot paste in Chromium, multiple/mixed exposed file items, picker+paste+drop, drag feedback/reset and default prevention, keyboard picker access, unsupported clipboard fallback, scoped drop zone, and no network request from queueing. |
| `node scripts/verify-messaging-ui.mjs` | Built TenOps with intercepted disposable APIs: historical cards, explicit image preview, no eager signing/bytes, arbitrary picker, failed transfer retained across close/reopen, ID-only session recovery after reload, desktop/mobile layouts and no uncaught page errors. |
| Existing Inbox, typing-security, lifecycle/Admin-cleanup verifiers | Passed. Inbox structural assertions updated to follow the new Messaging-specific queue/controller; unchanged Task picker assertions retained. |
| TypeScript, targeted ESLint, `git diff --check`, Production build | Passed. Initial sandbox CSS-worker/IPC failures were rerun with the necessary local permissions; a JSX typo and fixture/schema-cache setup issues were corrected before final passes. |

Disposable fixture details and screenshots live under ignored `.tmp-messaging/`. Browser clipboard APIs are tested where Chromium exposes bytes; this is not a universal OS clipboard claim. Mobile layout was checked in Chromium at 390 px; physical iOS/Android large-file/backgrounding behavior is not certified. The database fixture applies the real relevant SQL but uses minimal surrounding app schema; it does not substitute for reviewing all policies in the target hosted environment.

Security observation: actual local download responses had `Content-Disposition: attachment` and `Content-Type: application/octet-stream`; `X-Content-Type-Options` was absent. Safety relies on forced binary downloads, the separate Storage origin and constrained image rendering, not an invented `nosniff` guarantee. Signed URLs remain transferable bearer capabilities until expiry, as before. No antivirus or quarantine was introduced or claimed.

## Review findings resolved

- Supabase permission probes have no actual size metadata; strict insert validation initially broke real TUS. Corrected with explicit incomplete-metadata handling plus mandatory final object checks.
- Cancellation failures must retry cleanup, not restart sending. Controller now serializes cancellation and retains that intent.
- Existing-operation replay must work after recipient deactivation or Job lifecycle changes. Identity is reconciled before new-send eligibility checks.
- Reloads must not silently create a new operation while an old result is uncertain. ID-only session recovery and a new-send guard resolve this.
- Shared Task upload behavior must remain outside this boundary. Messaging has its own queue; no shared-picker change.

## Release dependencies and remaining limitations

1. **Hosted global Storage limit/plan capacity remains unverified.** Confirm global capacity at least 250,000,000 bytes, actual endpoint/CORS/TUS support, and the effect on other buckets before any authorized configuration change. Local 500 MiB test configuration is not hosted evidence.
2. Chris must separately authorize migration/configuration application, any hosted test fixtures, cleanup scheduling, integration and deployment. None has occurred.
3. New metadata reservations intentionally replace the legacy attachment writer. Coordinate schema/config/frontend rollout and refresh old tabs; old attachment writes fail closed. Historical downloads and text-only messages retain their existing contracts. Do not apply just the bucket cap and advertise the feature.
4. Hosted target verification must inspect the complete policy/grant set and actual download headers, plus repeat the scoped actor/large-file gate in an authorized test context. No promise of immediate revocation of already-issued bearer URLs.
5. Cross-page recovery requires sessionStorage and original-file reselection; private/blocked storage can limit recovery to the current page. Clipboard-only images may need reattachment after cancellation. Incomplete TUS backend fragments rely on provider expiry, while completed abandoned objects are handled by the worker.
6. Per-file 500 MB remains deferred. Malware scanning/quarantine remains future work. Physical-device/network soak testing should precede claims of reliability on those devices.

## Exact intended changed-file boundary

- `package.json`
- `package-lock.json`
- `src/modules/my-work/InboxDialog.tsx`
- `src/modules/my-work/inbox.ts`
- `src/modules/my-work/messaging/files.ts`
- `src/modules/my-work/messaging/queue.ts`
- `src/modules/my-work/messaging/useAttachmentQueue.ts`
- `src/modules/my-work/messaging/transfer.ts`
- `src/modules/my-work/messaging/client.ts`
- `src/modules/my-work/messaging/TransferPanel.tsx`
- `supabase/migrations/20260925120000_messaging_large_attachments.sql`
- `supabase/config-changes/20260925_messaging_attachment_bucket.sql`
- `scripts/cleanup-messaging-drafts.mjs`
- `scripts/verify-messaging-attachments.mts`
- `scripts/verify-messaging-attachments-db.mjs`
- `scripts/verify-messaging-tus-browser.mjs`
- `scripts/verify-messaging-storage-local.mjs`
- `scripts/verify-messaging-composer-browser.mjs`
- `scripts/verify-messaging-ui.mjs`
- `scripts/verify-my-work-inbox.mjs`
- `docs/project-memory/2026-09-25-messaging-large-attachments-discovery.md`
- `docs/project-memory/2026-09-25-messaging-large-attachments-candidate.md`

## Reproduction and future integration

Install dependencies inside this worktree. For mocked built-UI checks use ignored `.env.local` with the synthetic localhost URL `http://127.0.0.1:54321` and a dummy public key; no hosted credentials are needed. Build before `verify-messaging-ui.mjs`.

For the PostgreSQL-only gate start the dedicated disposable `tenops-messaging-qa` container using `postgres:17.6`; the verifier creates a fresh database each time. For actual Storage, initialize Supabase only under ignored `.tmp-messaging-supabase`, set project ID `tenops-messaging-isolated`, API port 55431 / DB port 55432 and global file limit 500 MiB, then start its local stack. The integration verifier hard-checks localhost and port, refuses a preexisting public fixture unless `--reset-local-fixture` is explicitly passed, removes test bytes through Storage before resetting only that isolated fixture, and never accepts a hosted URL. Stop the dedicated stacks after validation.

After Calendar and the other workstreams are reconciled, obtain integration authorization. In the **Messaging worktree only**, inspect/fetch the future canonical `dev`, compare changes to this file boundary, and rebase `feature/messaging-large-attachments` onto the approved remote `dev` SHA. Do not rebase or switch the normal dirty checkout. Resolve only authorized overlaps, check the order/compatibility of new migrations, rerun affected Level 3 gates and the exact-candidate build, and regenerate artifact hashes if any prepared SQL changes. Report the replacement candidate SHA. Merge/cherry-pick into canonical `dev`, hosted application and deployment each remain separately authorized actions.
