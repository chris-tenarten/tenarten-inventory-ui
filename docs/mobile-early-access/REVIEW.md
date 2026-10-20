# Mobile Early Access — local Product candidate

Review the actual application at **http://localhost:3020**. Start with Jobs → Overview, open a Job, then Timeline → Open full-screen Timeline. Use More → Intake → Planning for Projected Intake / Production / Combined. Representative records are synthetic; no hosted backend is reachable through this review server.

Port 3000 belongs to the active Manpower progressive-history candidate (`scripts/start-manpower-progressive-review.mts`). It was inspected and preserved. Port 3020 is the deliberate exception for this separate review. The existing research server on 3018 was also preserved.

Branch: `feature/mobile-early-access`. Persistent worktree: `.worktrees/mobile-early-access`. Base: `01e5e839fdba0256023077cf1d85c2d4dd15212c`. The completed candidate is committed locally; use its branch head. No merge, push, deployment, migration or hosted data mutation is authorized or performed.

At initial verification, public TenOps and TenDev each matched all 46 retained `01e5e83` release routes/assets byte-for-byte. During this task the parallel Manpower workstream advanced local and remote-tracking main/dev to `af04478658cac754c716e9a66758b12ccb8e8ab9`. This mobile branch intentionally retains its requested base and does not merge the parallel candidate. Before promotion, reconcile against the then-current canonical head and validate the combined release boundary. The initial Cloudflare credential returned HTTP 401, so deployment metadata was not freshly queried by this workstream. Final public comparison also matched all 46 routes/assets on both environments against the accepted `af04478` Manpower export. [Initial verification](public-release.json), [current public verification](current-public-release.json).

## Implemented architecture

The authenticated shell now presents **Jobs / My Work / Messages / More** below 768px and on coarse-pointer devices through 1023px, including phone landscape. More consumes the existing shell destination definitions and the same Intake visibility predicate. Links use existing Next routing. Messaging remains one persistent instance; mobile focus/hover no longer triggers the desktop recent-message menu. Desktop domain menus remain in place.

The reusable `useDetailNavigation` pattern adds a same-route history entry for mobile detail surfaces, allows module-owned close vetoes, handles Back/Close, and tracks the visual viewport for keyboard-sized layouts. Production Job inspection keeps the existing content, business controls, draft, save controller, history, files and planning editor. It uses full-screen mobile layout with one content scroller, a readable identity and reachable footer actions. Back cancellation preserves input and the prior Queue filter context. Opened Job Update composers survive tab switches and attachment refreshes without eager loading.

The mobile shell checks existing unload guards before route changes. Samples, Purchase Orders and Proposals additionally expose their existing dirty/busy state through a small mobile-only guard. This adds navigation protection without changing save or issuance behavior. Other editors retain their existing guards and presentation; this milestone does not convert their modals.

Queue cards retain existing fetching, enrichment, filters and lifecycle rules. Changes include two-line Job names, compact mobile heading, larger toolbar targets and consistent card presentation in phone landscape. Updates and files keep their existing contextual controls. Job selection now rejects obsolete asynchronous responses and shows recoverable opening errors.

## One Timeline presenter, separate module contracts

`src/components/mobile/MobileTimeline.tsx` owns the full-screen camera, virtualized rows/ticks, two-axis pan, focal pinch, bounded date scale, tap/hold selection, Today, Locate, Key and Exit. Pointer movement never writes dates. It has no query, mutation, scheduling or authorization implementation. Adapters are evaluated only when the mobile surface opens.

| Context | Existing source and eligibility | Selection and editing |
|---|---|---|
| Production | Existing filtered Jobs, chronological arrangement, staged schedules/phases and planning feature flag | Open details exits the map and opens the existing Job Inspector at planned dates. Staging, phase translation, validation, Save All and approval remain module-owned. |
| Projected Intake | Existing `normalizePlanning` / `planningForMode` output; lost and converted Bids remain excluded | Open details opens the existing Bid Inspector and planning card. Projected windows reserve no capacity. The expected-version save contract is unchanged. |
| Bids Production / Combined | Existing deferred, role-filtered Production schedule data and lifecycle keys | Production references open Production. They acquire no Bid-side Production editing or conversion authority. Planning-only references remain distinct from schedule effects. |

The existing embedded Timelines remain available. Desktop drag, resize, filtering, dependency and scheduling behavior are preserved. Full phase progress/dependency editing remains in the existing module editors; this mobile surface is a navigation and inspection layer over them. There is no simulated save or duplicate schedule database.

Primary bars display **Job/Bid names**. Labels remain fixed inside bars, truncate or disappear naturally as the bar clips, and never anchor to the viewport. Selection reveals full identity and status. Existing status colors/patterns, phase palette, pause hatch, requested-delivery semantics and staged outline are reused. The copied offline research source contains the same label corrections; its original handoff/evidence remains untouched in the main workspace. [Reusable research source](../audits/2026-10-20-mobile-timeline/README.md).

## Validation and limits

Risk Tier 3 for the cross-module presentation architecture. Testing Level 2 behavior coverage plus focused Level 3 authorization/data-contract boundary checks; no changed database or security contract required hosted mutation tests. One focused verification pass was corrected for actual findings, with completed unaffected groups reused. No unrelated historical suite was run.

- Production-mode webpack export, TypeScript, targeted ESLint and `git diff --check` passed.
- [Ten browser groups](browser.json): navigation/More/Messaging; Inspector Back/drafts/filters; Update tab/refocus continuity; Production gestures/labels/editor handoff; Bids/Combined; 320px/landscape/desktop; read-only/denied sessions; delayed/failed/rapid Job access and scoped retrieval; Sample draft navigation plus local Proposal creation/PDF; session replacement and viewport resizing.
- [Seven adapter groups](adapters.json): identity/callbacks, milestone eligibility, phase/pause rules, Bid eligibility, Combined references, incremental staged translation and non-mutation.
- [Visual checks](visuals.json): light/dark contrast, touch hit target, portrait/landscape screenshots and shared Bids rendering. [Unchanged contract hashes](boundary.json).
- Auth/refocus, RBAC, data access, scheduling/persistence helpers and all Supabase files remain unchanged. Synthetic review has no upstream forwarding path. No client exceptions or unexpected external requests occurred in the completed behavior checks.

This is compatibility evidence, not a hosted performance measurement or physical iPhone certification. Scoped startup reads and same-user refocus continuity were checked; no new fetching system or unbounded history was introduced. Existing release evidence for unchanged domain contracts is retained.

Screenshots: [Jobs](screenshots/jobs-portrait.png), [More](screenshots/more-portrait.png), [Job Inspector portrait](screenshots/inspector-portrait.png), [Inspector landscape](screenshots/inspector-landscape.png), [Production Timeline](screenshots/production-timeline-portrait.png), [Timeline landscape](screenshots/production-timeline-landscape.png), [light theme](screenshots/production-timeline-light.png), [Bids](screenshots/bids-timeline-portrait.png), [desktop Inspector](screenshots/desktop-inspector.png).

## Product review and remaining work

Ready for **local Product/Architecture review**, not Production release. Review the full-screen-map → existing-editor handoff and navigation density on a physical device. iPhone Safari must verify safe areas, native edge Back, pinch/hold arbitration, keyboard/visual viewport behavior, touch momentum and orientation changes before release. Desktop browser checks preserve the existing presentation but are not an exhaustive pixel comparison.

Remaining backlog includes the wider Samples/Purchasing/Manpower mobile audit, native-device accessibility checks, optional camera restoration when reopening the map after editor handoff, and further mobile planning-progress/dependency presentation. A pre-existing Sample details sticky-action overlap was avoided with its keyboard control in the navigation-guard test; no claim is made that this milestone repairs all Sample mobile interactions. Bid/Sample lifecycle semantics remain held for the Product Acceptance Contract; this candidate changes no lifecycle contract.

Reproduce from this worktree with the installed dependencies: run `node scripts/verify-mobile-boundary.mjs`; run the adapter verifier with `tsx`; build using the synthetic review origin `NEXT_PUBLIC_SUPABASE_URL=http://localhost:3020`, a synthetic anon key and `NEXT_PUBLIC_ENABLE_PLANNING=true`; run `tsx scripts/start-mobile-early-access-review.mts`, then `node scripts/verify-mobile-early-access.mjs` and `node scripts/verify-mobile-visuals.mjs`. The review export uses local configuration and must not be deployed.
