# TenBot generalized operational reads — November 1, 2026

Status: **implemented locally; Product acceptance and release approval pending**. Authority is Chris's current GENERALIZE OPERATIONAL READ CAPABILITIES request. The canonical Advisory thread was unavailable; no additional Product decisions were inferred. Tier 3 / focused Testing Level 3 applies to result-population, history-proof and authorization contracts.

## Demonstrated cause and correction

On Deck is a canonical Job lifecycle status, but the existing enumeration contract did not expose a status selector. The legacy router explicitly refused status-filtered lists. The recent follow-up workaround filtered at most three already-paged, unfiltered pages, so later matching Jobs could disappear. Model discovery could therefore correctly see a count tool without discovering an equivalent filtered list operation. This was a tool/routing contract gap, not evidence of a weaker model.

The same two native population selectors now drive both `find_jobs` and `get_production_overview`: canonical `statuses` (a union, empty/omitted means all) and `include_archived` (false excludes, true includes archives). Status is the current **effective** lifecycle, including an active Rework cycle. Filtering occurs before pagination. Both tools retain the same caller-scoped candidate population and final authorization check. The other three tools remain exact-identity reads.

| Registered tool | Contract |
| --- | --- |
| `find_jobs` | Name/number/customer search or status enumeration; at most 20 rows per page, bounded cursor, explicit next-page/incomplete state |
| `get_production_overview` | Counts over the same status/archive population; dates affect upcoming saved finishes, not historical status transitions |
| `get_job_summary` | One authorized canonical Job and its existing summary facts |
| `get_job_planning` | One authorized Job's saved planning setup; no forecast or new planning authority |
| `get_job_labor_summary` | Existing deterministic recorded-hours calculation for one authorized Job and reporting period |

The registered schemas and discovery descriptions describe these actual capabilities. Existing bounded orchestration still selects tools and pages. A compiled employee population constrains model-generated status/archive/name arguments while preserving valid page/limit choices. The legacy path uses those same native selectors instead of its three-page post-filter. Follow-ups refine selectors and preserve Production versus My Work context; no On Deck question handler was added.

Employee-facing count/list output comes from deterministic authorized results. Unavailable or incomplete retrieval cannot become a generated zero. Page and display truncation remain explicit. Historical answers remain separate from current tool facts.

## Compatibility and privacy

- Still exactly five allowlisted Job tools. No SQL capability, new permission, unrestricted database client or operational write was added.
- Capability checks, caller JWT/RLS, archive exclusions, fixture exclusions, bounded scans and final record reauthorization remain outside the model. Revocation during a request suppresses the result.
- Omitted status arguments preserve legacy result filters and receipt digests.
- An exact metadata-only bridge preserves the prior history-scope digest for the two additive description changes. Other tool identities, kinds, unknown descriptions and hard boundaries still invalidate it. Current source and record authorization still control history visibility; revoked questions and answers redact.
- The legacy TypeScript/PostgreSQL receipt allowlists now accept bounded canonical status arrays. No owner, ACL, RLS or business permission changes.

New append-only migration: `supabase/migrations/20261101210000_job_read_status_receipts.sql`.

SHA256: `d07a8588ccf3b4a847a4b378274f77f26d4cc7b5594c238addf1011df4880177`.

It replaces only the existing immutable receipt-validation function. Its body was tested in an isolated PostgreSQL transaction and **rolled back**; original definition/owner/ACL/signature restored, migration ledger unchanged. It has not been applied persistently to either the fixture or shared TenOps.

## Focused evidence

Sanitized receipts: [evidence directory](evidence/2026-11-01-tenbot-job-read-contract/). Scripted model transports test orchestration deterministically; they are not live Terra results.

| Check | Actual result |
| --- | --- |
| Core contracts | 9 groups PASS: native status/archive populations, late matches beyond row 60, effective Rework, canonical unions, invalid selectors/cursors, incomplete results, revocation, discovery and compiled scope |
| Conversation/context | 16 groups PASS: count/list and status refinement, archives, ambiguity, other-module/My Work separation, restored context, capability/record revocation |
| History compatibility | 5 groups PASS: exact old digest, selective current-access redaction, new receipt arguments, primary-model wrong arguments/prose corrected, failed count cannot publish zero |
| Adjacent employee history | 14 groups PASS using the existing verifier; strict-schema fixture updated only |
| Real isolated PostgreSQL/JWT/RLS | 10 groups PASS with genuine synthetic Member/Admin JWTs, 13 synthetic Jobs and 5 Reworks; four status classes, archive scopes, paging, ambiguity, anonymous denial, row/account revocation and mid-request revocation |
| PostgreSQL migration validator | 21 cases PASS in rollback-only transaction; owner/ACL/signature and original function unchanged afterward |
| Actual localhost Messaging | 5 groups PASS / 12 actual local question-response turns, desktop/mobile, status-only refinement, archive include/exclude, reload/reopening and timestamped history |
| Engineering checks | TypeScript, targeted ESLint, diff check and task-only Production build PASS; independent focused contract/security review complete |

All exact task-owned fixture Auth users, Jobs, Reworks and policy markers were removed. Prior fixture data/history were not reset. Real database evidence is distinct from the local review's simulated persistence. Zero inference calls, zero Production requests and zero Inventory writes during this work. The preliminary browser check raced asynchronous sidebar loading; its selector was corrected without an application change. Initial build attempts exposed test-fixture type annotations, corrected before the successful build.

Example local synthetic conversation:

> How many Jobs are In Production? → 3 Jobs, including one active Rework.
>
> Which Jobs are On Deck? → CTX-3, CTX-4 and CTX-7 (Rework).
>
> Which Jobs are On Deck including archived? → the same three plus archived CTX-9.
>
> Which ones excluding archived? / reopen → the original three, freshly read.

## Local Product review and remaining gates

Use **http://localhost:3000/my-work → Messaging → TenBot**. Synthetic review login: `customer-review@example.invalid` / `Local-review-only!`. Expected current counts: In Production 3, On Deck 3, On Hold 1, Shipped 1; On Deck including archives 4. The existing port-3000 static process was preserved; only the confirmed obsolete synthetic API on 55597 was replaced. Original local exports and process receipts were retained under `/private/tmp/tenops-tenbot-job-read-20261101`. The UI uses actual corrected handlers with synthetic Auth/records, no real model; it does not certify hosted authentication or database durability.

Limitations remain explicit: a 1,000-Job/deadline scan bound can prevent exact results; list pages contain at most 20 Jobs; archive-only, historical status-event, material/readiness and unsupported compound populations clarify rather than inventing a filter. Tool reads are current authorized observations, not a transactional database snapshot.

Next: Product acceptance, then a separately authorized selective release with unchanged source-proof gates, shared-schema compatibility review, approved receipt migration application and matched Edge staging. A funded genuine hosted model/discovery check has not been performed or claimed. Existing provider choices, inference policies, owner-private history/Messaging and all operational write gates are unchanged. No push, deployment, shared migration, secret change, temporary grant, enrollment or write activation is authorized by this local candidate.
