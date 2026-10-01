# Sample Admin Delete — local review verification, 2026-10-01

> **KEEP — current dated local-review evidence, not Product formulation authority.** For the canonical Batch-first model and final reconciliation, consult the [current Product authority](2026-10-01-sample-batch-first-authority.md). Environment and verification claims below are scoped to the recorded October 1 run; reinspect live state before acting.

Candidate `674347b589e350cbe4dac07ede64654465a6c29a` remains unchanged. Actual TenOps review route: http://localhost:3000/samples. Restored detached worktree: `/private/tmp/tenops-sample-delete-review`. Disposable database: `tenops-sample-batch-review-11620`. Chris explicitly authorized replacing PID 11034; only that dev server and the agent-owned review adapter were stopped/restarted.

## Root cause and repair

Review-environment defect, not an application regression: local RPC dispatcher omitted Admin/creator draft deletion and returned an empty successful response for unknown RPCs. Database bootstrap omitted the existing deletion lifecycle and Admin draft deletion migrations. The local PDF adapter also rejected issued deletion. Restored existing SQL contracts locally using `20260917_003_sample_deletion_lifecycle.sql` then `20260917_006_sample_admin_draft_deletion.sql`. Local adapter now forwards draft deletion and handles issued cleanup in the established order (Admin authorization/preparation, owned local PDFs, clear storage pointers, database deletion). No Product semantics or tracked application code changed.

The restored adapter also supports the empty standalone Bid list and existing recent-value RPCs using `20260902_005_sample_recent_value_suggestions.sql` locally. Neither operation contacts hosted services.

## Actual UI verification

Chrome native UI at exact localhost:3000 origin, signed in as Local review Admin:

1. Created and saved `Disposable Admin UI deletion check`; four formulation rows; saved working version 1.
2. Closed editor and observed named Draft Library entry.
3. Used Delete Draft as Admin, accepted its confirmation; request evidence confirms `admin_permanently_delete_sample_draft`.
4. Observed success message and immediate disappearance.
5. Refreshed browser and observed the record still absent.
6. SQL and RPC result confirm four material rows and one working version removed, with zero parent/child residue.
7. Unrelated MTT Sample snapshot compared byte-for-byte to pre-test baseline, unchanged.

Additionally duplicated the MTT fixture solely for document checks, generated and visually viewed the actual Working Sample PDF, formally issued the disposable copy, then used Permanently Delete Issued Sample and its typed Admin confirmation. Eight material rows, one issued document and its generated local PDF were removed; browser refresh did not restore the record. Original MTT Sample remained identical.

Tier 3 / Testing Level 3 focused deletion verification: existing `scripts/verify-sample-deletion-lifecycle.mjs` passed in an isolated database; repaired current V5 API dependency checks passed; actual UI draft and issued lifecycle checks passed. Candidate webpack Production build/TypeScript and diff checks passed. No application changes required further lint or unrelated regression reruns.

## Review data and release boundary

No localhost disposable Sample rows may be copied/migrated/seeded into hosted Production. The four candidate migrations since af334e4 were inspected: chip basis, reference thickness, Batch-first authority and history. They do not import review Samples, blend rows, versions or issued documents. Runtime insert statements are parameter-driven function definitions; operational profile metadata updates are intentional Product configuration, not review Sample rows.

The repository contains test/review fixture definitions and documentation/evidence identifiers. These are not Production seeds or imports into deployed application code. Local database contents and generated review PDFs are not release artifacts. No hosted mutation, push, deployment or release occurred.

The prior temporary environment had disappeared before resumption. The current restored DB was preserved throughout this UI verification. Its representative MTT record is `81fd46ea-5f18-46ad-aa2d-a5549274efb9` (MTT Batch-first review). Original temporary catalog snapshot was not recovered; current fixture uses manual material descriptions. This deletion verification does not claim full-catalog restoration or catalog acceptance.

Candidate worktree tracked/untracked status is clean; local adapter/evidence scratch files are ignored under `.tmp-review`. This report/evidence are new uncommitted records in the main workspace. Preexisting unrelated changes were untouched.

Evidence: [JSON](evidence/2026-10-01-sample-admin-delete-local-review.json).
