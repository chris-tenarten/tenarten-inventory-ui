# Waves 1–4 integration — local Product/Architecture review

Canonical baseline: `da21615ad6f06727e4f18a75c65331a7266d2404`. Persistent worktree `.worktrees/performance-integration`; branch **`perf/waves1-4-integration`**. Resolve the final handoff commit with `git rev-parse perf/waves1-4-integration`. Local integration and verification only. No push, canonical merge, deployment, migration, hosted business-data write or release preparation.

## Outcome and exact boundary

All four exact candidates were cherry-picked in logical order, without conflicts:

| Wave | Preserved original commit | Integration commit |
|---|---|---|
| Messaging/Notifications | `71f6915bd66eeb079b4adcae1f234cc37174dca6` | `e7bcd95` |
| Lists/Production | `8f264712813cf7d7deb848e721cae40949c4f8f9` | `0fcf9f0` |
| Samples/Formulation | `d310e4f2d28c0688705d933e896705c113af607e` | `e4c0e92` |
| Manpower/Inventory | `1dc57a3f4c35f1d3f31312191f84df1052dc695c` | `c43f0c7` |

The original branches/worktrees are unchanged. A fresh remote `ls-remote` confirmed main and dev still equal the baseline. No merge or conflict-resolution edits were needed. All **31 changed application paths** exactly match their owning original candidate source; integration adds only local review, inspection, validation and handoff artifacts. Shared October 19 auth/refocus source is byte-identical to baseline. Calculations, PDFs, database migrations and security policies have no additional integration changes. [Source boundary evidence](evidence/2026-10-19-integration-source-boundary.json).

Product status from the current instruction: Waves 3 and 4 accepted, Wave 2 positive provisional review, **Wave 1 UX acceptance remains outstanding**. Integration is not acceptance or release authorization.

## Combined validation

Tier 3 / focused Testing Level 3 for private response ownership, complete historical contracts, and cross-module interactions. One fresh webpack Production export passed, followed by final standalone TypeScript, targeted ESLint of all changed application paths and integration tools, and diff checks. The export uses a synthetic localhost API/key and Production branding; it is not a deployment artifact.

Seven combined actual-component workflow groups passed at the exact localhost origin:

1. Production core visibility and scoped complete attachment/update summaries during delayed Planning, with Messaging opening, token revalidation, unsent draft retention across navigation and local send.
2. All 1,201 Proposals and POs available, historical Proposal opening, local creation and actual `%PDF` preview. Narrow list queries, complete selected details and purchasing loaders remain integrated.
3. New Sample readiness while the now-complete Wave 2 supplier loader is delayed; existing Sample edits survive continuing-session validation and all 1,201 contacts arriving. Working Sample PDF preview passes through the unchanged local renderer.
4. Correct selected Manpower report without automatic complete-history retrieval; Messaging can open while the report remains available. Explicit complete historical loading retains **4,503.75 h** for 30 days and **6,753.75 h** for 90 days.
5. Correct displayed general stock of **13,189 Bags**, separate reserved quantities of 10 and 11 Bags, five outstanding receivals, all 1,201 received rows on demand, oldest Activity record beyond the former 500 cutoff, and Material Usage tail-history search beyond 1,000.
6. Denied Production enrichment leaves Jobs usable; denied Proposal history is distinct from an empty list and disables unsafe contextual creation. No retry loop.
7. Delayed Sample/awareness responses during an account switch cannot publish former-account Samples or conversations. Navigation retains the switched identity, Inventory is empty for that account, and later access denial closes the protected workspace.

The existing Messaging safety browser verifier additionally passed **17 scenarios** on the integrated export: summaries/recipients/unread reuse, send/receive/read reconciliation, subscriptions, notification events/mark-all, thread edits/deletion, reconnect, draft restoration, summary failure/retry, stale old-account history/summary completion and revocation. No client exceptions or external browser requests in either suite. This tests synthetic Phoenix events, not hosted private Realtime or a physical network outage.

Evidence: [combined browser](evidence/2026-10-19-integration-browser.json), [Messaging safety](evidence/2026-10-19-integration-awareness.json), [validation receipt](evidence/2026-10-19-integration-validation.json).

Prior deterministic Wave 1–4 completeness, calculation, quantity/receipt/undo, issuance/snapshot, historical editing, duplicate/count-drift and bounded-cache evidence is reused where source is unchanged. The 31-path comparison supports that reuse. The combined adapter does not implement every historical mutation; it is not a new database emulator. Hosted RLS, receipt atomicity, Storage, physical tab recovery and every business write lifecycle are not newly certified. Simulated continuing auth events retained drafts; manual physical tab refocus remains part of Product review. No shared auth redesign or new application fix was needed during integration.

Corrections were confined to review support: the unified fixture initially omitted exact count/scope handling for the unseen-Job RPC, which correctly caused the complete reader to reject its result; it now uses the existing fixture pager. Browser steps were corrected to navigate out of a new Sample Inspector and to avoid resetting the switched account in test initialization. Passed groups were retained and only unfinished checks resumed. No extra application rebuild was needed.

## Performance evidence and its practical limits

**Actual authenticated baseline/candidate latency improvement remains unverified.** The only existing user access token in the established environment is expired, and no refresh credential accompanies it. No new credential was requested, guessed or minted; no account was impersonated. Privileged credentials were not used as a substitute for user-session measurements. A normal-account sign-in is supported by the existing guard, but the current guard does not cover enough current reads to run all six complete workflows safely.

The existing allowlist excludes `list_samples`, default/number-suggestion RPCs, `manpower_workers`, `manpower_tasks`, `vendor_contacts`, `vendor_catalog_v2`, the current notification-history RPC, unseen-Job RPC and Proposal access RPC. Those calls remain blocked in hosted-read-only mode. The allowlist was **not broadened** and there is no synthetic or unrestricted fallback in that mode. Therefore a full authenticated real-data comparison was not attempted behind a partial guard. An established normal session plus separately reviewed guard compatibility would be needed for that follow-up; it is not authorization to expand this task.

The original guard unit verifier passed. Twenty live forbidden requests against the optional hosted-read-only transport were rejected locally with **zero upstream forwards**: business table mutations, welcome creation, read receipts, sending, unknown RPCs, unknown read-like RPCs, Storage, Edge, Realtime, local mutation routes and signup. Hosted mode retains the original worker/frame CSP restrictions, public-only API configuration, stripped forwarding headers, GET read-only RPC conversion, exact local-origin checks and redirect rejection. No service key is read by the review server. The temporary guard-test process at 3356 was stopped. [Live guard receipt](evidence/2026-10-19-integration-live-guard.json).

### Current hosted observations

Existing authorized privileged HEAD requests retrieved counts only, with **no business record bodies**. Anonymous HEAD requests checked denial, also without row bodies. No private My Work or Inbox content was inspected with privileged access.

| Scoped current count | Observed rows |
|---|---:|
| Nonarchived Jobs | 43 |
| Proposals / POs | 7 / 13 |
| Manpower all / September 20–October 19 inclusive | 2,061 / 216 |
| Inventory lots | 187 |
| Receivals in the original three-status scope / outstanding only | 10 / 0 |
| Inventory transactions | 101 |

These counts corroborate the potential to avoid historical labor facts; current receival history is small. Current Proposal/PO counts are much smaller than the 1,201-row stress fixtures, so their completeness corrections should not be described as measured Production speed improvements. HEAD requests bypass ordinary user RLS when privileged and do not measure JSON record transfer, browser readiness or SQL execution time. Their single network durations are retained only as observations, not a before/after application comparison. [Hosted observations](evidence/2026-10-19-integration-hosted-observations.json).

### Controlled evidence retained from the independent waves

| Domain | Controlled finding, not Production latency |
|---|---|
| Messaging | First-open API requests 5→2; quick reopen 2→0. First-open settlement timing was actually slower in the original fixture (406→1,043 ms), so fewer reads do not prove faster opening. |
| Production | Scoped attachment fixture rows 2,402→1,201; activity publication independent of Planning. Integrated core Jobs appeared at 156 ms under a 1.8 s Planning delay; this is one synthetic observation. |
| Proposals / purchasing | Proposal summary JSON 4,982,391→354,980 bytes while restoring 1,201 parents from a capped 1,000. Complete PO/vendor children can increase requests and bytes; correctness takes precedence. |
| Samples | New-draft synthetic readiness 1,928→421 ms; list request/payload unchanged. Integrated new draft with delayed complete vendors appeared at 306 ms. Existing-Sample history payload remains the same bottleneck. |
| Manpower | Ordinary-view fact requests 30→5, JSON 9,475,691→845,147 bytes. Already optimized report readiness was essentially unchanged (307 vs 320 ms). Full requested editing history still transfers. |
| Inventory | Initial synthetic data requests 6→4 and JSON 1,495,838→549,236 bytes. Requested Activity deliberately grows from 500 to all 1,401 fixture transactions. |

Independent source reports and raw evidence remain under the four dated wave reports. These are different workflow fixtures and observations: do not add their timings or advertise a combined percentage speedup. The integrated source has the same optimizations, but only a real authorized account comparison can establish current user-perceived improvement against hosted data.

## Fresh hosted Manpower/Rework security findings

The fresh catalog-only query ran inside a repeatable-read, **read-only transaction**. It queried relation/column privileges, policy metadata, role flags, exact known function signatures/execution rights and the two ledger versions; no protected business records or function bodies were retrieved.

- All four core Manpower tables and `production_rework_cycles` have RLS enabled.
- Effective anonymous SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER rights are false on all five tables. Effective anonymous SELECT/INSERT/UPDATE/REFERENCES column grants are absent too, including inherited/PUBLIC effects captured by the effective-privilege functions.
- All five scoped installed RPCs deny anonymous EXECUTE: empty-group deletion and Rework creation/status/two schedule endpoints. Authenticated and service execution remain allowed; authenticated/service SELECT remains allowed on all five tables.
- Authenticated SELECT policies remain. Some later restrictive business-write policies still name `anon`; this does **not** grant access, and effective anonymous privileges remain denied.
- Anonymous live HEAD requests returned **401** on all five tables, without fetching row bodies.
- Ledger versions `20260924210000` and `20260924210100` are both present. This corroborates the preserved earlier application receipt under root `output/manpower-security-release-a76f4f8/`, rather than relying on ledger or repository presence alone.

The audit's scoped uncertainty is now resolved in favor of **effective anonymous closure at the checked direct-table and five known RPC boundaries**. No corrective database change is indicated by these checks. This is not an exhaustive new audit of all possible wrappers, every policy's business semantics, authenticated write behavior, or unrelated endpoints. Existing authenticated write-equivalence evidence is retained; no hosted mutation probe was run.

[Fresh catalog evidence](evidence/2026-10-19-integration-security-catalog.json); repeatable SQL is `scripts/support/integration-security-readonly.sql` (inspection only, not a migration).

## Samples database recommendation

`list_samples` builds current Sample JSON plus blend rows, every working-version snapshot and every issued snapshot for every Sample. Working-version snapshots are mostly discarded after transfer. Issued snapshots currently supply historical display identity, production source keys and readiness. Merely projecting a smaller field out of the existing RPC would still perform the historical JSON work and is not the proposed solution.

A minimal separately authorized increment should add a complete, deterministically ordered **summary RPC** and a **selected-Sample detail RPC**, retaining the old contract for existing consumers during migration. Summary fields must preserve all immediate library previews/labels, Bid/unlinked filtering, sorting, version/issue counts, author and optional canonical Job context. Selected detail can initially return the existing complete selected-Sample record, preserving client snapshot/readiness helpers and complete historical access; metadata-only history can be a later measured refinement. Do not duplicate formulation/calculation logic in a new SQL summary or replace issued snapshots with current state.

Frontend implications: distinct summary/detail types, contextual detail loading on selection/direct link, stale-result/abort guards and retries, summary invalidation after existing saves/issue/restore, and unsaved-draft protection. Completeness must be verified above row caps for parents and historical metadata, with stable order, no first-N truncation and unchanged historical PDF access.

Any migration must be new, narrow, forward-only and separately reviewed. Preserve capability-equivalent authorization, no anonymous grant, explicit safe search path for definer functions, canonical Job/Bid semantics and existing historical immutability. Verify actual hosted grants/RLS and function behavior before application. No migration or RPC replacement was drafted or applied here.

**Recommendation:** do not make this unmeasured database optimization a prerequisite for the bounded frontend batch if Product accepts residual existing-Sample loading. It does block any claim that Sample library history transfer has been optimized. Keep it a separately authorized follow-up, prioritized by real account payload/readiness measurements. It is not permission to release this candidate.

## Cleanup assessment — no removals

No additional demonstrably obsolete application code was established by the integration diff. Shared complete/scoped readers, notification coalescing, PDF caches and wave fixture/verifier dependencies are active and must remain. Large coordinators are not inherently dead code.

High-confidence generated/disposable material includes `.next/`, the synthetic `out/` export, linked `node_modules`, TypeScript build information and generated `output/integration/proposal-renderer.mts`. They are rebuildable, but the active local review depends on its current export. Do not remove them during review. Temporary logs/test captures can later receive a retention pass after separating credentials/security captures from synthetic artifacts.

Git lists older prunable registrations for missing historical worktrees. Those are inventory/ownership candidates, not deletion authorization: preserve their branch-reachable commits, research and recovery evidence before any future prune. Preserve original wave worktrees, root untracked audit handoff, both October 19 release receipts/evidence, security release artifacts and historical decision records. No root ignore-policy change or broad cleanup was performed. The previously completed Sample Matcher source investigation was not repeated.

## One Product review environment and disposition

**http://localhost:3355/** is the integrated actual application with one realistic synthetic data source. Existing review servers on 3000, 3322, 3333 and 3344 remain untouched; this is the necessary port exception. Chrome is open in an isolated review context. All six domains are accessible in the same app through normal navigation:

- Production `/`: active Jobs, activity badges, Inspector, and rapid navigation.
- Proposals `/proposals` and purchasing `/purchasing`: tail records, contextual details, local Proposal creation and PDF preview.
- Samples `/samples`: **Integrated Sample**, new-draft initialization, captured formulation, complete supplier choices, unsaved input during continued auth validation and working PDF preview.
- **Messaging / Notifications in the header:** Wave Bob/Carol, unread state, reopen/switch/draft/send behavior and notification mark-read. This is the outstanding Wave 1 UX review.
- Manpower `/manpower-reporting`: selected report first, then **Load reporting history**.
- Inventory `/inventory`: current quantity/reservations, outstanding queue, **Load received items**; `/activity` for full receipt/usage audit history.

Default mode has no hosted forwarding. Supported synthetic writes exist only in adapter memory; unsupported operations fail closed. Real attachment throughput, arbitrary mutation workflows and hosted Realtime are outside this adapter's claim. Restart resets synthetic state.

```sh
# From .worktrees/performance-integration; existing out/ is the verified local export.
./node_modules/.bin/tsx scripts/start-performance-integration-review.mts
node scripts/open-performance-integration-review.mjs
# Focused combined and Messaging checks (same local server):
node scripts/verify-performance-integration-browser.mjs
AWARENESS_ORIGIN=http://localhost:3355 AWARENESS_SAFETY=1 AWARENESS_OUTPUT=output/integration-awareness.json node scripts/verify-awareness-browser.mjs
```

Optional `--hosted-read-only` uses the original allowlist with no fallback, no synthetic session injection, and only existing public configuration. It requires stopping only this confirmed integration server and using a fresh isolated browser/normal sign-in; unsupported current reads will remain blocked. It was boundary-tested, not used for authenticated performance claims. Do not point the build directly at the shared TenDev/Production backend to bypass it.

The integrated local candidate is ready for focused Product review. **Release readiness is not established:** Wave 1 UX acceptance is pending, actual authenticated Production performance has not been compared, and physical tab-refocus review remains explicit. Samples history remains a known separately scoped performance limitation. No new application incompatibility was found in the exercised combined paths. Stop for Product/Architecture advisory review; no release actions follow from this report.
