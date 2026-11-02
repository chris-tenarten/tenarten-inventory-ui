# TenBot resource references and read orchestration — November 1, 2026

Status: **implemented locally; Product acceptance pending**. Authority: Chris's GENERALIZE AGENT TOOL ORCHESTRATION request, not deployment approval. Advisory thread unavailable; current explicit Product scope governs. Tier 3 / focused Testing Level 3 because canonical lookup references survive owner-private persistence and permission changes. Dev parent: `6423a9b6a2da14d538c0624c10cf06b8d29a458e`.

## Confirmed cause and provider attribution

The actual shared implementation retained canonical IDs only from `data.job` detail results. A complete `find_jobs` response naming one Job retained **no IDs**. The next request inherited the previous collection/list operation before resolving the requested record operation. It consequently issued `find_jobs({query:"that Job", statuses:["on_deck"]})` for a schedule question. Another presentation path could publish an intermediate lookup instead of the subsequent planning result. Auxiliary reads could also replace the requested operation in the retained context.

The wrong tool/query reproduces through the real hosted-handler construction with synthetic data. The original employee response/trace is unavailable; its exact model wording is not claimed as observed. The previous local synthetic fixture ignored PostgREST `ilike` OR filters and masked the no-match outcome by returning unrelated rows; that fixture now implements only the bounded search grammar actually emitted by the existing Job executor and rejects unsupported grammar.

The [last verified hosted control receipt](evidence/2026-11-01-tenbot-resource-orchestration/previous-hosted-configuration.json), November1 at6:28p.m. Chicago, had ordinary OpenAI spending **false**. With that configuration, `createHostedTenbot` fails the Terra step before dispatch and invokes the legacy operational handler, which resolves the deterministic tool request before any optional Qwen explanation. Zero matches are then a deterministic retrieval answer; Terra is not reasoning through that request. Local reproduction records zero OpenAI transport calls and separately identifies synthetic Qwen explanation attempts. The issue is established in resource retention, routing and answer selection, not attributed to model weakness. No new hosted employee transcript or model call was accessed in this pass.

## Focused contract correction

- Existing context v1 now retains at most four canonical UUIDs from a complete, untruncated, first-page enumeration with no remaining pages. It never infers identity from a count, incomplete page, later-page singleton or arbitrary first/last match. The Production collection selectors remain available for population refinements.
- Reference cardinality and the requested operation resolve before population routing/name extraction. Singular ambiguous references ask for an exact selection; plural references can use the complete bounded set. Pronouns and relative references are not literal Job-name queries. Exact record reads clear list query/status selectors.
- A clarification retains the requested planning/summary/labor operation and supported reporting period. Selecting the exact Job continues that operation. An actual requested detail read, rather than an auxiliary lookup, anchors the next context.
- Primary orchestration receives only reauthorized IDs, requested operation and selectors as server context. The model still discovers and selects existing tools. Exact-reference calls bind to the resolved IDs; new named investigations use an authorized lookup and exact identity resolution before detail reads. Wrong collection calls cannot replace an exact read or carry stale status filters into it. Missing execution of the requested read cannot publish a generated no-match answer.
- The internal bounded plural plan sequences up to four calls to the **same existing exact-Job tools**. It is not a sixth tool or a new business operation. Failed/incomplete/revoked members or final authorization failure suppress the grouped answer; oversized combined output asks for fewer Jobs. No arbitrary partial group or invented aggregate is published.
- Canonical rendering distinguishes unsaved dates, unavailable reads, unsuccessful tool execution and the privacy-preserving “not found or not authorized” result. It does not disclose whether an inaccessible record exists. Numbers remain deterministic tool results.

Existing five tools, discovery schemas/descriptions, limits, caller JWT/RBAC/RLS and source/history proof contracts remain in place. No generic database gateway, model SQL, business write or framework was added. Private displayed history remains separate from bounded model context; retained selectors contain no planned-date/hour results. Every operational follow-up reauthorizes and refreshes facts. Cross-owner leases/CAS, redaction and history timestamps are unchanged.

**No migration required.** The existing PostgreSQL context/state validators accepted the new contexts using the unchanged v1 fields, enum and four-UUID bound.

## Actual validation

Sanitized receipts and synthetic screenshots: [evidence](evidence/2026-11-01-tenbot-resource-orchestration/).

| Check | Actual result |
| --- | --- |
| New resource/orchestration regressions | 15 groups PASS: list→identity→planning→labor, fresh status-independent identity reads, reopening, singular ambiguity/explicit selection, plural sequencing, incomplete/paged/oversized sets, revocation, missing fields/errors, primary discovery/error recovery, named lookup→planning requested-operation anchoring, whole-group failure/omission suppression and complete-lookup uniqueness |
| Existing context / history / adjacent employee history | 16 / 5 / 14 groups PASS; assertions updated only for intended clarification wording and removal of a redundant primary lookup |
| Real isolated PostgreSQL/JWT/RLS delta | 7 groups PASS, 48 HTTP calls: genuine synthetic Member/Admin JWTs, singleton/multiple references, JSON restoration/current access, exact planning and5-hour labor, unchanged SQL predicates, actor-specific row revocation, current-account revocation under a signed JWT and anonymous denial |
| Isolated cleanup | Two exact synthetic Auth users, two Jobs, one labor entry and marker-owned policies removed; prior fixture not reset; no migration, history or Inventory writes |
| Actual localhost Messaging | 4 groups /6 turns PASS: normal interface, schedule/labor continuation, close/reopen/reload, timestamps and desktop/mobile composer |
| Engineering | TypeScript, targeted ESLint, diff check and final task-only Production build PASS; unrelated dirty latency code excluded |

Provider transports in deterministic tests are **scripted**, not live Terra/Qwen inference. Real database evidence is separate from synthetic local Auth/persistence. Completed prior real owner-history/security evidence is reused; no broad security suite or status matrix was repeated. New inference charges **$0**, no model funding/reservations reset. The initial build exposed a TypeScript narrowing issue in the grouped-plan closure; its immutable capture was corrected before the passing final build. Focused review identified and corrected partial-group publication/context collapse and paginated-name uniqueness gaps. Added adversarial regressions cover both. Final grouped identity type narrowing and the unrelated-guidance temporal boundary were also checked before the passing build. These corrections change no UI; the normal browser path is unchanged and the final localhost source was refreshed.

Synthetic before/after:

> Before: “What are the scheduled dates for that Job?” → `find_jobs`, name query `that Job`, prior On Deck filter.
>
> After: list In Production → one On Deck Job, CTX-2 → `get_job_planning(job_id=CTX-2)` → saved Oct1–Nov15 dates → `get_job_labor_summary(job_id=CTX-2)` →5 recorded hours. Changing its status after the list does not apply the old list filter to the exact authorized read.
>
> Two matching Jobs + “that Job” → targeted selection; “Job CTX-2” continues the pending schedule/labor operation. “Those Jobs” sequences bounded exact reads without inventing a total.

## Local Product review and release boundary

Use **http://localhost:3000/my-work → Messaging → TenBot**. Synthetic login: `customer-review@example.invalid` / `Local-review-only!`. Try “Which Jobs are in Production?”, “What about On Deck?”, “What are the scheduled dates for that Job?” and “How many hours on it?”. Expected7 In Production, one On Deck CTX-2, saved dates and5 recorded hours. The API is synthetic; genuine JWT/RLS evidence is the separate isolated fixture.

The original static process on3000 was preserved. Only the verified task-owned loopback API on55597 was replaced; previous output/process receipts are retained in `/private/tmp/tenops-tenbot-resource-orchestration-20261101`. Root dev's pre-existing dirty files, prior release receipts and uncommitted latency work remain intact. No branch/worktree, push, deployment, shared migration, hosted secret/configuration change, permission activation or operational write occurred.

Last verified hosted TenDev remains75ed1f35, TenOps Pages01c0b457; this candidate is **not deployed**. All operational agent write paths and existing spending controls remain unchanged. Existing contexts that never retained a canonical ID cannot manufacture one; ambiguous/incomplete sets require a fresh authorized selection. New complete small list results persist their canonical references. Live Terra behavior and genuine hosted employee smoke are not newly verified; spending remains disabled and was not enabled for this task. After Product acceptance, a separate selective source-proof/build and authorized matched TenDev rollout are required. Stop for Product acceptance.
