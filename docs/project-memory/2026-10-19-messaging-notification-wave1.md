# Messaging and Notification retrieval — Wave 1 local candidate

October 19, 2026. **Local only; stop for Product/Architecture advisory review.** Base `da21615ad6f06727e4f18a75c65331a7266d2404`. Candidate branch `perf/messaging-notification-wave1`; resolve the completed local commit with `git rev-parse perf/messaging-notification-wave1`. No push, merge, hosted mutation, migration, deployment or release preparation.

## Scope and ownership found

Focused implementation of audit I1/N1, not a repeat repository audit. Tier 3 / focused Testing Level 3 because private request results cross shell/dialog consumers and must survive account/session races safely. No database/security policy change.

`GlobalMessaging` previously owned shell recent summaries, recipients and unread count independently of `InboxDialog`. Hover/focus and opening the dialog could start separate recipient reads. Inbox loading also read summaries/unread, and its unread callback could trigger another shell summary refresh. The shell's recent-loaded flag and nonempty collaborator array were effectively unbounded reuse within the mount. AccountNotifications started a new history RPC for every focus, application event or Realtime trigger, discarding stale responses by request number but still making all requests.

## Implementation

- `src/lib/coalesced-read.ts`: small component-owned coordinator, with one in-flight promise, same-turn coalescing, finite result reuse where requested, explicit invalidation, trailing reads and cleanup epochs. All waiters receive the latest uninvalidated result. Failed reads are not reused; reset rejects old results and old errors. No module/global response cache, localStorage cache or new dependency/framework.
- `src/modules/my-work/messaging/awareness.ts`: one owner created by the mounted GlobalMessaging account. Summary/unread reuse expires after 2 seconds; recipients after 30 seconds. Reopening can consume the menu's appropriate existing results. Meaningful state changes invalidate immediately and never use a cooldown.
- `GlobalMessaging`: publishes shared summary/unread reads, reuses the recipient owner, and removes the unread-to-summary feedback loop. An open/ready Inbox owns event-driven overview refreshes; the shell consumes publication instead of requesting the same summary. Hidden awareness still invalidates summaries and refreshes badge data. Cleanup resets the owner and rejects late consumers. Existing shell account keys and access-gate unmount behavior are retained.
- `InboxDialog`: consumes the shared owner; normal opens may reuse fresh results, message changes explicitly invalidate, and close/unmount cancels queued overview work and invalidates publication generations. Errors from obsolete generations cannot replace current error state. Thread paging, ordering, incremental reconciliation, uploads, transfer/draft storage and permissions remain unchanged.
- `AccountNotifications`: one component/account-owned history coordinator; concurrent triggers share a request and triggers received during a request require a fresh trailing snapshot. Pending live IDs remain accumulated for existing arrival attention. Reads after successful mark-read/mark-all reconcile with any pending older snapshot. Cleanup invalidates late success/errors. No time-based result reuse for notification history.
- Existing Realtime filters/private channels remain intact. Re-subscription now refreshes awareness/history in addition to existing thread refresh, closing a stale-awareness opportunity after reconnect. Initial joins do not automatically add another summary/history read solely for subscription acknowledgement.

The auth module is byte-identical to the base, including the accepted October 19 continuing-session/refocus logic. No SQL, migration, RLS, backend authorization, branding or business module was changed. No new account or content-reading privilege is introduced.

## Measured baseline and candidate

Actual exported app at **http://localhost:3000**, browser-routed synthetic API and synthetic Phoenix Realtime events. Baseline was the existing refocus-review app/worktree at the base; candidate was a fresh webpack Production-mode static export with local-only public fixture configuration and no `.env.local`. All API reads and writes during comparison were intercepted in browser memory; nonlocal/unrecognized business requests were blocked. No hosted business records or credentials were used. The completed previous TenOps refocus-review process was identified by port and working directory before stopping it for candidate review.

The same 13 scenarios were compared. Counters below include all API requests initiated by the action, including read/write commands where present. Bytes are serialized fixture response-body bytes, excluding headers, compression, WebSockets and static chunks; HEAD count responses transfer no body. Elapsed values are **single action-through-settlement observations**, including harness debounce/settlement waits, not precise first-usable-page times or production percentiles.

| Scenario | Requests before / after | Fixture JSON bytes before / after | Observed ms before / after |
|---|---|---|---|
| initial shell | 10 / 10 | 171 / 171 | 505 / 490 |
| first Messaging open | 5 / 2 | 1242 / 620 | 406 / 1043 |
| reopen Messaging | 2 / 0 | 433 / 0 | 235 / 241 |
| switch conversations | 3 / 3 | 1000 / 1000 | 327 / 330 |
| send message | 5 / 5 | 799 / 799 | 229 / 223 |
| receive and mark read | 7 / 7 | 1166 / 1166 | 393 / 378 |
| edited message event | 3 / 3 | 784 / 784 | 390 / 387 |
| deleted message event | 3 / 3 | 434 / 434 | 376 / 365 |
| overlapping notification triggers | 6 / 1 | 12 / 2 | 185 / 182 |
| notification event during delayed read | 2 / 2 | 170 / 170 | 281 / 275 |
| focus after completed refresh | 1 / 1 | 168 / 168 | 184 / 182 |
| continuing session refocus | 3 / 3 | 323 / 323 | 200 / 194 |
| reconnect | 1 / 4 | 660 / 1260 | 2041 / 2036 |

First open summaries: **2 → 1**; recipients **2 → 1**; its extra unread HEAD is avoided by brief reuse of shell count. Immediate reopen **2 → 0** within the 2-second reuse window. Six simultaneous notification focus/application triggers **6 → 1**. A genuinely later event during a delayed history read remains **2 → 2**, and a new focus after completion remains **1 → 1**. Startup remains 10 requests / two notification reads in this fixture because welcome creation can trigger a meaningful later invalidation. No startup speedup is claimed.

First-open elapsed time in the final sample was higher despite fewer API calls; lazy chunk/browser scheduling and the harness contribute. This candidate demonstrates deterministic request reductions, not a measured production latency improvement. Reconnect intentionally increases awareness reads: thread, summary, unread and notification history refresh once each, rather than only thread refresh. Receive/read still uses two overview snapshots when the read-state mutation is a separate meaningful change; these are not suppressed to optimize a counter.

## Validation and evidence

Fresh checks on the completed application code:

- Webpack Production export passed (22 static pages); explicit local fixture URL/key, enforced local client RBAC, Production branding. This is a local-only review export and must not be deployed.
- TypeScript `--noEmit --incremental false`, targeted ESLint and `git diff --check` passed.
- `scripts/verify-coalesced-read.mts`: six groups covering same-turn equivalence, pending-event trailing reads, discarded obsolete snapshots, out-of-order old/new owner completion, late errors/reset, denial/retry and expiry.
- `scripts/verify-awareness-browser.mjs`: the 13 before/after scenarios plus candidate-only Realtime notification co-arrivals/mark-all, thread-specific draft restoration/reopen and attachment queue, summary denial/retry, and simultaneous delayed old-account summary/history released after the new account finished loading. No prior-account summaries, unread notification or message text appeared in the new account. Active-profile revocation removed Messaging. No page errors or external requests.
- Existing `verify-samples-access-refresh.mjs --affected` passed two checks at exact localhost:3000: Sample library/Inspector revalidation with unsaved input and local PDF preview, plus native browser tab-switch commands retaining the Inspector. The native commands emitted no visibility events, so they do not constitute new physical tab-refocus acceptance. Zero hosted writes and no page errors.
- Existing recent-thread cache and text-draft verifiers passed; existing notification onboarding and live-arrival/deep-link gates passed; branding structural gate passed. The 40-row cache bound, participant/owner protections, draft revision races and notification attention state machine are retained.

The browser fixture tests incoming messages, read commands, server edit/delete events and reconnect. It does not newly validate hosted RLS/private Realtime, real attachment upload/download throughput or all-history pagination; their application/SQL implementations are unchanged. Reused accepted October 19 auth evidence remains applicable because auth code is unchanged. New continuing SIGNED_IN coverage retained the composer draft with one restoration entrance, and explicit revocation coverage closes the shell. Native physical tab-focus acceptance is not inferred from a synthetic focus event.

Evidence: [before](evidence/2026-10-19-awareness-before.json), [after including safety scenarios](evidence/2026-10-19-awareness-after.json), [validation receipt](evidence/2026-10-19-awareness-validation.json).

## Product review

Persistent worktree: `/Users/chrisngo/source/repos/tenarten-inventory-ui/.worktrees/messaging-notification-wave1`. The candidate static app is served at **http://localhost:3000** by the existing disposable Sample review adapter in `--fixture-auth` mode. That adapter permits local fixture operations only and performs no hosted auth or business forwarding. Its general Inbox data is empty, so use the populated browser fixture for this wave:

```sh
cd /Users/chrisngo/source/repos/tenarten-inventory-ui/.worktrees/messaging-notification-wave1
node scripts/verify-awareness-browser.mjs --review
```

This opens the actual localhost application in a visible isolated browser context with **Wave Bob**, **Wave Carol** and a synthetic notification. All business traffic in that context is intercepted. Close that browser to end the review. To restart the underlying static server after confirming port ownership: `./node_modules/.bin/tsx scripts/start-sample-job-update-review.mts --fixture-auth`. Do not replace another process without inspecting ownership.

Review first open/reopen, menu/recent-message state, Bob/Carol switching, draft retention, sending synthetic text, selecting/removing an attachment, Notifications and mark-all, and leaving/returning to the tab with an unsent draft. Realtime/race/denial scenarios are covered by the automated fixture: `AWARENESS_SAFETY=1 node scripts/verify-awareness-browser.mjs`. No live account or hosted test record is required. The fixture does not support arbitrary new business workflows or real file transfer; review only its explicit controls. It is not a hosted permission test.

## Remaining risks and follow-up

- Actual production latency, row counts, payload distributions and SQL cost are unmeasured. The existing conversation-summary SQL still ranks visible history; unchanged and outside this wave.
- Brief reuse is intentional: ordinary opens can use summaries/counts up to 2 seconds old and recipient metadata up to 30 seconds old. Message-state invalidations, reconnect and notification history bypass such reuse. Errors/reset expire reuse; no persistent private response cache exists.
- Events during an outstanding read deliberately cause one trailing read for correctness. Sustained event traffic can require repeated trailing reads; this is not blanket suppression of refreshes.
- Reconnect checks use synthetic Phoenix events, not a hosted socket outage. Native tab behavior beyond the accepted prior evidence is not newly certified by the synthetic focus/auth test.
- This is one local candidate, not a release. Production/TenDev remain untouched. Preserve root untracked audit/release artifacts and all historical research/worktrees.
