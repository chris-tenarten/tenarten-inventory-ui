# TenBot read-only invoice preparation — review candidate, October 30

Status: **implemented locally for review; migration unapplied; no deployment or spending activation**. Authority: Chris’s “UNBLOCK READ-ONLY INVOICE PREPARATION,” followed by “Up to $0.25 for this test only” and “Prepare a narrow preparation-only migration for review; do not apply it yet.” The latter decision defers database application and the dependent hosted demonstration. Separate Advisory context is unavailable. Tier 3 / focused Level 3; prior quantity, private-original and operational-execution evidence is reused.

## Root cause and correction

Preparation was coupled to execution in three places: hosted pilot/grant/enrollment checks; runtime/session requirements for `writeBusinessData` and `adjustInventory`; and PostgreSQL/Storage source contracts. Relaxing only the Edge wrapper cannot authorize canonical private-original upload or persistence. The expired ordinary meter and used canary funding window are independent constraints.

The proposed migration [20261031020000_invoice_preparation_read_boundary.sql](../../supabase/migrations/20261031020000_invoice_preparation_read_boundary.sql) separates **unapproved source preparation** from business approval/execution. SHA256: `35a4818b29170797f88c57e051c07def20da2f0407e4443d795893ea9ac48580`.

- Eligibility uses the genuine authenticated, active, non-read-only employee and existing `readOperationalData`. No role or capability grant is added. New weaker access is restricted to the approved synthetic PDF hash/MIME/2,877 bytes for every caller, not just chris_dev.
- Private source creation/read/Storage and verified source-state persistence permit that preparation. Owned sources must be unexpired, unbound and unretained. Retained/bound sources and legacy stronger document paths preserve their existing requirements.
- The chris_dev exception is limited to source insertion and its source-only deferred check. Business drafts, approvals, permits, execution, catalog/receival operations, cleanup and audit contracts keep their stronger checks.
- Exact final predecessor body hashes and the original source-policy hash fail closed on schema drift. A live, read-only metadata snapshot matched all seven functions and the policy; this is compatibility evidence, not proof that the new migration executes correctly.

Matching code adds a **default-OFF preparation mode** restricted to TenDev, genuine chris_dev, the fixed original and a server-validated window of at most 15 minutes. It reuses caller-scoped catalog/duplicate reads, canonical private-original Storage, source evidence, quantity validation and existing tool orchestration. Only status, upload and investigation are allowed. The resulting draft is non-executing, with approval disabled; the UI hides Save/Approve controls and labels the state accurately. Normal Messaging, history and the legacy workflow retain their default behavior.

## Funding contract — prepared, not activated

The authorized amount is **at most $0.25 for one hosted synthetic preparation test**. Separate server-only preparation authorization uses the existing atomic general reserve/settle ledger; it does not reset or reuse the canary window. Ordinary paid inference is forced OFF whenever preparation is enabled, including invalid/expired preparation configuration; history and Qwen fallback remain available.

Future activation requires a reviewed operator sequence: persist ordinary spending authorization OFF; drain older requests; lock the existing policy and account for all legacy, measured, reserved and uncertain usage; set a finite cumulative ceiling to that accounted amount plus 250,000 microUSD. Set employee/global request-count limits to current counts plus one so concurrent second turns cannot consume the allowance; keep the <=15-minute window within the same UTC accounting day. Multiple inference/tool steps of that single request share its request ID. Enable only the scoped preparation flag/spend flag. After the test, disable preparation, expire/disable the temporary meter policy, then restore prior ordinary configuration only after its old expired boundary is verified. Preserve every usage/reservation row. Route isolation is enforced by Edge; this is **not a new independent SQL budget pool**. None of these configuration changes occurred in this pass.

## Evidence and remaining gates

[Focused receipt](evidence/2026-10-30-tenbot-receival-readiness/readonly-preparation/summary.json):

- Requested Management retries: `GET /secrets` **200**, `POST /database/query` **201**, once each with 10-second bounds. Pilot/execution/funding OFF, grants/enrollment zero. Earlier 502s do not establish a database outage.
- **6 focused preparation groups passed**, using scripted transport and simulated caller/Storage replies. Actual runtime reaches one **1 Bag** non-executing draft with both write capabilities false; wrong identity/document/window and fresh permission revocation fail closed. Ordinary paid requests cannot consume preparation funding.
- **14 adjacent hosted regression groups passed**. **8 static migration/transform groups passed**, checking exact substitutions, ownership, retained-source restrictions, source evidence and unchanged business-trigger branches. These are not real PostgreSQL/JWT/RLS results.
- TypeScript, explicit affected-source/test ESLint, diff check, independent security review and optimized build passed. The exact task-only archive excludes unrelated dirty work and contains no `.env` or secret. Build artifact integrity is not a selective-release proof for the new migration.
- **No actual inference ($0), upload, source-state mutation, grant, enrollment, approval, receival, migration application, push or deployment.** No new hosted 1 Bag result or diagnostic-retention claim. Existing default OFF controls and historical accounting were untouched.

Before staging: Product must accept the review candidate and authorize isolated database application/testing of this new migration. Real JWT/RLS, Storage, revocation, source/approval separation and concurrency tests must pass before any shared migration application. Then prepare the selective TenDev candidate containing accepted metadata correction plus this boundary, rerun mandatory release proof/build, stage with writes/grants/enrollment OFF, configure the finite preparation-only allowance and perform the single authorized Terra test. Operational execution still needs separate Product authorization.

Last verified TenDev remains `65e52868fed5c11e1fef310fdfd7b04bdd9a4b10`, deployment `8e9dcd06-68b3-495f-a374-d3c0e7735ff9`; no staging was attempted in this review-only pass. Task scratch: `/private/tmp/tenops-tenbot-readonly-preparation-20261030`. No review server/port changes; localhost:3000 and unrelated dev work preserved.
