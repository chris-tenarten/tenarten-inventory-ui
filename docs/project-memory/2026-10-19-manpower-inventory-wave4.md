# Manpower and Inventory retrieval Wave 4 — local advisory candidate

Base: `da21615ad6f06727e4f18a75c65331a7266d2404`. Branch: `perf/manpower-inventory-wave4`. Persistent worktree: `.worktrees/manpower-inventory-wave4`. Resolve the local commit with `git rev-parse perf/manpower-inventory-wave4`. Tier 3 / focused Testing Level 3: reporting completeness, historical editing, and receiving/audit lineage. Local implementation, tests and commit only. No hosted connections or writes, migrations, schema/RLS changes, dependencies, push, merge, release preparation or deployment.

## Confirmed bottlenecks and changes

Manpower's October 14 selected-period optimization is already canonical and remains intact. It queries a complete inclusive date/Job scope with two historical boundary rows, then previously started the entire editable history automatically. That second read/hydration/grouping is unnecessary for ordinary report viewing. A new **Load reporting history** action now requests complete editable history only when needed. Search and New Group become available after that complete read; no period subset is presented as historical search/edit data. The selected report remains usable while history loads or fails. Explicit history retry does not invalidate a successful selected-period report. Once requested, history remains loaded in the mounted workspace; subsequent report periods use the authoritative complete entries and edits as before. Refresh reloads requested history after selected-period readiness. Navigation to a fresh workspace deliberately starts with selected-period data again.

Period/Job changes cancel obsolete report reads; existing active-result/scope guards remain. Full-history reads cancel on refresh or unmount, retain the existing generation check, and fail without automatic retry loops. Historical references and Job/Rework choices retain complete readers. Shared auth is unchanged.

Inventory startup previously read current stock and all pending/partially-received/received receivals. It now reads complete current stock plus complete outstanding receivals. **Load received items** inside expanded Pending Receivals requests the complete original three-status scope, preserving original projections, order, receipt IDs, reservation fields and undo lineage. It does not fetch each receipt separately. Once loaded, collapsing/reopening does not requery; mutation refreshes retain the expanded data scope. A ref reads the latest scope even from an older in-flight mutation callback. History errors have an explicit retry. Clear Received Items is available only after a successful complete history read. Existing current-stock grouping, quantities, reservation logic, receive/undo RPCs and purchasing relationships are unchanged.

Inventory stock/receival readers abort superseded reads and unmount work. Inventory and Activity operational state are keyed to verified account identity, following the existing Manpower pattern. Continuing-session revalidation preserves state; account changes cannot reuse the previous account's rows or search. No global response cache or auth refactor.

Inventory Activity is the explicit receipt/usage/adjustment audit workspace. Its prior `.limit(500)` omitted older transactions. It now uses the existing exact-count complete reader with stable `created_at desc, id` ordering. This increases requested-history transfer to preserve audit completeness; Activity is not fetched during Inventory startup. In-page filters/search still operate on the complete loaded set.

A focused historical-edit check exposed a baseline compatibility defect: ordinary labor linked to an archived Job had no save target (historical Rework targets were already preserved). The record was visible but a notes edit failed before making a write. `buildManpowerWorkTargetOptions` now adds existing historical ordinary Job identities as **nonselectable** targets. Existing rows can retain/save their identity; new-entry and bulk target controls continue filtering nonselectable choices. No archived Job is reactivated or made a new-entry choice. Historical Rework identity remains preserved.

## Measured evidence

[Browser baseline](evidence/2026-10-19-wave4-browser-before.json), [candidate browser](evidence/2026-10-19-wave4-browser-after.json), [data contracts and per-query evidence](evidence/2026-10-19-wave4-retrieval.json).

| Synthetic observation | Baseline | Candidate |
|---|---:|---:|
| Ordinary Manpower fact reads before optional editing | 30 requests / 13,204 rows / 9,475,691 JSON bytes | 5 / 1,203 / 845,147 |
| Selected Manpower report ready, one browser observation | 307 ms | 320 ms |
| Inventory startup (stock plus receivals) | 6 requests / 2,407 rows / 1,495,838 JSON bytes | 4 / 1,206 / 549,236 |
| Stock plus outstanding receivals ready, one browser observation | 699 ms | 278 ms |
| Explicit Activity history | 1 request / 500 rows / 253,891 JSON bytes | 3 / 1,401 / 712,001 |

The baseline browser uses the preserved Wave 1 export at port 3000; its Manpower/Inventory/Activity source matches canonical baseline. Unrelated global awareness differs. Candidate origin is exactly `http://localhost:3344`. Both use the same intercepted synthetic records and selected-column projection, provider cap 500 and fixed October 19 browser date. Request/row/byte measurements cover the named data paths, excluding shared auth, preferences, dictionaries and static assets. JSON bytes are uncompressed serialized fixture bodies, not actual compressed network bytes or SQL costs. Readiness timings are single observations including hydration/rendering, without percentile or Production claims. Manpower report readiness is essentially unchanged: the improvement is avoiding subsequent history transfer and client hydration/grouping during ordinary viewing, not accelerating the already optimized report.

Dataset: 12,001 labor entries (1,201 selected-period entries, older/archived work), 1,201 stock lots totaling **13,210 Bags**, five outstanding receivals and 1,201 received rows, 1,401 audit transactions. The 1,203 report rows include two boundary responses with existing deduplication. Boundary/history and integer-hundredths aggregation semantics are unchanged.

On demand, complete Manpower history still costs 25 requests / 12,001 rows / 8,630,544 bytes. A session that requests it has the same overall fact-read cost as baseline. Inventory history reloads the complete three-status view in three requests / 1,206 rows / 950,263 bytes. This rereads the five outstanding rows for a consistent complete view; a session opening history transfers 3,661 bytes more than baseline, rather than claiming a total-session saving. Stock remains three requests / 1,201 rows / 545,575 bytes. Collapsing/reopening the loaded receival panel made zero additional requests. No direct browser CPU profile was captured; avoided ordinary-view history hydration/grouping follows from zero history reads and unchanged lazy history publication, not a measured CPU percentage.

## Correctness and reliability validation

[Validation receipt](evidence/2026-10-19-wave4-validation.json). Thirteen candidate browser groups and three baseline measurement groups passed.

- `scripts/verify-wave4-retrieval.mts`: selected/full-history aggregates deeply equal for 30/90/year across all Jobs, selected Job and empty Job. All authorized older/archived records remain available. Historical ordinary and Rework identities are saveable without new selectable archived targets.
- All changed complete readers passed provider cap **137**, beyond 1,000 records: 12,001 labor, 1,201 stock, 1,206 receivals and 1,401 transactions. Both UUID and numeric stock IDs work. Exact stock quantities and reservation IDs/temporary labels match fixture originals. Outstanding rows deeply equal the outstanding subset of the complete received-history view. Stable ID tie-breaking and actual-returned offsets remain in use.
- Empty/canceled reads, denial, changed counts, duplicate IDs and missing pages reject/resolve safely without publishing partial totals. Exact-count pagination detects some membership changes; it is not a transactional snapshot and cannot detect every same-count concurrent edit.
- Actual components: initial selected report, explicit complete historical editor, all 1,201 received rows, oldest Activity transaction and outtakes, rapid period/Job changes with delayed responses, denied history/period/stock/receivals, explicit retries, empty states, refresh races with typed Inventory search, navigation away/back during history, account switch and access denial all passed. A failed historical read leaves the selected report usable and does not retry in a loop.
- The actual editor saved notes on a **2024 archived-Job entry**, leaving the current period total unchanged. In-memory receive scenarios added five Bags (partial) and twenty Bags (full) with canonical reservation/notes preserved, refreshed stock and receivals, exposed the full receipt through requested history, and undid each receipt back to the original quantity. Reversed audit entries remain. The existing reservation static verifier also passed. These exercise UI/data refresh and lineage against a small disposable RPC model, not hosted transaction locking or RLS integrity; production mutation implementations are unchanged.
- Continuing token revalidation preserved current Inventory/search without extra stock reads; account change reset state and loaded empty authorized data; denial closed access. Simulated focus and continuing SIGNED_IN preserved an unsaved historical note with zero extra history reads. Physical hidden/visible tab recovery was not certified; accepted October 19 shared-auth evidence is reused, and physical refocus is a Product review check.
- Final application-source Production webpack build and TypeScript passed. Final standalone TypeScript, targeted ESLint and diff checks passed. No new dependencies. The local build has synthetic API configuration and must not be deployed.

Initial verifier locators were narrowed to desktop tables because nested main elements and hidden responsive duplicates caused strict-locator failures. Previously passed groups were reused. The archived ordinary-Job edit exposed the real baseline defect described above; its correction received focused deterministic/browser verification and a final corrected-source build. No unrelated historical suite was run.

## Boundaries, remaining concerns and future database work

No database change is required for this candidate. Existing grants, RLS, receipt/undo functions and canonical records are untouched; hosted compatibility, current hosted security posture, database plans and authenticated Production latency were not verified. Do not infer hosted state from repository migrations. No shared authentication defect was found or investigated beyond this scope.

Full requested Manpower history, reference/group dictionaries, complete stock and explicit Activity history still grow without bound. Expanded large history still incurs existing hydration/grouping/rendering costs. A future server-side search/keyset history design, aggregate endpoint, or targeted index should have a separately approved completeness/editing contract and authorized-role plans. Candidate query-plan targets are Manpower date/Job/order and boundary reads, receival status/order/count, and Activity created-date/ID ordering; no index is prescribed blindly and no migration file was created.

Inventory suggestions initially use current stock and outstanding receipts. Historical-only suggestions return when received history is loaded; they remain manually authorable. This is part of the deferred-history interaction for Product review. Canceled/cleared receivals retain baseline exclusion from this queue; Activity remains the transaction audit trail. Receiving history is not a new reconciliation source for current quantities.

Material Usage report summaries and purchasing/catalog retrieval implementations are unchanged. The audit's separate list-completeness corrections belong to preserved Wave 2; they are not cherry-picked here. No Production lifetime labor cutoff, quantity formula, material-readiness calculation, reservation policy, issued document, Sample lifecycle, branding or iTenify change. No private My Work content was read.

## Focused Product review

Existing review servers are preserved: port 3000 (Wave 1), 3322 (Wave 2), 3333 (Wave 3). Wave 4 uses the necessary port exception **http://localhost:3344** with the actual exported app, a synthetic authenticated session and a strictly local in-memory adapter. Chrome is open with Manpower and Inventory tabs. No credentials or hosted requests are needed. The adapter rejects unsupported writes and never forwards upstream. Only local historical entry updates and modeled receive/undo are supported write scenarios; other business workflows are outside this fixture's validation claim.

1. Open `/manpower-reporting`: selected report reads **4,503.75 h** with no automatic full-history fetch. Switch period and Job; then choose **Load reporting history**. Search `Historical edit target`, edit Notes and leave the row to save. Verify old dates and archived Job identity remain editable. If the test already renamed this fixture note, restart/reset the disposable fixture or search `Historical edit verified`.
2. Open `/inventory`: review three stock groups totaling **13,210 Bags**, reservations and five outstanding receivals. Expand Pending Receivals and choose **Load received items** to access all 1,201 received rows. Collapse/reopen and use Refresh. Optional disposable test: Receive `Incoming marble 0`, then Undo latest receipt/Undo Receive, confirming quantity and reservation persistence.
3. Open `/activity`: search old intake/outtake records such as `Audit marble 1400`, beyond the former 500-row cutoff. Verify type/search filters and reversal labels. Physically switch browser tabs and return with an unsaved historical edit or Inventory search.

Restart from this worktree if needed (existing `out/` is the verified local-only export):

```sh
node scripts/start-wave4-review.mjs
node scripts/open-wave4-review.mjs
```

Restart resets disposable data. Focused verification commands:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://wave4-fixture.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=local-review-only ./node_modules/.bin/tsx scripts/verify-wave4-retrieval.mts
node scripts/verify-wave4-browser.mjs
node scripts/verify-inventory-reservation-workflow.mjs
```
 `WAVE4_CHECK` optionally selects a named browser group; normal invocation runs the candidate suite. The server's localhost-only `/__review/control` reset is test support, not application UI.

Canonical main/dev remain `da21615`; Wave 1 `71f6915`, Wave 2 `8f26471`, and Product-reviewed Wave 3 `d310e4f` remain unchanged. Root audit/release records and unrelated dirty work are preserved. **STOP for Product/Architecture advisory review.** No release actions authorized or performed.
