# Messaging Admin deletion forward correction

Base: `91166183531c965cb92c04a18918fc919274b001`. Isolated release repository only. Tier 3 / focused Level 3. No migration or changes to Storage, participant policies, function definitions, grants, global limits, cleanup or Intake.

## Cause and correction

Supabase Storage remove requires SELECT as well as DELETE to locate objects. The existing nonparticipant Admin DELETE policy intentionally has no matching private SELECT. Actual local and hosted removal returned an empty success response while the objects remained; the locked final RPC correctly refused metadata deletion. Provider reference: https://supabase.com/docs/reference/javascript/v1/storage-from-remove .

The client now invokes only `admin-delete-messaging-message`. This dedicated JWT-verified Edge adapter accepts exactly a message UUID and permanent-delete confirmation, verifies the caller with Auth and checks active Admin status, and restricts targets to finalized non-system messages. It uses the existing caller-authorized prepare RPC for paths, validates their message/attachment namespace, removes those paths only from the fixed Messaging bucket with its server-side service credential, then invokes the existing caller-authorized final RPC. It never reads message bodies/file bytes or returns filenames/paths/signed URLs. No new ordinary Admin read capability is granted.

Finalization is authoritative: remaining Storage objects cause rejection. Empty Storage removal results alone are never success. Missing objects from a previous partial attempt may complete through the existing absence guard. Storage errors do not finalize metadata. Retry uses the same message identity; a matching deletion audit for the same currently active Admin returns `already_deleted`. A wrong path/body field/namespace, inactive actor, non-Admin, draft or system message is rejected. Concurrent/final-response ambiguity is reconciled through the audit. Partial network failure remains explicitly incomplete and retryable; no client-side success is shown. Cleanup remains restricted to abandoned drafts and does not touch finalized rows.

## Validation and deployment

`scripts/verify-messaging-admin-deletion.mjs` uses the existing disposable LOCAL Supabase fixture with tiny objects. It reproduces the original silent no-op, proves actual corrected deletion/metadata removal and same-actor idempotency, injects no-op/error/wrong-path failures, verifies participant download, nonparticipant Admin/unrelated/inactive/anonymous denial, an unrelated historical object unchanged, and cleanup compatibility. The disposable fixture's service SELECT grants mirror hosted grants. No large-transfer suite.

Focused TypeScript, client ESLint, diff and Production build are required. Existing implementation evidence is reused. Deploy only the new function using `supabase/operations/messaging/admin-delete-edge-config.toml` staged into ignored output, then promote the correction through the independent repository. Existing Supabase server-side service/anon environment keys are used; no new secrets. General attachment entry stays paused until bounded hosted smoke and historical comparison pass. Reopen uses the original reviewed gates with the newly deployed exact SHA substituted for the frozen identity.

Hosted execution evidence and final outcome are recorded in the isolated `.tmp-messaging-integrated-release` evidence directory. This document does not itself claim hosted completion.

Local results: focused real Storage/auth/database verifier PASS; TypeScript PASS; targeted client ESLint PASS; diff check PASS; Production build PASS. The first build attempt used out-of-root dependencies and the sandboxed compiler subsequently stalled; an isolated dependency copy and unsandboxed build completed successfully. `.env.local` contains only ignored public build configuration and is not committed.
