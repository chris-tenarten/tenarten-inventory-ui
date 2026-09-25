# Messaging composer completion correction

Local candidate based on released V1.1 `1ff0a134a1389aa2a7fa0a2f91ef3d1a284a74fe`.
Client-only Tier 2 / focused Level 2 correction; no schema, Storage, operations,
authorization, preview, pagination, or transfer protocol changes.

## Cause and corrected state contract

The dialog treated any global transfer object as a composer lock. Sent/canceled
objects remain intentionally visible in the status panel until dismissal, and
startTransfer also rejected those terminal objects. Recovery UUID cleanup was
likewise coupled to dismissal. The panel's success effect additionally depended
on a changing callback, allowing repeated composer resets.

The dialog now subscribes to transfer **phase**, not byte progress. Only pending
states (including recoverable failure and cleanup failure) lock attachment entry,
text, Send, and conversation switching. Sent/canceled states are informational.
Terminal handling runs once per observed transfer: sent clears text/files and
reconciles its canonical message; canceled clears files but preserves unsent text.
The open composer receives focus. An already-terminal object on a fresh dialog
mount is treated as acknowledged, so a retained banner cannot replay a reset.
The existing close/reopen initial-conversation selection behavior is unchanged.

The client store independently clears session recovery on authoritative terminal
state, including recovered transfers, and permits replacement of terminal status
with a new transfer. Failed transfers retain their UUID, body, files, retry and
cancel semantics. Dismissal is optional and does not clear a later draft.

## Focused evidence

- `node scripts/verify-messaging-composer-completion.mjs`: real disposable local
  Auth/Storage/PostgREST/Realtime, actual InboxDialog, two Chromium sessions.
  Native screenshot paste, picker, drop, text+image, multiple attachments;
  immediate keyboard/pointer typing and next text send with status still visible;
  optional dismissal; next attachment without dismissal; failure/retry with same
  canonical ID; failure/cancel and active-upload cancel with unsent text retained;
  recovery UUID cleared; recipient attachment Realtime and bounded inline preview;
  one canonical recipient article and expected attachment count; light/dark at
  1280 and 390 px widths; no browser errors; historical fixture unchanged.
  Local fault injection replaces only the upload transport for failure/cancel cases.
- `npx tsx scripts/verify-messaging-attachments.mts`: in-memory byte-boundary,
  shared-entry queue, progress, lost-finalize response, retry identity, active
  cancellation, cleanup retry, and reload recovery checks passed. Large sizes are
  metadata stubs; no 50 MB/200 MB file transfers.
- Targeted ESLint, TypeScript (also through Production build), `git diff --check`,
  and Production build passed.
- Browser captures/results are ignored under `.tmp-messaging-completion/`.
  No generated bundle, credentials, or disposable fixtures belong in the commit.

The browser harness reuses only the existing guarded V1.1 setup, not the completed
V1.1 suite. Unchanged private authorization, 50,000,000-byte/file and
200,000,000-byte/message enforcement, preview and lifecycle contracts retain
V1.1 evidence. No hosted verification or mutation was performed for this fix.

## Release

Suitable for a streamlined client-only release after authorization. No migration,
bucket/global limit, cleanup function, Cron, or Vault changes are required.
Deploy the exact reviewed correction on the canonical V1.1 baseline (or verify
content-equivalent integration if canonical moves), then narrowly verify one
small attachment send followed by immediate composition without dismissal.
Do not repeat large-transfer suites. Production remains unchanged until release
is explicitly authorized. Normal checkout is untouched.
