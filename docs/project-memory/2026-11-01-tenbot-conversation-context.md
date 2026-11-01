# TenBot conversational context — November 1, 2026

**Status: implemented locally, pending Product acceptance; not released.** Chris's current **TENBOT — CONVERSATIONAL CONTEXT PERSISTENCE** request authorizes this focused dev implementation, validation and local commit. Separate Advisory context was unavailable. Production baseline is accepted/deployed `b37279c4c39f37792aac3966cde3825b71c67351`; local dev base is `05bd3d4ccd1df1ecab1b17518c9fa1ad8c0cff3c`. Dev contains other unreleased work and must not be promoted wholesale.

## Confirmed cause and correction

The hosted assistant restored only verified static guidance/display turns and reset its Job seeds on every request. Excluding live answers was intentional, but it also removed the subject and query scope needed by the next message. A Production overview has no single Job ID to recover. Qwen fallback used separate legacy context and marked even verified static guidance as volatile, so useful completed help also disappeared on reopening.

The existing owner-bound history state now accepts one strict, optional context object: module subject, last operation/result type, at most four canonical Job UUIDs, bounded search/filter/date selectors (including a caller-supplied Job search term when needed), current knowledge proofs, clarification state and timestamps. No counts, hours, result rows, returned record labels, operational assistant prose, native model continuation or attachments enter this object. Static walkthrough steps continue through the existing three proof-bearing guidance turns rather than a second memory system.

Context expires after **30 minutes** inside the existing one-hour conversation lifetime. Hydration does not renew either lifetime and invokes no model. Clear, expiry, changed source proofs or revoked reference access remove the context. Each referenced Job is checked through the actual caller-authorized summary tool before its selector reaches either provider; subsequent operational answers use fresh tools and existing publication freshness checks. Client-supplied context cannot replace the server-owned object.

Terra receives the selectors as explicitly non-authoritative context. The existing Qwen fallback receives the same checked history/selectors while holding the same conversation lease; the canonical legacy append advances the known revision once, then the existing CAS commits the context. Verified static Qwen help retains transitive knowledge proofs; operational fallback prose remains volatile. Partial source validation fails closed: if any returned source is revoked or mismatched, no source-derived answer is published. No provider configuration, pricing, tool capability, RLS, role or write authority changes.

Generic referential follow-ups reuse the last query scope or canonical reference. Collection filtering composes the existing authorized `find_jobs` tool, bounded to three pages of twenty and twenty displayed matches; partial results are explicitly marked. Ambiguous multi-Job references ask for a selection. The router retains financial/private-data restrictions and recognizes the existing hold status. It does not invent Bid relationships or add Inventory read tools.

## Examples and limits

Before: a fresh request had no retained Production scope, so “Which ones?” could become an unrelated clarification. After, the synthetic ten-Job fixture returns **8 active Jobs**, then freshly lists **CTX-1 through CTX-8**, excluding the two completed Jobs. This still works after a different server handler restores the conversation and after the actual Messaging UI reloads.

A named Context Alpha discussion followed by “How many hours on that job?” uses its reauthorized canonical UUID and returns a fresh **5 recorded hours**, with the reporting period and existing completeness caveats. An explicit reporting period survives related status/planning turns.

Intake “What's next?” and Inventory “What about the incoming?” retain verified workflow subject/dialogue; tests verify context delivery and source checks, not live model prose quality. The five existing Job tools expose neither a Job-to-original-Bid relationship nor live incoming Inventory quantities. Those requests still need verified guidance or an honest capability limitation; this change supplies no missing business capability. “Other two” remains a clarification when the previous subset is not recoverable without retaining a live result list. Expired contexts require an explicit subject again.

## Focused validation

Tier 3 / focused Testing Level 3 because the change extends persisted state and touches authorization-sensitive context. [Functional receipt](evidence/2026-11-01-tenbot-conversation-context/functional.json), [validation manifest](evidence/2026-11-01-tenbot-conversation-context/validation.json), [database receipt](evidence/2026-11-01-tenbot-conversation-context/database-validation.json), [browser receipt](evidence/2026-11-01-tenbot-conversation-context/browser.json), and [source hashes](evidence/2026-11-01-tenbot-conversation-context/source-manifest.json) distinguish the evidence:

- `verify-tenbot-conversation-context.mts`: **11 groups PASS** across requested A–H cases, fresh real Job-tool implementations on synthetic transports, financial denial, revoked-source publication race, and Terra-runtime context delivery. Model responses are scripted transports, not real inference.
- Adjacent hosted-history **13**, hosted/fallback **10**, and existing operational routing **20** groups PASS. These exercise real server code with synthetic persistence/provider transports; they are not new hosted JWT/RLS certification.
- **14 real PostgreSQL checks PASS** on existing isolated fixture `ahnqbzuhpwgmispwohwv`: exact new migration/strict JSON validator, legacy state acceptance, invalid payload/expiry/identity rejection and helper ACLs. This fixture lacked assistant-history functions, so only the exact original pure validators were temporarily bootstrapped. Everything ran in one rolled-back transaction; helper removal and predecessor restoration were verified. No durable schema/record changes. This does **not** certify a new signed-JWT/full durable-history lifecycle. Existing ownership/lease/CAS/RLS evidence is reused because those functions and policies are unchanged.
- Actual localhost Messaging desktop/mobile **4 checks PASS**: count → list, reload/follow-up with no repeat inference, no operational answers/labels in browser storage, usable mobile composer. External requests blocked; synthetic Auth/data/model only. [Desktop](evidence/2026-11-01-tenbot-conversation-context/desktop.png), [mobile](evidence/2026-11-01-tenbot-conversation-context/mobile.png).
- TypeScript, targeted ESLint (including normally ignored Edge sources), diff check and isolated task-only Production build PASS. Build reused the pinned knowledge artifact without regeneration. This is not a selective release-proof claim.

**No real Terra/Qwen inference or new funding.** Ordinary spending remains disabled/expired; actual inference cost is $0. No hosted application/configuration, shared migration, operational record, permission, enrollment or agent-write gate changed.

## Migration and next release gates

Required new migration: `20261031230000_tenbot_conversation_context.sql`, SHA-256 **`a75ecd0eef035cc4a71cf944724c00588216aabae3fa9d98b161d7ea7b66bb52`**. It adds a private pure context validator and replaces the existing state validator with a backward-compatible optional field. No table, ownership policy, claim/load/commit/release/clear contract, role capability or business function changes. It remains **UNAPPLIED to shared TenOps/Production**; applied historical migrations are untouched.

Before release: Product acceptance; exact selective source/knowledge-impact proof; shared predecessor compatibility; authorized migration application; focused hosted signed-in context restoration/revocation and Edge checks. Genuine Terra follow-up quality requires existing funded access or separate explicit funding; no quota reset is implied. Preserve Qwen fallback and all agent writes OFF. No push or deployment is authorized by this implementation receipt.

## Local Product review and workspace

Open **http://localhost:3000/my-work**, Messaging → TenBot. The actual app is backed only by a local synthetic API on port **55597**. Disposable account: `customer-review@example.invalid` / `Local-review-only!`. This is an **offline synthetic review**, with no real model inference or hosted data access. Try the two examples above, reload, reopen TenBot, and continue. Normal live answers are hidden on restoration with a prompt to ask a fresh follow-up; verified static help is restored without inference.

The existing port-3000 static server was preserved; the previous compiled export is backed up in task scratch. Task scratch/build/receipts live in `/private/tmp/tenops-tenbot-context-20261031`; the review API is tracked there in `review-server.json`. No branch or worktree created. Pre-existing latency edits (`tenbot-agent.ts`, `verify-tenbot-agent.mts`), dirty documentation and historical evidence are excluded from this commit; documentation handoffs stage only this task's append.
