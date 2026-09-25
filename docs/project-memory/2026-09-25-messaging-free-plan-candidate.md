# Messaging universal attachments — Free-plan candidate

Chris's September 25 product revision supersedes the earlier size contract. This is a local candidate, not a hosted release. Work remains on `feature/messaging-large-attachments` in `/private/tmp/tenops-messaging-large-attachments`, based on canonical `a76f4f83e66a1d3b149ff31bff44874a39c1b6f3`, following original candidate `1df2ff41839903a4e23986806861363945bd9f29`. The normal Planning checkout must not be touched. Resolve this candidate's SHA from the commit containing this report; do not embed a self-referential hash.

## Current Product Acceptance Contract

1. Maximum individual file: **50,000,000 bytes**, displayed as **50 MB per file**. Selection over that limit is rejected before transfer; DB and Messaging bucket also enforce it.
2. Aggregate attachments per pending message: **200,000,000 bytes**, displayed as **200 MB per message**. Exact integer arithmetic across all files; four full-size files allowed, a fifth full-size file or one extra byte rejected. No arbitrary attachment-count cap.
3. Essentially arbitrary types/extensions are transferable, including unknown formats, archives, CAD and active/binary files. Transfer has no extension allowlist.
4. Picker, clipboard files/images and composer-local drag/drop use the same queue and validators. Duplicate events are handled once; rejection preserves the existing queue atomically.
5. Ordinary/mixed text paste remains native and existing composer text is preserved. Screenshot names are readable and collision-safe. Unsupported clipboard-byte exposure fails gracefully with picker/drop fallback. No text/HTML-to-file conversion or Base64 image message payload.
6. Composer-scoped drop state clears correctly, prevents file navigation on the target and preserves keyboard file-picker access.
7. TUS remains direct browser → private Storage with 6 MiB chunks; no large bodies pass through Next.js/Cloudflare application memory.
8. Show progress and support cancellation, recoverable errors, safe retry and idempotent finalization. One transfer produces at most one ready message/notification.
9. Immutable metadata reserves the entire aggregate atomically. Collision-safe message/attachment UUID Storage paths preserve original user-visible filenames separately. Actual object bytes must match reservations before finalization.
10. Transfer survives panel closure. Reload recovery stores only an account-scoped operation UUID; original-file reselection may be required. Browser exit does not guarantee continued upload.
11. Cancel/cleanup serializes against completion, retains failed cleanup intent, and never deletes on ambiguous finalize success. Seven-day inactive drafts use the prepared retryable cleanup worker; incomplete TUS sessions rely on provider expiry (up to 24 hours).
12. Storage remains private. Active sender / ready-message recipient authorization remains; no Admin routine content-read bypass. Short-lived signed download URLs remain bearer capabilities until expiry.
13. Every attachment has Download independent of preview. Unknown/active types use binary Storage content type and forced download with an encoded original filename. Safe optional PNG/JPEG/GIF/WebP previews stay bounded; no arbitrary renderer added.
14. Conversation/message loading fetches metadata only, never eager attachment bytes or eager preview/download URLs. File handles and bounded reads avoid whole-file memory copies.
15. Historical ready messages, metadata, Storage relationships and deletion behavior remain unchanged; no scanning/quarantine guarantee is added.
16. Hosted global limit stays **52,428,800 bytes**. No plan upgrade, global-cap change, `project-task-attachments` change or unrelated-bucket preservation artifact belongs to this release.
17. Focused Level 3 validation and explicit release authorization remain required for database/bucket changes, scheduled cleanup, hosted fixtures and deployment. This contract authorizes isolated implementation and a local candidate commit only.

## Infrastructure / release reassessment

Fresh read-only Management API check reconfirmed global `fileSizeLimit=52428800`. The proposed Messaging `file_size_limit=50000000` is strictly below that ceiling by 2,428,800 bytes and is supported by the provider's per-bucket/global rules. Actual disposable Storage is tested with the same 50 MiB global ceiling; this is separate from hosted verification. No hosted setting was changed. [Supabase file limits](https://supabase.com/docs/guides/storage/uploads/file-limits).

Only Messaging bucket changes: private 26,214,400-byte baseline → 50,000,000 bytes and `allowed_mime_types=NULL`, with `public=false` preserved. The unapplied candidate migration is revised in place because hosted inspection confirms its version/functions/columns are absent; no applied migration was edited. It changes the metadata constraint and atomic aggregate checks consistently. Authorization/transfer code is otherwise unchanged.

| Previous gate item | Revised result |
| --- | --- |
| Paid plan / global size cap | Resolved for this contract; existing cap is sufficient. No upgrade or global change required. |
| Unrelated bucket preservation | Removed from scope; inherited global ceiling stays unchanged. |
| Messaging bucket configuration | Still pending separate hosted authorization/application; guarded SQL remains required. |
| Database migration | Still pending separate authorization/application; version `20260925120000` had no hosted collision at read-only gate. Recheck before release. |
| Daily abandoned-draft cleanup | Worker prepared, but no selected/deployed trusted runner, runtime secrets or schedule/alerts. Remains an operational blocker. |
| Attachment maintenance / refresh | Required transition plan: old attachment clients fail closed after migration; drain/reconcile drafts and refresh stale tabs. Text/history remain compatible. No dedicated maintenance switch exists in this candidate. |
| Recovery | Must prepare a compatible attachment-disabled client or forward-repair path; old-client rollback alone is not functional attachment recovery after migration. Keep data/schema/private Storage intact. |
| Free-plan Storage/egress quotas | Ongoing operational capacity constraint, not a per-file incompatibility or mandatory upgrade. Prior gate showed 1 GB included Storage and 5 GB uncached egress, with restrictions possible beyond quota. Recheck usage and agree monitoring/restriction handling before release; 200 MB messages can consume these allowances quickly. |

Release sequence after separate approval: fresh baseline/hashes/config recheck → prepare client and recovery/cleanup runner → short attachment-upload maintenance and drain → targeted migration and version recording → guarded Messaging bucket update → verify daily cleanup schedule/secrets/alerts → deploy pinned client → refresh tabs, narrow authorized hosted smoke and historical comparisons → reopen attachments. Do not use blanket migration push against the sparse historic ledger. No plan/global/other-bucket step is required.

If release fails, keep attachment submission disabled rather than advertising a cap the backend rejects. Preserve private objects, metadata and the new schema; forward-repair or use a compatible disabled client. Do not lower the DB constraint over existing larger records or make files public. Planning reconciliation stays separate.

## Validation and artifacts

Tier 3 / Testing Level 3 applies because this changes persisted limits and Storage configuration. Focused updated verification results and SHA-256 hashes follow. Earlier validation evidence is historical in the original candidate report and is reused only for unchanged behavior; no old transfer-size suite is rerun.

| Focused gate | Result |
| --- | --- |
| Shared queue/controller | PASS: exact 50,000,000 per file, four valid objects totaling 200,000,000, one-byte-over rejection, five full-size files rejected, mixed picker/paste/drop, unknown/mismatched MIME, progress/cancel/retry and reload. |
| Actual disposable PostgreSQL migration | PASS: revised DB boundaries, actual-object checks, role matrix, immutable replay/concurrency, cancel/finalize, cleanup, historical rows and unchanged unrelated bucket fixture. |
| Actual Chromium TUS protocol fixture | PASS: four 50 MB files, 6 MiB max chunks, injected 503 + HEAD resume, progress, abort and native 50 MB download. |
| Actual local Supabase Storage/Auth/PostgREST | PASS: global FILE_SIZE_LIMIT exactly 52,428,800; four real 50 MB TUS files and 200 MB finalization; oversized file/aggregate denied; byte-identical signed 50 MB download; sender/recipient access and unrelated/Admin/inactive/anonymous denial; expiry/renewal; binary/forced download; small PNG TUS preview; cancel cleanup and actual abandoned worker; historical bytes intact. |
| Composer browser | PASS: native text/screenshot paste, filename handling, multiple/mixed clipboard files, picker/paste/drop, duplicate-event handling, drag cleanup, keyboard picker and unsupported clipboard fallback. |

- `supabase/migrations/20260925120000_messaging_large_attachments.sql` SHA-256: `eaab161c58a55efeee161d9252ef984acc013bf53b1eb5a8a00635cacc7328d2`

- `supabase/config-changes/20260925_messaging_attachment_bucket.sql` SHA-256: `c04c55c040a4c58fdeb860a368c085e589e60fa8f022a947cbdf5d314750b9f6`

- `scripts/cleanup-messaging-drafts.mjs` SHA-256: `6144c8b49de1b85589cfe26494adf63b6f011fc4d8de1feed6d1593c9f201e31`

Ignored evidence lives in `.tmp-messaging/` (revised TUS, Storage, composer and UI JSON/screenshots/build log), and `.tmp-messaging-release-gate/revised-storage-config.json` (fresh hosted read-only capacity). No credentials or generated artifacts are committed; `.env.local` stays ignored with synthetic local fixture values. The previous full hosted integrity baseline is still available in that ignored gate directory, but must be refreshed at release. No hosted transfer or mutation was performed. No original large-transfer suite was rerun.

Built UI browser gate PASS: revised limit help copy, desktop/mobile queue screenshots, no overflow, no eager signing/bytes, preview/download separation, transfer retention and ID-only reload recovery. Production build, TypeScript, targeted ESLint and diff check PASS. Visual review of the 390px composer confirms both revised limits are readable. Initial sandboxed build could not bind a local subprocess port; rerun with the permitted execution context passed.
