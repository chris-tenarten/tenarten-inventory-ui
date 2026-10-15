# Post to Job — recovered candidate and database qualification

Date: October 15, 2026. Local-only; no release authorized.

## Recovery

Persistent worktree: `/Users/chrisngo/source/worktrees/tenops/sample-job-updates`.
Branch: `feature/sample-job-updates-recovered`.
Original base: `7f819d230f63b544b161a8fdadd83ff488c76c54`.
Exact recovery commit: `1162fbf3d74323162606fd9b0f4b9ecc6fec0e20` (eleven files).

Recovered from recorded file writes and deterministic edits in the October 15 Codex session. Session lines used: 92, 112, 177, 182, 189, 194, 204, 226, 270, 279, 286, 301, 318, 347, 364, 374, 379. Historical shell commands were not executed. File operations were replayed in an in-memory filesystem, restricted to the candidate/recorded intermediate paths, before writing the final eleven-file boundary. Superseded standalone attachment files remain absent.

Preserved session snapshot and restoration SHA-256 receipt: `/Users/chrisngo/source/worktrees/tenops/.recovery/sample-job-updates/`. The receipt records new restoration hashes, not original final-file checksums. Original checksums were unavailable; byte-for-byte identity with the missing directory is not claimed. All recorded edits were applied; the manifest matches the original review report, and the restored SampleWorkspace Git blob prefix matches the saved diff (`ac5d25a`). Saved browser/PDF/build/source-check evidence remains in the preserved session.

The original historical report is restored unchanged at [original local review](2026-10-15-sample-job-update-local-review.md). Its temporary worktree/running preview and blocked database descriptions are historical and superseded by this record. No preview server was restarted during this qualification.

## Focused Tier 3 database validation — PASS

Ran only `node scripts/verify-sample-job-update-db.mjs`, using uniquely named disposable `postgres:17.6` containers. Each verifier run cleaned up only its own container. Existing databases, containers, volumes and stale worktree metadata were not reset or modified.

The recovered verifier passed initially. Focused coverage was then completed within that same verifier for explicitly requested cases absent from its original assertions. A quoting error in the new assertion was corrected before database execution; a fixture startup race was corrected by requiring TCP readiness (`pg_isready -h 127.0.0.1`), matching the established fixture helper. No application or migration change was required. The final focused run passed:

- Authorized active Member can publish to a visible Job; hidden Job is denied by invoker RLS.
- Guest direct Job Update table insertion denied; anonymous publishing RPC denied; inactive/Guest publishing denied.
- Guest, inactive, anonymous, null-identity and hidden-Job generated Storage INSERTs denied without object-count changes.
- Unauthorized generated attachment metadata denied; generated Storage objects cannot be updated in place.
- Ordinary existing `create_job_update_with_mentions` workflow and manual attachment namespace remain functional; canonical author attribution and original attachment association preserved.
- Actual SQL mention/notification functions produce one keyed notification for the active canonical recipient with the expected type and Job/Update deep-link metadata.
- Inactive mention causes transactional rollback of Update, attachment metadata and notifications.
- Retry uses the retained upload and request ID; repeating publication returns the original Update and does not duplicate its notification.
- Definitively rejected publication permits removal of its unattached upload; zero unreferenced Storage catalog objects remain at the end.
- Empty message produces the existing-contract document caption.

Final output: `PASS real PostgreSQL: permitted/hidden Jobs RLS; direct-insert denial; denied guest/inactive/anonymous/hidden-Job generated uploads; generated metadata denial and immutability; ordinary Update/manual attachment compatibility; canonical mention notifications; atomic failed-post rollback; safe retry/idempotency; cleanup permissions and zero unreferenced Storage rows. Physical PDF bytes and Storage API cleanup reuse prior browser evidence.`

Scope limit: this verifier executes real PostgreSQL RPCs/RLS and Storage catalog policies, using a focused bootstrap. It does not run the Supabase Storage HTTP server or physical object store. Exact PDF bytes and frontend Storage request/retry/cleanup behavior reuse the already-passed browser workflow against a disposable HTTP adapter. No frontend, PDF, build, TypeScript or lint suite was repeated.

## Canonical compatibility / remaining release dependencies

No rebase, cherry-pick or canonical reconciliation was performed. Read-only `git ls-remote` returned both remote main and dev at `7f819d230f63b544b161a8fdadd83ff488c76c54`. Chris reports newer Production behavior; a separate deployment-to-source/release-boundary reconciliation is therefore required before release. Do not assume those remote refs prove the currently served Production deployment.

The original-base candidate's requested qualification gate is PASS. Production release still requires Product authorization, confirmation/reconciliation against the actual released deployment, and separate authorization to apply the reviewed candidate migration `20261015170000_sample_job_update_publishing.sql`. No hosted migration/write, Edge deployment, push, merge, Production/TenDev deployment or Sample Matcher change occurred.

## Exact restored files

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

Post-recovery qualification changes: focused assertions/readiness in `scripts/verify-sample-job-update-db.mjs`, and this qualification record. All other recovered-file hashes remain identical to the restoration receipt.
