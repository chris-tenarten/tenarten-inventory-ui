# Messaging recent-thread latency — local candidate, 2026-09-28

Baseline: `c22d2980597f9129e40e3755f4268701350cc996`. Tier 3 / Testing Level 3 because private in-memory state crosses conversation and account transitions. No deployment, migration, index, RLS, hosted configuration or hosted business-data mutation.

## Measurement and root cause

Actual Inbox component, actual canonical page RPC and disposable local Supabase Auth/PostgREST/Realtime. The message RPC receives a controlled 120 ms transport delay. Measurements are browser observations, not Production latency or statistical percentiles. Two real authenticated contexts are exercised by the existing V1.1 verifier. See the adjacent JSON evidence for matched baseline/candidate counts and timings.

The shell separately prepares recipients before mounting Inbox; its recipient bootstrap and lazy bundle time are outside these timings. The implementation does not claim to improve that cold shell gate. Within Inbox, summary/count reads run in parallel with the initial recent-page request. The page RPC returns 40 messages in chronological display order, with participant names, attachment metadata and optional preview metadata in that same response. There is no client metadata N+1 or signing prerequisite. Rendering does not wait for Realtime.

Previously every switch/reopen discarded the current page, started a fresh history read, and queued another full recent-page read when the private channel joined. On unread initial open, the read-status update also generates authoritative targeted reconciliation through existing broadcast semantics. Mark-read itself already patches local read status; it does not explicitly reload the page. Preserve this distinction.

Warm waterfall before: activate → empty state → page RPC → render → queued post-join page RPC.
Warm waterfall after: activate → render captured recent page → private channel joins → one authoritative recent-page RPC → reconcile. There is a 750 ms fallback to start reconciliation if the channel cannot join; this is not a cache TTL. First-ever opens still fetch immediately and retain the post-join gap check.

Representative matched observations:

| Scenario | Visible before → after | Recent-page reads | Transferred rows | Approx. JSON bytes |
| --- | --- | --- | --- | --- |
| Return to A | 155 → 16 ms | 2 → 1 | 80 → 40 | 36,634 → 18,317 |
| A → B → A return | 156 → 16 ms | 2 → 1 | 80 → 40 | 36,634 → 18,317 |
| Close/remount/reopen A | 157 → 15 ms | 2 → 1 | 80 → 40 | 36,634 → 18,317 |
| Return to short text-only B | 150 → 20 ms | 2 → 1 | 2 → 1 | 844 → 422 |
| Return to A with three PNG attachments | 186 → 31 ms | 2 → 1 | 80 → 40 | 38,782 → 19,390 |

First B remains two page reads (159/147 ms observations are not an optimization claim). Cold unread Inbox remains ten recorded REST responses, including three message-page/ID reads, three summary reads, three unread counts and one mark-read mutation. No claim of cold network/database improvement. Rendering-only CPU time was not isolated; no speculative memoization was added.

The image timing fixture measures attachment metadata, not JPEG-generation/transfer speed. Existing V1.1 checks separately cover viewport-lazy signed JPEG previews, multiple images, offscreen/unloaded previews and original bytes only after explicit user action. No independent metadata reads or original-byte reads were added by caching.

## Implementation contract

- One module-memory cache, owned by Auth identity: five LRU peers, at most forty messages each. No localStorage, IndexedDB, sessionStorage message content, Blob or original-byte cache.
- Module lifetime is necessary: GlobalMessaging's error-boundary key remounts Inbox on close/presentation changes. Local hook-only caching would miss this real workflow.
- Auth changes clear/reassign cache ownership independently of mounted Inbox. Inactive/empty owner and logout hide content; late old-stream responses cannot publish or repopulate another account.
- Only successfully loaded authoritative recent pages enter the cache. Defensive participant matching rejects unrelated rows.
- Reopen revalidates through the unchanged participant-scoped RPC. Inactive peers have no extra subscriptions; changes reconcile on reopen. No prefetch in the initial warm candidate; the measured cold continuation below supersedes that decision.
- Active streams serialize recent, targeted and older reads. Recent refresh preserves overlapping loaded older pages and revalidates their IDs in bounded batches. A nonoverlapping latest page resets to the bounded recent window so a gap is not presented as complete history.
- Read-state patches update the memory entry without dropping attachments. Existing targeted edit/delete/new-message reconciliation updates that entry too.
- No duplicate channels or new per-message/attachment subscriptions. Initial and reconnect subscription-gap checks remain.
- Fixed-height header status distinguishes true first load from background updating. Existing content stays visible; the status does not alter the history scroll height.

## Focused evidence

Commands: `node scripts/verify-messaging-latency.mjs`; `node --import tsx scripts/verify-messaging-recent-cache.mts`; `node scripts/verify-messaging-v11.mjs`; `node scripts/verify-messaging-composer-completion.mjs`; `node --import tsx scripts/verify-messaging-attachments.mts`; TypeScript without incremental output; targeted ESLint; `git diff --check`; Production-branded build.

Cache-specific browser coverage includes cold/open/switch/remount, cached text and three-image attachment arrival, edit/delete while inactive, complete upward history without duplicates, guessed-peer empty response, actual Auth account switch and logout. Cache model checks cover 5-peer eviction, 40-row bound, participant mismatch and late old-owner rejection. Narrow light/dark updating-state screenshots were inspected.

Existing focused V1.1 evidence covers two authenticated contexts, private preview authorization (including unrelated/Admin/inactive/anonymous denial), Realtime/reconnect, pagination and scroll anchoring, lazy preview bytes, explicit original download, small universal/paste/drop attachments and cleanup. Composer regression checks retain immediate reuse after terminal transfers. No 50 MB/200 MB transfer suite was run.

The local fixture needed its canonical message-version table for the new edit test; its history-count assertion was corrected to count only the selected peer. These were harness deficiencies, not source regressions. Sandboxed build/DB access needed the existing escalated execution path; the Production build passed outside that restriction.

## PP-003 follow-up — retained, not guessed

PP-003 is the September 1 Sample/Color Plate foundation (`cd04d35`, migration `20260901_005_sample_color_plate_generator.sql`). No creation manifest/script tying these exact Auth UUIDs to explicitly disposable accounts was found in available repository/history or retained test evidence:

- `125c0548-05e1-42fd-aefd-d127f04fd6e8` — Active A
- `64e7b85f-b8f0-4002-a0d2-8c3836621b01` — Active A
- `c4616f05-1217-4294-b870-8ba3253a3eec` — Active A
- `0f2a36bc-68cf-4b65-ae8c-9932a3886b6f` — Active B
- `10ae5f51-2120-4139-b2aa-a0b47fa8db74` — Active B
- `d7a84411-8b33-4cb0-a1eb-7e626341a3a3` — Active B

They form three paired creation/email-suffix batches on September 1; the reason for repeated creation and the intended cleanup are not proven. All six remain untouched and active. Each has one automatic system welcome message, its Inbox notification and the September 2 feature-announcement notification. Exact UUID scans across public/Storage rows found no other relationships for these six. No deletion was attempted without provenance.

All 21 separately recorded September 25 Messaging release/retry/hotfix accounts are absent from Auth and app_users; registered messages, attachments and Storage prefixes have zero live residue. Required deletion-audit references remain. These findings do not establish original PP-003 cleanup success or failure mechanism.

Live recipient RPC inspection confirms `candidate.is_active` and active caller checks. GlobalMessaging uses that RPC. No inactive-user filtering correction is needed; the six visible users remain active. Existing in-session recipient lists are not a deprovisioning enforcement mechanism; server authorization remains authoritative.

All hosted inspection was read-only, so legitimate accounts and business data were not mutated. Full local read-only evidence: `/private/tmp/tenops-messaging-account-audit.json`. The operations runbook now requires immediate UUID registration, abandoned/retry tracking, dependency checks, independent Auth/directory/recipient verification, and explicit reporting of unexplained pre-existing accounts. Historical evidence was not edited.

## Deferred

Cold shell recipient/bootstrap waterfall, Production/WAN latency and query plans need separate measurement. Do not add speculative indexes. Cold subscription-gap/read-receipt broadcasts are preserved; removing them needs equivalent delivery/read-state guarantees. The cold continuation below adds measured explicit-intent prefetch; automatic recent/unread prefetch remains deferred, no global cache framework, no transfer redesign, no privacy or Admin-read changes.


## Cold-open continuation — cumulative local candidate

Parent candidate: `633bd8856abed1813c3bd8bed75683204b9bf85c`. Tier 3 / Testing Level 3 for private speculative state. This continuation performs no hosted access/mutation, migrations, pushes or deployment. Prior PP-003 audit statements above describe the earlier audit, not this continuation's scope.

### Critical path and retained correctness

The baseline already starts history loading independently of channel setup. Participant authorization, names and all attachment/preview metadata are inside the canonical `list_my_work_message_page_v11` response. Neither typing setup, subscription join, read-state mutation nor a separate metadata request gates first render. Initial scroll positioning follows the committed messages; measured pages finish at the bottom. First render commits the complete bounded recent page together.

In the matched unread baseline, subscription joined at 46 ms, messages committed at 166 ms, and mark-read started at 172 ms. Candidate: 40/163/168 ms. Thus postponing these already-independent operations would not improve the critical path. Post-join recent-page refresh and targeted read-state reconciliation remain unchanged: their snapshots must cover arrivals/updates during initial fetch or disconnection. Send/typing/unread algorithms are unchanged.

Old cold waterfall: click → immediate canonical history request + concurrent private subscription → render history → mark-read if needed; queued post-join gap refresh and targeted reconciliation run in the background.

New intent waterfall: hover/focus for 100 ms → one canonical history request → bounded account-owned cache → click → immediate cached render + subscription → one authoritative gap refresh. Clicking while that same intent request is in flight adopts its promise, then still performs the gap refresh. No-intent clicks retain the old safe waterfall.

### Matched cold measurements

Real disposable local Auth/PostgREST/Realtime, actual Inbox, controlled 120 ms history delay and 400 ms hover dwell. MutationObserver records the first message DOM commit; this is not Production timing or a percentile. Cold tests begin in the already-usable conversation list and exclude shell recipient bootstrap. See `2026-09-28-messaging-cold-open-evidence.json` for requests, rows, bytes, subscription/visibility times and query plan.

| Scenario | Before → after visible / complete recent page | History reads | History rows | Approx. JSON bytes |
| --- | --- | --- | --- | --- |
| Cold text, no intent | 178 → 176 ms | 2 → 2 | 2 → 2 | 852 → 852 |
| Cold image-containing >40 history, no intent | 172 → 171 ms | 2 → 2 | 80 → 80 | 36.6 KB → 36.6 KB |
| Cold unread >40 history | 166 → 163 ms | 3 → 3 | 120 → 120 | 53.8 KB → 53.8 KB |
| First text selection with hover intent | 151 → 19 ms | 2 → 2 | 2 → 2 | 852 → 852 |
| First image-containing history selection with intent | 158 → 28 ms | 2 → 2 | 80 → 80 | 36.6 KB → 36.6 KB |

No-intent differences are noise, not an improvement claim. Intent moves one history read before the click; it does not eliminate that read or shrink total selected-thread payload. Abandoned intent can waste one bounded page. We retain only explicit hover/focus intent, not automatic recent/unread guesses or all-thread preload. Brief hover under 100 ms makes no request. At most one speculative request is in flight; stale intent results are ignored. Owner-generation changes reject late completions, including switch-away-and-back. No durable message cache, new subscriptions, mark-read, preview signing or original-byte loads occur during prefetch. Cache bounds remain five peers × forty messages.

The canonical query body EXPLAIN ANALYZE on the disposable small local fixture took 1.178 ms execution / 1.597 ms planning. This is not a Production-scale query plan and does not justify an index or schema change. No database change is proposed.

### Warm preservation, UX and validation

Original released-baseline comparison above remains preserved: return A 155 → 16 ms, switch-back 156 → 16 ms, reopen 157 → 15 ms, image return 186 → 31 ms; recent reads 2 → 1. Cumulative recheck: return A 11 ms, switch-back 18 ms, reopen 16 ms, image return 33 ms, all one recent read. Full older history, inactive-peer edits/deletes/attachments, guessed-peer rejection, Auth switch and logout checks passed again.

Existing restrained fixed-height cold/background status remains; the continuation changes no loading layout, focus or scroll behavior. Content is never blanked for ordinary background reconciliation. Inbox controls are not blocked by intent work.

Passed: cold browser scenarios and a deliberately held initial snapshot followed by a new message before release (arrival appears exactly once); intent unit checks for debounce, bounded concurrency, promise adoption, stale cancellation, warm skip, participant/empty denial, ABA identity switch and logout; existing focused latency/cache browser regression; TypeScript; targeted ESLint; diff check; Production build. Prior two-context privacy, attachment-transfer, preview, composer and pagination evidence is reused for unchanged paths. No large-file suites rerun.

Remaining: direct/touch clicks with no prior intent still pay the authorized history network round trip. The shell's recipient bootstrap/lazy bundle is outside thread-selection measurements. Production/WAN plans and latency are unmeasured. Removing subscription-gap/read-state reads would require stronger delivery/snapshot guarantees and is not justified. Automatic prefetch is not justified by measured intent benefit alone. Ready for localhost review; no release performed.

Reproduce cold checks with `MESSAGING_COLD_TEST=1 node scripts/verify-messaging-latency.mjs`; compare the accepted parent using `MESSAGING_LATENCY_SOURCE_ROOT` pointing to an extracted parent source tree. Intent model check: `node --import tsx scripts/verify-messaging-intent-prefetch.mts`.
