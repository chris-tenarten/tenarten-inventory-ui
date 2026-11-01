# TenBot live-answer history and consistent follow-ups — November 1, 2026

**Implemented locally; pending Product acceptance. No push/deployment.** Chris's current **FIX LIVE ANSWER HISTORY & FOLLOW-UP CONSISTENCY** authorizes this correction, bounded reauthorized history, focused real database validation and a dev commit. Separate Advisory context is unavailable. Production baseline is accepted `01c0b4576a61329d973ce65ca58437ce26627be1`; dev parent is `a5a5a14d06095d9cbc098f39fa5bf3aa7b4ab5e1`. Relevant application predecessors are compared against the retained exact Production source. Preserve unrelated dev work; do not promote dev wholesale.

## Confirmed causes

The composer explicitly nulled every previous volatile answer on each send and window blur. Its old refresh path restored only the latest live turn. Server history intentionally excluded every operational answer, so navigating/reopening could not restore the other completed results. The previous context correction retained the subject, but did not change this display policy.

The reference resolver omitted **they/them**. “Which Jobs are they?” could therefore become a lookup for **are they**, producing an empty search despite the earlier count. A separate bounded-enumeration defect marked an empty filtered subset as complete even when further pages remained; its renderer could assert no matches. These are routing/completeness defects, not evidence of an authorization failure or a model-quality diagnosis.

## Correction and boundaries

The existing owner/lease/CAS history store accepts a separate optional `operational` display-receipt array. At most **four answers**, each up to2,400 characters, survive for **ten minutes**. Each receipt contains the submitted question, timestamp, scope/source proofs and up tofour exact existing Job-read argument/hash pairs. No raw result rows, tool snapshots, provider continuation, invoice or new model memory is stored. Operational display text never reaches subsequent model prompts.

Every restoration reexecutes the original allowlisted reads with the **current caller JWT/RLS**, verifies current knowledge grants and descriptor scope, and compares normalized current evidence hashes. Changed, unavailable, revoked or expired evidence produces a generic redaction of **both answer and identifying question**. Global capability revocation denies hydration. Publication is checked again after asynchronous persistence. History hydration does not renew expiry or invoke inference. New asks prune expired receipts independently of maintenance.

The verification budget is eight distinct reads per hydration, prioritizing newest answers so old receipts cannot block a valid new turn. Older answers outside the bounded window/budget may be unavailable. This is a conservative revalidated view, **not an immutable operational audit**: even an otherwise legitimate facts update can redact an older answer when exact evidence can no longer be established. The subject/reference still survives for a fresh follow-up. Incomplete/over-budget investigations are not guaranteed retained display history.

The client keeps eligible answers across ordinary sends, displays their historical timestamps and a **Previous answer · access and evidence rechecked** label, and reauthorizes on focus and periodically. A send waits for an in-flight model-free history check instead of racing its lease. Reopening/remounting restores eligible text; browser storage still contains only the owner-bound opaque locator. Read failures redact prior operational content rather than leave it readable indefinitely. Existing verified static help remains on its established proof/retention path. The info-popover wording now accurately describes bounded operational display retention.

Count/list references share the same canonical status/archive population. Existing effective lifecycle/Rework facts remain authoritative. Overview date bounds apply to upcoming completions, not current population counts. Bounded/inconsistent pagination remains explicitly partial and cannot assert zero matches. Both Qwen fallback and the primary provider's existing `find_jobs` adapter reuse the canonical scoped enumeration; a pronoun in generated arguments does not become another population. The scoped list is rendered from authorized facts, so a model-generated zero claim cannot overwrite a nonempty result. No new capability or broad intent framework.

## Actual focused evidence

Tier3 / focused Testing Level3, because this changes private persistence and authorization-sensitive restoration. [Functional receipt](evidence/2026-11-01-tenbot-live-history/functional.json), [database receipt](evidence/2026-11-01-tenbot-live-history/database-results.json), [retention receipt](evidence/2026-11-01-tenbot-live-history/retention.json), [browser receipt](evidence/2026-11-01-tenbot-live-history/browser.json), [manifest](evidence/2026-11-01-tenbot-live-history/validation.json).

- **12 actual PostgreSQL/Auth/JWT/RLS groups PASS**, existing isolated Free project `jltgxcfiprocydhbrahz`. Three fresh synthetic Member/Member/Admin identities signed in and were verified by Auth; actual Supabase SDK/caller tools and canonical history RPCs were used. No real employee session, fabricated JWT or Production request.
- Actual count **2 In Production** → actual list **HIST-1/HIST-4**, including effective active Rework and excluding On Deck, On Hold and archived records. The named Job's **5 hours** restored readably. A genuine Job RLS denial redacted its text and identifying question. Changing recorded hours redacted the previous result; a fresh read returned **6 hours**. Employee/Admin cross-owner access and direct raw-state reads were denied. Capability revocation, ten-minute expiry and invalid retention commits were rejected. Static help still restored without inference.
- **Five real retention checks PASS**: skip active claims, remove expired text, idempotent retry, employee EXECUTE denial and service-role EXECUTE denial. A synthetic history row was tested inside a rolled-back transaction; the private maintenance function remains installed only in the isolated fixture. No scheduler was installed/enabled there.
- **44 deterministic groups PASS** against the final task-only source:10 focused defect/adversarial groups,11 adjacent context,13 history/publication/CAS,10 hosted/fallback. These use synthetic transports; the adversarial primary-model transport is **not real Terra inference**.
- **Five actual localhost desktop/mobile Messaging checks PASS**: simultaneous readable count/list, blur/focus reauthorization, remount/restoration without another ask, no operational text in browser storage, usable mobile composer. Synthetic Auth/data/model transport, blocked external requests. [Desktop](evidence/2026-11-01-tenbot-live-history/desktop.png), [mobile](evidence/2026-11-01-tenbot-live-history/mobile.png).
- TypeScript, targeted ESLint including Edge sources, diff check and final task-only optimized Production build PASS. No knowledge regeneration or selective-release-proof claim. Existing unrelated latency edits are excluded from this source/build/commit.

No real Terra/Qwen inference, paid charges or spending-policy changes. The real database exercise uses the existing deterministic fallback, not scripted output substituted for a claimed live model result. No hosted employee validation or shared-schema release certification is claimed.

Synthetic accounts3 and task Jobs5 were removed, along with task labor/Rework rows and the restrictive test policy. Prior fixture evidence was not reset/truncated. The three previously missing fixture read tables/policies remain as isolated test prerequisites; no Inventory/catalog/receival/stock endpoints were invoked. The fixture's legacy material constraint was preserved. All shared/Production controls, data, providers and budgets remain untouched; no agent writes enabled.

## Migration and release gates

Two new, append-only migrations, **UNAPPLIED to shared/Production**:

1. `20261101180000_tenbot_reauthorized_operational_history.sql`: strict optional receipt validator in the existing store; old states remain valid; owner RLS/ACL/claim/load/commit/release/clear unchanged.
2. `20261101181000_tenbot_operational_history_retention.sql`: private postgres-only, count-returning purge of expired operational text, at most100 histories per call, skipping active claims. Static guidance, subject context and conversation lifetimes are preserved. No HTTP wake, credential or new business authority.

Exact SHA256s are in the [source manifest](evidence/2026-11-01-tenbot-live-history/source-manifest.json). The context-validator prerequisite and both new SQL contracts were applied only to the isolated assistant fixture. Applied historical migration files are untouched.

Before release: Product acceptance; exact selective source proof/current shared-schema compatibility; reviewed migration application; matching UI/Edge transport compatibility (old clients accept only workflow/scope history); and **private purge scheduling through existing trusted database infrastructure**, e.g. every minute invoking only `public.tenbot_purge_expired_operational_history()`. Expiry still denies display if cleanup fails. The isolated fixture has no scheduler; scheduling and its hosted operation remain a mandatory release gate, not a completed result. No general scheduler redesign/service provisioning. A separately approved coordinated rollout must preserve old-client behavior and all write gatesOFF. No hosted configuration action is authorized by this local receipt.

## Local Product review

**http://localhost:3000/my-work** → Messaging → TenBot. Disposable synthetic login: `customer-review@example.invalid` / `Local-review-only!`. Ask “How many Jobs are currently in Production?”, then “Which Jobs are they?”, blur/focus, reload and reopen. This actual app uses a loopback-only synthetic API on **55597**, with no paid inference or hosted data access. Real PostgreSQL security evidence is separate from this UI demonstration.

The existing static server on3000 was preserved; the previous export is backed up in `/private/tmp/tenops-tenbot-live-history-20261101/prior-localhost-out.tar`. Final review source, logs and receipts are in that task scratch directory; API process metadata is tracked in the existing `/private/tmp/tenops-tenbot-context-20261031/review-server.json`. No branch/worktree created or unrelated source/process cleanup performed. Stop for Product acceptance.
