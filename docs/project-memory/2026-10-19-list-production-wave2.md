# Wave 2 — List completeness and Production retrieval

**October 19, 2026 · Local candidate only · Stop for Product/Architecture review**

Canonical base: `da21615ad6f06727e4f18a75c65331a7266d2404`. Branch: `perf/list-production-wave2`. Persistent worktree: `/Users/chrisngo/source/repos/tenarten-inventory-ui/.worktrees/list-production-wave2`. Resolve this candidate's local commit with `git rev-parse perf/list-production-wave2`.

Wave 1 remains separate at `71f6915bd66eeb079b4adcae1f234cc37174dca6`, pending acceptance. It was not merged, changed, discarded or released. Main/dev remain at the canonical base. Root audit artifacts and untracked release receipts were preserved. No push, merge, hosted mutation, migration, dependency installation, deployment or release preparation.

## Outcome and scope

This implements the focused audit findings for Proposal/PO/Material Usage completeness, Production attachment/update retrieval, and catalog/reference options. It reuses existing complete readers and preserves the current complete-history client search/filter model. No arbitrary date cutoff, first-N business result or new paginated UX was introduced.

Risk tier **3**, focused **Testing Level 3** for data completeness, historical detail and stale-response/authorization boundaries. No new application-wide state/cache framework. Auth, Messaging, Sample, Manpower, Inventory, branding, SQL, migrations, calculations and document generation implementations are unchanged. Purchasing's existing shared vendor loader is corrected, so its callers (including Samples) receive complete choices without changing their workflow code.

## Findings and implementation

| Path | Confirmed source problem | Final behavior |
|---|---|---|
| Proposal history/Job/Bid reads | Unpaged select-star lists; unrelated detail/snapshot fields transferred for history | Narrow `ProposalSummary`, complete exact-count pages, original ordering with stable ID ties. Full detail remains separate. |
| Linkable Proposals | All Proposals plus an unpaged global relationship set | Standalone-only parent query, complete relationship reads scoped to those Proposal IDs; tail-linked items are excluded correctly. Bid relationship lists also page completely. Read-only relationship correction; no Bid lifecycle change. |
| PO list and line counts | Unpaged list with embedded child IDs; parent and nested caps could disagree | Complete parent summaries and complete scoped line identities. Counts cannot silently become an embedded capped length. Existing status/search/total display remains. |
| PO selected detail | Nested line/allocation/issuance arrays could truncate even after a list was fixed | Complete selected-PO lines/issuances and selected-line allocations, retaining the existing normalization/mapping and one-to-one chip detail. No global detail/history prefetch. |
| Material Usage | Unpaged historical summaries and potentially capped embedded detail lines | Complete narrow summaries; complete lines only for the selected report. Existing search, archived/status/Job filters and snapshots retained. |
| Production attachments | Complete but application-wide attachment IDs fetched for the dashboard | Complete IDs scoped to loaded authorized/role-visible Jobs, including an explicitly focused archived Job. Empty scopes make no request. |
| Production update/unseen summaries | Unpaged global updates; unpaged unseen result; repeated array copies while grouping | Complete narrow update facts and paged/scoped existing unseen RPC results; linear grouping; unchanged count/follow-up/personnel/date semantics. Existing missing-RPC PGRST202 compatibility remains; permission errors do not become empty summaries. |
| Job Update Inspector | Detail list could truncate while its now-complete badge showed more updates | Complete Job-scoped update history, original newest-first ordering with deterministic ID ties. |
| Container-size options | Two explicit 1,000-row limits and swallowed provider errors | Complete paged reference projections, same packaging/classification/preferred-vendor sorting. Failed reads reject; editor shows an unavailable warning and keeps manual entry. |
| Vendors/contacts | Unpaged vendors plus embedded contacts | Complete active/all vendor list and scoped contacts, preserving default-contact selection, address formatting, inactive behavior and ordering. |

`src/lib/scoped-rows.ts` deduplicates IDs and bounds URL scopes to 200, then delegates to `loadCompleteRows` (500 requested rows, actual returned offsets, exact count, duplicate/count-drift/incomplete-page checks). Optional undefined scope retains legacy all-record helper callers; the Production workspace always supplies explicit Job IDs. There is no private global result cache or account-independent reuse.

### Production readiness and reliability

Core Job publication remains early; scheduling/Rework status calculations and original Job ordering are unchanged. Activity summaries now publish independently of Planning. Existing labor/material enrichment remains scoped and unchanged. Summary failure no longer silently becomes `{}`. Overview/Table indicate loading/unavailable rather than asserting zero/no updates, and the Job list/Inspector remain accessible. Core-load failure clears obsolete Job rows and terminates status states. Request cleanup invalidates late responses on scope/account/navigation changes; matching in-flight Job loads still coalesce as before.

PO list/detail, Proposal history/detail, and Material history/detail gained generation guards. A delayed selected record cannot replace a newer selection or New form. Failed lists are distinct from legitimate empty results; denied reads do not loop. Material Job-choice initialization now catches errors and ignores unmounted responses. Proposal history failure disables creation because an existing contextual draft cannot be safely inferred; ordinary preview/editor errors do not permanently disable creation after returning to history.

## Measured before/after

Actual baseline and candidate loaders executed against the same synthetic 1,201-parent fixtures, with a provider cap of 1,000 and 500 requested rows per complete-reader page. Production scope contains two active Jobs; unrelated attachment/update history belongs to an archived Job. The fixture includes 1,201 child lines for a single document, full catalogs, relationships and vendor/contact data. All fetches were intercepted, host-allowlisted, and served from memory. No real network, SQL, RLS, production record content or hosted writes were involved.

| Interaction | Requests before → after | Returned top-level rows before → after | Serialized fixture JSON bytes before → after |
|---|---|---|---|
| Proposal history | 1 → 3 | 1,000 → 1,201 | 4,982,391 → 354,980 |
| Purchase Order summaries | 1 → 12 | 1,000 → 2,402 | 320,636 → 431,868 |
| Material Usage history | 1 → 3 | 1,000 → 1,201 | 317,113 → 381,302 |
| Production attachment summaries | 5 → 3 | 2,402 → 1,201 | 225,793 → 112,897 |
| Production update summaries | 2 → 4 | 1,012 → 1,203 | 168,806 → 254,763 |
| Vendor options | 1 → 10 | 1,000 → 2,402 | 257,223 → 293,236 |
| Container-size options | 2 → 6 | 2,000 → 2,402 | 230,681 → 383,407 |

The Proposal payload reduction includes removal of synthetic repeated notes/formula strings from list responses; those fields still load on detail selection. This demonstrates projection efficiency, not an estimate of actual Production record sizes.

The baseline Proposal/PO/Material lists each returned only 1,000 parents; candidate returns all 1,201. Container sources grow from 2,000 to 2,402 rows to retain all options. PO/vendor candidate row totals include separately fetched child identities/contacts. Embedded baseline rows are counted as parent response rows, not as flattened descendants. The fixture models those embedded arrays but does not independently reproduce every hosted nested-relation cap.

Some request counts and payloads **increase deliberately for completeness**. In particular, PO line counting uses scoped child pages rather than relying on an unverified server aggregate configuration or issuing one HEAD request per PO. Seven 200-ID parent scopes can include empty child scopes; these requests remain bounded but are a real tradeoff. A narrow authorized aggregate RPC could improve this later. Production update bytes also increase because the baseline truncated required updates. Fewer requests or bytes would not be a valid win if it retained missing history.

In the final actual-browser candidate run at `http://localhost:3322`, core Job controls became visible at **226 ms**, complete activity indicators at **311 ms**, while an artificial **2,000 ms Planning delay** was still outstanding. This is one synthetic browser observation, not a production benchmark or before/after latency result. The current base already publishes core Jobs early; this candidate preserves that and stops Planning from delaying activity publication. Production search and PO filtering generated no new affected retrieval calls in the tested interactions.

Evidence: [before](evidence/2026-10-19-wave2-before.json), [after](evidence/2026-10-19-wave2-after.json), [short-page stress](evidence/2026-10-19-wave2-stress.json), [browser](evidence/2026-10-19-wave2-browser.json), [validation receipt](evidence/2026-10-19-wave2-validation.json).

## Validation

- Final webpack Production-mode static export passed, 22 pages. Only local fixture public configuration, enforced local RBAC and TenOps branding were supplied; no `.env.local` was copied. This export is review-only and must not be deployed.
- TypeScript `--noEmit --incremental false`, targeted ESLint and `git diff --check` passed on the implementation. A final Inspector generic return-type correction was checked by the final successful build; no application type errors bypassed. The synthetic review adapter/renderer harness uses an explicitly documented test-only `ts-nocheck`, as existing local adapters do.
- `verify-wave2-retrieval.mts`: complete 1,201-record results; provider cap **137** below requested page size; 0/1/137/500/501/1,000/1,001 boundary matrix; empty and duplicate Job scopes; 205 IDs split into two bounded scopes; tail Proposal exclusion; complete document lines and Job Update history; archived Job scope; explicit failures for parent/child/catalog/update/unseen reads; count drift, duplicate and missing pages reject rather than publishing partial results.
- `verify-wave2-browser.mjs`: ten final checks passed: early core/activity publication during delayed Planning; unavailable indicators on denied summaries; PO tail search/open beyond 1,000; delayed PO detail rejected after New; complete narrow Proposal history, historical open, local creation and **actual unchanged PDF renderer** producing `%PDF`; Proposal/PO failed versus empty histories; Material tail search and delayed-detail rejection after New; Material error versus empty; legitimate empty lists; in-place account switch during a delayed former-account history read. No page errors, external requests or hosted writes.
- Existing Purchasing permanent PDF and Proposal V2 PDF-model gates passed. Existing branding structural gate passed. Issuance, calculation and authentication code were not changed or reimplemented; broad unrelated/database suites were not rerun.
- Focused self-review inspected scope propagation, exact-count ordering, composite relationship identities, empty/failure cases, lifecycle cleanup, preserved mappings, unchanged auth/SQL boundaries and evidence. No additional agent was used.

Early browser fixture corrections targeted hidden responsive duplicates and supplied a complete synthetic Estimate via the existing calculation engine. They did not change application behavior. Builds were repeated only after the two adjacent completeness corrections and their type correction; no unrelated full suite was run.

## Review instructions

**Wave 1 owns port 3000 and remains untouched.** The explicit Wave 2 review exception is **http://localhost:3322**, validated at that exact localhost origin. The running adapter injects a local synthetic session; do not enter real credentials. It never forwards hosted auth/data. Root dirty release/audit files remain outside this candidate.

1. Open `/` on port 3322: two active Jobs, complete 1,201 update/file indicators for Job 0, working Overview/Table/Inspector and normal search. All real-looking data here is synthetic.
2. Open `/purchasing`: all 1,201 POs; search `PO-1200`, filter statuses and open its draft. Vendor/contact choices are synthetic and complete. Existing cancelled/prior-revision editing restrictions are unchanged.
3. Open `/proposals`: all 1,201 entries; open a tail record. Create a local Proposal and Preview PDF. Creation/Estimate initialization are in-memory fixture actions; the PDF renderer is the unchanged application renderer.
4. Open `/material-usage`: search `History 1200`; select historical reports and use New while a controlled read is delayed. Existing archived/status/Job filters retain their meaning.

Restart only after checking port ownership:

```sh
cd /Users/chrisngo/source/repos/tenarten-inventory-ui/.worktrees/list-production-wave2
./node_modules/.bin/tsx scripts/start-wave2-review.mts
```

Run the browser gate with `node scripts/verify-wave2-browser.mjs`. It resets only the local fixture data, so do not run it during another manual Wave 2 fixture session. The adapter supports list/detail reads, synthetic Proposal creation/Estimate initialization and preview, not arbitrary business saves/issuance/deletions. Unsupported writes fail locally. The adapter is not an RLS or hosted-permissions emulator; controlled denial/account-isolation checks are client lifecycle evidence only.

## Remaining opportunities and limitations

- Complete client search/history still transfers all authorized summaries and reference options. A server-paged/search UX or aggregate RPC could reduce total work but needs a separate accepted completeness/search contract or DB authorization. No cutoff was introduced to make counters look better.
- The existing unseen-summary SQL can still scan broader visible history before outer PostgREST scope filtering. Reduced transfer is not proof of reduced SQL execution time. Plans/indexes/functions/RLS remain unverified and unchanged.
- `loadCompleteRows` detects count/membership drift, not a transactional snapshot. Separate header/child/reference/detail reads can observe concurrent edits at different instants; same-count updates may not be detected. Existing optimistic save/issue checks remain in place, but no cross-table snapshot-isolation guarantee is added. Concurrent-editor acceptance remains a prerequisite for any release; an atomic read RPC would require separate authorization if needed.
- Obsolete requests are prevented from publishing; this wave does not add transport cancellation across every paged reader. An already-started request can still consume local/network work after navigation.
- Samples payload/history separation, Manpower on-demand history, Inventory receipt-history UX, Activity's intentional/uncertain recent-window contract, bundle/render restructuring and the SQL conversation-summary work remain later waves. They are unrelated or require Product/DB decisions. Wave 1 is not combined with this candidate.
- Native physical tab-refocus, hosted RLS/Storage/Realtime and Production latency were not re-certified. Authentication source is identical to the accepted base; the accepted October 19 corrections are preserved. No live account/session or business mutation was used.

**Completed local candidate; no release prepared. Stop for Product/Architecture review.**
