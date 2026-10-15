# Sample PDF → Job Update — local Product review

Chris superseded standalone Attach to Job with Post to Job on October 15, 2026. The prior blanket Job attachment authorization proposal was removed before validation. This candidate is uncommitted on `feature/sample-job-attachments` in `/private/tmp/tenops-sample-job-attachments`, based on fetched canonical main/dev `7f819d230f63b544b161a8fdadd83ff488c76c54`.

## Result

Generated Sample previews offer **Post to Job** → searchable existing Job → optional message and canonical @mentions → **Post Update**. An empty message gets `Sample document: <filename>` because the existing Update contract requires a body. The exact generated PDF is fetched once per preview and uploaded without regeneration or overwrite. No Sample/Job relationship is created. Sample formulations, issued history and Production records are unchanged.

Supported previews: Sample Work Orders (new and historical issued PDFs), current/saved-version Working Sheets, and Production Material Quantity Blend Sheets. The existing Sample preview supplies the bytes and explicit document classification. Print/Open/Download remain available through the existing viewer.

The implementation reuses `job_updates`, `job_attachments`, private `job-attachments`, `job_update_id`/`job_update_attachment_role`, `create_job_update_with_mentions`, `JobUpdateMentionTextarea`, collaborator loading and existing notification functions. No new tables, buckets, infrastructure or capability toggles.

## Authorization and release dependency

Risk Tier 3 / Testing Level 3: persistence, authorization and document snapshots.

Repository inspection shows authenticated `create_job_update_with_mentions` already checks `postJobUpdate`, active account and canonical attribution. Its existing mention synchronization validates active targets and invokes existing keyed notifications. The released business-write guard additionally requires `writeBusinessData`. However, raw Job Update table inserts have permissive compatibility policies without a `postJobUpdate` requirement. The candidate adds that narrow restrictive INSERT check, rather than applying the superseded DO NOT APPLY migration.

The new publishing/search RPCs are SECURITY INVOKER and honor existing Jobs SELECT RLS plus `writeBusinessData`, `postJobUpdate`, and `uploadSupportingFiles`. They do not require elevated Job detail editing. Existing Jobs policies and role grants are unchanged. Storage/metadata restrictions are confined to the new `<job>/sample-updates/<request>.pdf` namespace; existing manual attachment paths remain unchanged. Generated objects/metadata cannot be updated in place. Existing authorized deletion/cleanup workflows remain in effect.

`20261015170000_sample_job_update_publishing.sql` must be independently reviewed and validated, then separately authorized for application before releasing this UI. **Not applied anywhere hosted.** Actual hosted authorization has not been asserted from repository inspection.

One request UUID is retained per preview/destination Job. A transaction advisory lock plus existing unique storage path makes retries return the original Update. Update creation, metadata and mention notifications commit together; upload precedes that transaction. Definitive database rejections attempt upload removal only after checking that no attachment metadata exists. Ambiguous transport failures retain the upload and request ID for safe retry. If the operator abandons an ambiguous request, an unreferenced object may require cleanup; no automatic retention/deletion system was added.

## Validation evidence

- PASS TypeScript (`tsc --noEmit`), targeted ESLint, `git diff --check`.
- PASS existing Job Update collaboration source-contract verifier and canonical mention composer verifier.
- PASS production export build using Webpack. Initial Turbopack attempt failed solely because it rejects a shared dependency symlink outside this isolated worktree. The build launcher records the Webpack choice; no application build configuration changed.
- PASS actual localhost:3000 browser workflow against disposable records: Generate/Preview; no-message post; exact PDF byte comparison after retrieval; existing attachments preserved; canonical mention selection; upload failure; definite post failure and cleanup; lost-response retry with one Update/notification; unchanged Sample; Job Updates feed. Two Updates, three attachments including the original fixture attachment, one simulated mention notification. Zero external browser requests and zero page errors. Screenshots/results are in `output/sample-job-updates/`.
- **BLOCKED:** live PostgreSQL/RLS/notification verification. Docker Desktop was started but daemon operations timed out, including the escalated disposable database verifier. No database authorization pass is claimed. `scripts/verify-sample-job-update-db.mjs` is prepared but must pass before release; notification browser evidence uses a disposable adapter, not the real SQL notification transport.
- Browser continuation corrected only local adapter/test contracts (ancillary recent-values save, multipart upload parsing, blob CSP, existing mention option semantics and direct Updates indicator). Application source did not change after successful source checks/build.

## Product review

Running URL: http://localhost:3000/samples?open=00000000-0000-4000-8000-000000710001

Uses normal TenOps sign-in. Only authentication and the existing account-access read are forwarded through the reused read-only review request planner. All Sample/Job/PDF/upload/Update operations use disposable in-memory records and the existing PDF renderer. Arbitrary hosted business operations remain blocked; no hosted service-role key is used. This is required because the existing read-only guard blocks the generation and attachment writes needed to demonstrate this feature. Unattended browser tests use `--fixture-auth`; the running Product review does not.

Sign in, generate the Sample Work Order, Post to Job, select `Disposable Job — Sample review`, optionally @mention, and post. On Production, open the Updates indicator for `LOCAL-901`. Review records reset when the launcher restarts. Start with `./node_modules/.bin/tsx scripts/start-sample-job-update-review.mts`; build with `node scripts/build-sample-job-update-review.mjs`.

PASS fresh-browser smoke check: normal email/password sign-in screen at the exact localhost origin and unauthenticated publishing rejected with HTTP 403. Unattended tests did not use Chris's credentials or authenticate a real account. No commit, push, hosted mutation, migration application, Edge deployment, TenDev overwrite or Production deployment occurred.

## Exact changed files

- `src/components/documents/DocumentViewer.tsx`
- `src/modules/samples/SampleWorkspace.tsx`
- `src/modules/samples/PostSampleToJob.tsx`
- `src/modules/samples/post-to-job.ts`
- `supabase/migrations/20261015170000_sample_job_update_publishing.sql`
- `scripts/build-sample-job-update-review.mjs`
- `scripts/start-sample-job-update-review.mts`
- `scripts/validate-sample-job-updates.mjs`
- `scripts/verify-sample-job-update-browser.mjs`
- `scripts/verify-sample-job-update-db.mjs`
- `docs/project-memory/2026-10-15-sample-job-update-local-review.md`
