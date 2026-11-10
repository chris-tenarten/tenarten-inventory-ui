# TenOps UI/UX modernization assessment

Review date: November 10, 2026. Direction B navigation refined after Product feedback; see the focused navigation review at the end. Scope: source assessment and isolated interactive design exploration, with no accepted application redesign.

## Baseline and evidence

- Verified worktree: `C:\Users\chris\source\repos\tenarten\tenops-ui-modernization`.
- Verified branch: `design/ui-modernization`; HEAD and requested baseline: `615026369bd8443888c903f47f7be8ffe60eb745`.
- The worktree was initially clean. All task artifacts are isolated under `design-review/`; accepted frontend, package inputs and public assets are unchanged.
- The session opened in the separate `tenarten-inventory-ui` dev checkout at `d1f32ad6a816ade61420917361e952309288a482`, with an existing AGENTS.md modification. That checkout was read only and untouched.
- `README.md:3` and `PUBLICATION_BASELINE.json` identify this sanitized frontend as independently rooted history, sourced from Production `301a6bd1b34698a212c1e5652b424ed4a62c7ce1` with accepted source `fb0725a526e43aead89d0ca0345eb8534f406a0a`. These are provenance records, not claims of live verification.
- The project manifest requested by the session was read from the original checkout. It is absent from the isolated baseline and predates parts of this source. Its manufacturing/operational principles remain useful context; current frontend source governs implemented behavior, permissions, statuses and mobile navigation. No missing backend, schema or services were reconstructed.

Evidence labels: **Source** means verified in the isolated frontend. **Proposal** means a design judgment or behavior for review. **Prototype** means an approximation on synthetic fixtures. No authenticated before screen or live behavior was observed.

## Current-state assessment by employee impact

| Priority | Source finding and exact implementation boundary | Employee impact and recommended treatment | Category |
|---|---|---|---|
| P1 | Inventory stock details open from a desktop `<tr onClick>` without an equivalent named keyboard trigger (`src/app/inventory/page.tsx:3736`, `:3761`). Mobile already implements keyboard handling (`:3654`). | Add a named detail button while retaining row-click convenience. Workers using keyboard navigation need equal access. | Accessibility correction; small effort, low risk |
| P1 | Receiving's Received By label is not connected to its input (`inventory/page.tsx:2836`); BusinessInput forwards props without automatic association (`src/components/BusinessWriteControls.tsx:12`). | Associate labels/inputs systematically, starting with receiving. | Shared forms accessibility; small effort |
| P1 | Task Inspector calculates dirty state (`src/modules/my-work/MyWorkTaskInspector.tsx:27`), but closeDetails dismisses whenever no operation is pending (`:40`); shared dialog Escape/backdrop can call it (`production/contacts/ProductionDialog.tsx:70`). | Edits can be lost on dismissal. Propose consistent dirty-close confirmation as a separate behavior decision. The prototype labels its guard as proposed. | Behavioral; Product approval |
| P1 | Receiving's hand-built modal lacks the focus lifecycle visible in Bids (`inventory/page.tsx:2807`, Escape scope `:675`; `pre-production/BidWorkspace.tsx:68`). Task Groups also uses a custom overlay (`my-work/MyWorkPage.tsx:345`). | Reuse proven modality, focus containment/restoration and dismissal conventions. Preserve pending drafts, receipt confirmation and retry semantics. | Shared dialog accessibility; medium effort/risk |
| P2 | Production table has authored 8px uppercase headers, 10px inputs, 24px input heights and per-cell grid lines (`production/components/ProductionTable.tsx:108-113`). Global CSS remaps some authored type sizes (`app/globals.css:201-208`). | Quiet the grid and establish semantic type roles. Do not equate authored Tailwind sizes with runtime pixels; validate display-size preferences. | Foundation + shared table polish |
| P2 | Project/customer defaults are 150/120px among many administrative columns (`ProductionTable.tsx:119-137`). | Favor work identity and customer in revised defaults; preserve resizing, visibility, sticky identity, scrolling and employee preferences. | Presentation; default changes need review |
| P2 | Pipeline stacks a mode selector, eyebrow, title/help, Monthly Workload and separate framed toolbar (`production/ProductionWorkspace.tsx:982-1018`). | A clear three-level hierarchy should put work ahead of chrome, preserving dense content and existing destinations. | Cosmetic |
| P2 | Workload and Pipeline filtering are independent; source explains the distinction in screen-reader text (`production/components/MonthlyWorkload.tsx:199`). | Add a short visible scope label. Do not silently join the filters. | Cosmetic explanation; filter behavior deferred |
| P2 | Production Inspector uses tab roles without a complete arrow-key/roving-focus pattern (`ProductionJobInspector.tsx:885-904`), although its focus trap/Escape handling exists (`:548-575`). | Share an accessible tab implementation without changing sections or permissions. | Shared accessibility |
| P2 | Shell has compact split controls, actual 6/7px role copy and narrow actions (`app/client-layout-shell.tsx:216`, `:532`; `components/GlobalMessaging.tsx:161`; `AccountNotifications.tsx:297`). | Readable small labels and consistent hit areas improve recognition and touch use without inflating every row. | Typography/control geometry |
| P2 | Semantic tokens exist (`app/globals.css:99`, `:359`), alongside broad dark utility remapping (`:543-635`) and module-specific exceptions. | Adopt surface/text/border/interactive roles incrementally. Keep Production statuses independent of brand accent. | Foundation; medium effort/risk |
| P2 | Manpower explicitly uses a 1480px editable table (`manpower/ManpowerWorkspace.tsx:1229`). | Preserve dense desktop entry, improve scroll/sticky identity cues; consider a separately approved phone review view. | Desktop cosmetic; mobile behavior deferred |
| P2 | Reporting analytics period and complete entry-group scope differ (`ManpowerWorkspace.tsx:1175-1182`). | Use adjacent plain scope labels so period totals and complete-group search are distinguishable. Keep loading/search semantics unchanged. | Cosmetic first |
| P3 | Inventory rounded-lg/md chrome contrasts with Bids/Manpower rounded-sm sections (`inventory/page.tsx:2318`, `:2816`; `BidWorkspace.tsx:114-123`; `ManpowerWorkspace.tsx:74`, `:1220`). | Unify radius, dividers, headers, spacing, fields and footers through shared controls. | Shared component polish |
| P3 | Nested fieldsets/cards and uppercase labels compete in Bids and Manpower (`BidWorkspace.tsx:120`; `ManpowerWorkspace.tsx:75`, `:592`, `:1220`). | Replace redundant boxes with spacing/selective dividers, retaining controls and table columns. | Cosmetic |
| P3 | Intake Today line changes blue to red in dark styling (`pre-production/IntakePlanning.module.css:1`). | Assess an informational token across appearances; visual severity remains unverified. | Cosmetic hypothesis |

Do not carry forward the older manifest's claim that Manpower group-name contrast is currently broken: this baseline explicitly supplies text, caret, selection and label handling (`ManpowerWorkspace.tsx:201`). Likewise, this source includes auth and permission helpers; an older statement about client-only MVP access does not describe this baseline reliably.

## Existing patterns worth preserving

**Production and planning.** Pipeline has Overview/Table/Timeline; Dashboard also offers Monthly Snapshot (`ProductionWorkspace.tsx:982`). Overview and mobile cards expose identity, customer, status, schedule, delivery, labor, readiness and files (`ProductionQueue.tsx:66-166`). Ordinary fields and schedule proposals are separate. Pending schedule work survives view/filter/Inspector use and retains a global review/discard/save bar (`ProductionWorkspace.tsx:1180-1198`). Preserve failure retention, original dates, conflict feedback and authoritative returned values; this prototype does not test the RPCs.

**Monthly Workload.** Jobs/My Tasks/Both; Active/On Deck/All Scheduled; Compact/Default/Expanded; month navigation, collapse and complete daily overflow are valuable existing affordances. Density changes week capacity, not item type size (`monthly-workload-density.ts:8-15`; `MonthlyWorkload.tsx:210-250`). Contents, density and expanded state are employee-scoped; view preference remains browser-wide (`MonthlyWorkload.tsx:23-71`). Prototype preference storage is deliberately separate and cannot prove ownership behavior.

**Inspectors and sharing.** Preserve Details, conditional Planning, Job Updates, Files and Recent Changes (`ProductionJobInspector.tsx:758-768`), attachments near identity, ordinary save feedback and staged dates. Share offers Copy link / Send in Messaging with messaging.write gating (`ProductionJobShare.tsx:42-90`). Canonical links use `/?open-production-job=<uuid>` (`production/job-links.ts:1-23`); sharing prepares a draft for explicit review/send (`my-work/InboxDialog.tsx:242`).

**Intake/Bids.** Preserve semantic row buttons, search/sort/filter, mobile identity, Overview/Updates/Files, focus/dirty-close protection and lifecycle history (`BidWorkspace.tsx:68`, `:112-116`). Conversion requires saved Won plus Deposit Received Date, with Carry Forward/New Dates/Unscheduled confirmation and scheduling permissions (`BidPlanningCard.tsx:58-65`). Presentation may improve without changing the handoff.

**Inventory.** Pending Receivals starts collapsed with an attention count and inert hidden content (`inventory/page.tsx:488`, `:2311-2342`). Pending creation does not alter stock. Preserve partial receiving, actor attribution, explicit quantity confirmation, uncertain-result retry (`:1974`, `:2847`), guarded undo (`:2906`), canonical job versus temporary reservation identity, and reserved/general stock separation (`:22`, `:3754`).

**My Work.** Preserve Today/All Tasks/My Tasks/Shared Tasks, groups, sort/group choices, completion, estimated effort and delegated workload (`MyWorkPage.tsx:62`, `:208-210`, `:314-345`). Today includes overdue and next-seven-day tasks. Task completion is not a new Production status. Personal group colors override displayed task color while retaining the stored personal choice (`MyWorkTaskInspector.tsx:68`). No task priority or Kanban lifecycle exists in the source types.

**Shell, Messaging, notifications and TenBot.** Keep source destinations and permission gates (`client-layout-shell.tsx:42-66`, `:509`, `:553-556`; `ToolboxLauncher.tsx:9`, `:55`). Mobile is Jobs/My Work/Messages/More, with TenBot in the header (`mobile/MobileNavigation.tsx:41`). Messaging is one canonical Inbox with employee-scoped sidepane preference (`GlobalMessaging.tsx:52`, `:155-167`). Bell notifications are personal activity, not every Job Update (`AccountNotifications.tsx:241`, `:301`, `:344`). TenBot requires allowed active ownership/readOperationalData, closes for Messaging, supports desktop pane/expand and mobile full-screen (`GlobalTenbot.tsx:28`; `GlobalTenbotWorkspace.tsx:70-101`). Prototype modals are labeled approximations of these workspaces.

## Three design directions

| Direction | Visual system | Strength / tradeoff |
|---|---|---|
| A — Refined Enterprise | Neutral slate, fine rules, flat metric strip, serif section hierarchy, horizontal shell, small radii. | Most familiar transition and restrained executive polish. Less distinctive; serif headings need stakeholder review. |
| B — Modern Operations | Cool surfaces, clear Segoe UI hierarchy, consistent compact controls, connected calendar/table surfaces, isolated status swatches and the accepted horizontal header/dropdown structure. | Strongest scanability and cross-module foundation. Accepted ordering, grouping, destinations and interaction patterns are retained. |
| C — Industrial Premium | Graphite header, muted warm metal accent, squared geometry, technical labels, Bahnschrift/system fallback, restrained warm neutral surfaces. | Strong manufacturing character. Accent and technical typography require contrast and legibility validation across devices. |

All three have corresponding dark surfaces, readable text roles, dense desktop fields and deliberate phone job cards. Brand accents do not replace Production semantics. No decorative gradients, glass, giant cards, remote typefaces or animation dependency were added.

Production semantics verified in `status-visuals.ts:13-47` and `globals.css:261-355`: Not Started slate `#e2e8f0`; On Deck green `#2f855a` with white diagonal bands; In Production navy `#172554`; On Hold rose `#be123c` with strong translucent diagonals; Shipped cyan `#0e7490` with soft diagonals; Complete violet `#7c3aed` with white bands; Cancelled muted red `#a65359`. Active statuses include Not Started, On Deck, In Production and On Hold (`supabase/functions/_shared/production-job-facts.mjs:3-4`). The prototype preserves fill/pattern identity, relocating patterns to swatches on stable label surfaces. This is a proposed presentation, not a change to status meaning.

## Representative before/after comparisons

Use Before then A/B/C without changing fixture data. Before is a source-derived reconstruction, not an authenticated screenshot. Prototype layout and proposed metrics remain in Before for comparison; only selected source styling is reconstructed. This is not pixel-perfect visual-diff evidence.

| Source-grounded before | Proposed after | Review boundary |
|---|---|---|
| Layered uppercase controls, title/help and framed sections in Production | One workspace title, connected module controls, calmer separators | Preserve mode/view/filter scopes |
| Full per-cell table grid and narrow identity defaults | Quiet row rules, prominent project/customer, full Table retains administrative columns | Resizing/hiding/sticky and saved preferences are requirements, not all implemented in prototype |
| Patterned bars needing text strokes/shadows | Exact status pattern in a swatch beside stable readable labels | Validate every status/theme before adoption |
| Different dialog/Inspector surface conventions | Consistent header, tab line, fields, side information and footer | Preserve source focus, dirty state, retry and confirmation behavior |
| Dense desktop table compressed onto phone | Phone job cards retain schedule/status/material/labor and Inspector access | Calendar stays honestly scrollable; no implied full phone editing parity |
| Click-only Inventory row / unassociated receiving label | Named keyboard detail action / connected label and shared modal lifecycle | Audit recommendation only; Inventory is not reimplemented |

## Recommended direction and incremental roadmap

Recommend **B's data hierarchy, semantic surfaces and controls**, retaining the accepted navigation grouping for the first implementation. A's restraint is a useful guardrail; C can inform a restrained brand treatment. The navigation rail has been removed from B. The selected appearance preserves accepted navigation; it does not authorize a workflow rewrite.

Relative estimates below are planning ranges for one experienced engineer after Product approval, not delivery commitments. They include focused validation and assume no backend changes.

| Order | Work | Effort | Employee impact | Regression risk / acceptance boundary |
|---|---|---|---|---|
| 1 | Foundation: semantic typography roles, 4/8px spacing rhythm, surface/border/text tokens, focus and control target rules; preserve display-size settings and all Production mappings | M, 3–5 days | High, all modules | Medium: broad CSS remapping must be migrated incrementally, not globally replaced |
| 2 | Shared controls: buttons/connected segments, labeled fields, status swatch/label, tab and native dialog/Inspector chrome | M, 4–7 days | High | Medium: verify keyboard, open/close, errors, dirty drafts and mobile overlays |
| 3 | Immediate accessibility: named Inventory detail action, associated receiving labels, shared receiving/Task Groups focus lifecycle | S–M, 2–4 days | High | Low–medium: preserve transaction and dismissal behavior |
| 4 | Production pilot: heading/toolbar/calendar scope labels, table scanability and Inspector presentation | M, 4–7 days | Highest daily planner impact | Medium–high: saved widths/density, deep links, scheduling and concurrent edits are acceptance checks |
| 5 | My Work and global chrome: consistent fields/groups, task emphasis, Messaging/notification/TenBot entry and workspace chrome | M, 4–6 days | High | Medium: employee preference ownership, drafts, unread state and responsive handoffs |
| 6 | Inventory and Intake: adopt approved shared controls, flatten redundant frames, polish receiving/convert confirmations | M, 4–7 days | High | Medium–high: reservations, partial receipt, retry/undo and conversion are protected |
| 7 | Reporting: distinguish period/entry scope, polish dense grid and analytics labels without changing calculations | S–M, 2–4 days | Medium–high | Medium: complete-group totals/search and AM/PM calculation stay stable |
| Separate | Product decisions: task dirty-close guard; proposed KPI definitions; table defaults; dedicated mobile reporting/day view | M–L, scope after approval | Potentially high | Behavioral: explicitly approve and test separately |

Do not implement this as an application-wide rewrite. Pilot the accepted foundations in one Production slice, review with office and shop users, then reuse proven shared components module by module. Do not bundle new calculations, backend changes, schedule behavior or permission changes with the polish.

## Files Modified

New files across the exploration: `design-review/index.html`, `styles.css`, `app.js`, `navigation.js`, `serve.mjs`, `README.md`, `ASSESSMENT.md`. No accepted files modified.

## Behavioral Changes

Only the isolated review app: A/B/C/Before selector; light/dark and mobile frame; synthetic calendar filters/density/overflow; job/task inspectors; fixture edits and completion; local schedule review and Share/Messaging demonstrations; scripted TenBot responses. No live TenOps behavior changed.

## Architectural Changes

A dependency-free static app, one shared synthetic state/rendering layer and three CSS token/geometry systems. A loopback-only Node server exposes a strict file allowlist with outbound connections disabled by Content Security Policy. No production component imports or new production abstractions. Future accepted work should build on existing status helpers, domain types, native dialog lifecycle and source permissions rather than importing this prototype wholesale.

## Database / Schema Changes

No database changes.

## Validation

Completed: source audits across requested modules; Node syntax checks for app.js and serve.mjs. Final focused runtime/HTTP and preservation check results are recorded below after execution. No package install, dependency upgrade, production build, repository-wide lint, broad regression campaign, backend call or deployment was needed for this static artifact.

Browser review was attempted but did not reach the page: the in-app browser access host was unavailable, then Windows automation stopped because it could not verify Chrome's current URL with enough confidence. No visual rendering, real mobile hardware, live keyboard/focus behavior, clipboard or authenticated workflow test is claimed. Native dialog semantics and responsive code were inspected, not runtime-proven.

## Remaining Risks

Rendered geometry, every patterned contrast combination, font fallback, touch targets, keyboard focus restoration and resize behavior still need human browser review. Synthetic density cannot represent every long label, full employee permission combination or real job/task volume. This static review does not prove concurrency, retries, backend permissions, realtime messaging, notification delivery or the complete TenBot runtime. The baseline intentionally excludes backend runtime, migrations, private records and vendor assets. Fixture changes reset on reload; no accepted source workflow has been replaced.

## Recommended Commit

Subject: `[CF-Pages-Skip] [skip ci] Add isolated TenOps modernization audit and design review`

Optional body: `Add three synthetic local-only design directions and a source-grounded incremental roadmap. Preserve accepted frontend and all backend/deployment boundaries.`

No commit was made. HEAD remains the requested baseline; task files are intentionally uncommitted for Chris's review.

### Executed focused check results

- `node --check design-review/app.js` and `node --check design-review/serve.mjs`: passed after review fixes.
- Existing PostCSS parser successfully parsed `styles.css`.
- Node VM with stubbed DOM: initial app evaluation and all 16 direction/theme/frame combinations passed; independent Pipeline/calendar filtering passed; Both renders a separate task lane with completed/overdue cues; ordinary dirty edits block schedule staging; staging keeps saved dates unchanged; local approval applies the proposal and clears the batch; preview links retain only the canonical reference query. These are state/render-function checks, not a browser or CSS-layout test.
- HTTP: `/`, `/app.js`, `/styles.css`, `/ASSESSMENT.md`, `/README.md` all returned 200 with expected content types and CSP; non-allowlisted environment/source paths returned 404; POST returned 405.
- `git diff --check`: passed. `git diff --exit-code 615026369bd8443888c903f47f7be8ffe60eb745 -- src public package.json package-lock.json`: passed, establishing those accepted inputs are unchanged. No tracked diff exists; only `?? design-review/` is present.
- Isolated branch/HEAD remain `design/ui-modernization` / `615026369bd8443888c903f47f7be8ffe60eb745`. Original dev checkout still reports only its pre-existing modified AGENTS.md, at the original inspected HEAD.
- Independent prototype source review identified and corrected draft-loss paths, new-task cancel cleanup, separate personal/effective task colors, canonical share links, independent job/task lanes, accessible Share naming, responsive breakpoint updates, mobile controls and dialog sizing. Browser rendering remains unverified for the reasons above.
- Additional independent Node VM pass: 13 assertions passed for new-task Cancel/Discard cleanup, personal color retention versus group display, completion/reopen, dirty edit guards for staging/status/Share/review, independent task lanes, completed/overdue cues and Pipeline/calendar filter independence. No application runtime exception occurred; native DOM/layout behavior was not exercised.

## Focused Product revision — Direction B with accepted navigation

This revision implements Product feedback to preserve the established information architecture. The accepted frontend source is authoritative; the prototype's Before view was not used to define navigation. The navigation rail is removed from B, with its visual tokens, operational hierarchy and data surfaces retained.

### Exact differences identified and corrected

| Boundary | Earlier B prototype | Accepted source and corrected B |
|---|---|---|
| Desktop layout/order | Rail: Dashboard / Intake & Bids / My Work / Reporting / Inventory / Toolbox | Horizontal header: Dashboard / Reporting / Inventory / separator / My Work / TenBot / Messaging / Notifications / Account (`client-layout-shell.tsx:509-520`) |
| Dashboard hierarchy | Dashboard direct button; Intake promoted to top level and renamed Intake & Bids | Dashboard direct link `/` with Production then Intake submenu; exact Intake label and active-profile/viewIntake gate (`:42-45`, `:509`; `language.tsx:18-22`) |
| Reporting hierarchy | Button opened a summary modal | Reporting direct link `/manpower-reporting`; submenu Manpower, Material Usage, Daily Production disabled in that order (`:47-63`) |
| Inventory hierarchy | Button opened summary; Activity renamed Inventory Activity | Inventory direct link `/inventory`; Current Inventory, Pending Receivals, Activity, with accepted Pending Receivals query/hash (`:66-70`) |
| My Work / tools | My Work direct button; Toolbox split into independent top-level destination; nested sections flattened | My Work direct `/my-work` link plus independent Open My Work tools chevron; sections My Work→Tasks, Tools→Sample Form Generator / Proposal Generator / PO Generator / Letter of Transmittal, Resources→Contacts / Catalog (`:138-143`, `:258-285`; `ToolboxLauncher.tsx:9-17`) |
| Parent/dropdown interactions | Click-only buttons opened summaries | Domain hover/focus open, leave/outside-blur close; parent is a real destination link; selection dismisses/blurs until pointer leaves. My Work retains separate link/chevron, hover opening, outside blur and chevron toggle. Source does not add Domain/My Work Escape behavior (`:187-249`, `:269-285`) |
| Utility control order | Messaging / Notifications / TenBot / Planner preview role | TenBot / Messaging split launcher/menu / Notifications / Account. Account retains identity/role, Settings, Sign out. Role fixture selector is outside product chrome (`:515-542`) |
| Messaging menu | No accepted dropdown hierarchy | TenBot conversation entry when allowed; Recent messages; synthetic recent rows; Message sidebar switch. Launcher and menu chevron remain distinct (`GlobalMessaging.tsx:159-162`) |
| Role fixture | Invented Planner role and blanket read-only no-send behavior | Accepted role labels Member / Lead / Guest and read-only Member; all retain their read destinations. Read-only Member fixture explicitly retains Messaging participation. Signed-out fixture hides authenticated navigation. Gates use active/matching-owner/capability state; no false Guest-versus-Member visibility difference (`rbac.ts:80`, `:134-145`; `auth.tsx:275-278`) |
| Mobile header | Duplicated Messaging in header and bottom; wrong action order | Branding / TenBot / Notifications / Account. The single persistent Messaging instance moves to bottom slot three (`globals.css:1750-1769`) |
| Mobile bottom/More | Jobs / My Work / Messages / More existed, but More was summary modal, included Daily Production, omitted Settings and renamed Production | Same four accepted bottom labels; full-height More below measured header, exact list below, no Daily Production. Focus containment, Escape, Close and same-route Back/Forward behavior (`MobileNavigation.tsx:18-45`) |
| Active states | Only broad Production/My Work button state | Source path matching for domain/children, `/production` alias; My Work active only its own route, not all tools. Pending Receivals deliberately leaves Current Inventory active because accepted matching is pathname-based and uses a nonmatching sentinel for that item. Mobile Jobs/My Work clear while More is open; More active outside those route families; Messages has no page-current marker (`client-layout-shell.tsx:167-170`; `MobileNavigation.tsx:38-45`) |
| Responsive rule | Initially a simple 760px cutoff | `(max-width:767px), (max-width:1023px) and (pointer:coarse)` from accepted source. Explicit Mobile/Desktop review framing remains available outside the product header. |

Mobile More order is exactly: Production; Intake; Manpower; Material Usage; Current Inventory; Pending Receivals; Activity; Sample Form Generator; Proposal Generator; PO Generator; Letter of Transmittal; Contacts; Catalog; Settings (`client-layout-shell.tsx:552-558`). Intake and Contacts retain their source capability filters.

### Updated review instructions and limits

Open **http://127.0.0.1:4176/?design=b** on **port 4176**. Refresh an already-open prototype tab to load the added navigation script. Use external Role fixture, Mobile/Desktop and Light/Dark controls. Hover or focus Dashboard/Reporting/Inventory; click a parent label to navigate directly. Open My Work's chevron for its three nested groups. In Mobile, open More, follow a destination, then test Back.

Accepted hrefs are retained. Production and My Work render the existing synthetic operational fixtures; other modules display route-specific navigation previews rather than entering an authenticated backend. The static server now recognizes only an explicit allowlist of these frontend review routes. Modified/new-tab links retain normal anchor behavior, but real auth, Next.js routing, module unload guards, employee-scoped Messaging preferences, notification delivery and TenBot backend are not recreated. The existing Message sidebar entry demonstrates a collapsed message bar and opens the synthetic Inbox; full source sidepane expansion remains approximate. Sign out selects the locked fixture and never changes a real session. No permissions were inferred from the Before view or from synthetic fixtures.

The source provides no default-role read-navigation differences between Guest, Member and Lead; fixtures intentionally do not invent them. Gate functions are mirrored for Intake/Contacts/TenBot and authenticated utilities, but these are frontend review fixtures, not backend authorization tests.

### Files Modified

This refinement changed existing `design-review/index.html`, `app.js`, `styles.css`, `serve.mjs`, `README.md`, `ASSESSMENT.md`; added `design-review/navigation.js`. Earlier A/C/Before experiments remain historical and are explicitly not navigation authority. No accepted application files were changed.

### Behavioral Changes

Only Direction B now uses accepted navigation order, grouping, destination hrefs, dropdown/split-control interaction patterns, active states, synthetic role visibility and mobile More behavior. Operational fixture workflows and B's design foundation remain available. No production UI implementation occurred.

### Architectural Changes

Navigation contract/rendering and fixture logic live in a prototype-only navigation.js, loaded before app.js. The existing shared fixture state and CSS appearance are reused. No production imports, dependency changes or production abstractions. The preview server adds explicit frontend route fallbacks; it still cannot serve arbitrary source, Git files or environment files.

### Database / Schema Changes

No database changes.

### Validation

- Passed Node syntax checks for navigation.js, app.js and serve.mjs; existing PostCSS parser accepted the CSS.
- Independent source review plus 18 Node VM checks verified script order, exact header/menu structure, disabled Daily Production, role/gate visibility, active-path cases, Domain focus/blur behavior, My Work split-control behavior and source-specific Escape behavior.
- Additional focused Node VM checks passed initial B rendering, stale More-token cleanup, unique per-open token, Back close, Forward restore/focus path, mobile-to-desktop cleanup, locked-fixture cleanup, read-only visibility, exact 14 More destinations and Pending Receivals active semantics. These stubbed-DOM checks do not prove native layout or browser focus behavior.
- HTTP 200 confirmed for `/?design=b`, `/navigation.js`, `/my-work`, `/manpower-reporting`, `/inventory?section=pending-receivals` and `/settings`.
- `git diff --check` passed. Accepted src/public/package inputs compare unchanged against baseline `615026369bd8443888c903f47f7be8ffe60eb745`. Only `?? design-review/` is present. Original dev checkout still shows only its pre-existing modified AGENTS.md at its unchanged HEAD.
- Browser review was attempted using the existing Chrome preview. An unrelated Windows location prompt was dismissed by the user; Computer Use then stopped on the user's physical Escape key before the refreshed B rendering could be verified. No successful rendered validation of this refinement is claimed. No broad regression campaign was run.

### Remaining Risks

Rendered header fit, menu positioning, dark/mobile contrast and native browser focus behavior await Product's focused browser review. Authenticated module rendering, profile ownership, exact SPA/unload event integration, device Back history, sidepane expansion and backend runtime remain outside this isolated static prototype. The source contract is represented and checked in code; visual QA remains incomplete.

### Source Status and Recommended Commit

Worktree: `C:\Users\chris\source\repos\tenarten\tenops-ui-modernization`; branch `design/ui-modernization`; unchanged HEAD `615026369bd8443888c903f47f7be8ffe60eb745`. No commits, branches, push, deployment, backend or production changes.

Subject: `[CF-Pages-Skip] [skip ci] Preserve accepted navigation in Modern Operations prototype`

Stop for Product review. No production redesign is authorized by this prototype refinement.

Final fixture check: read-only Member's Messaging composer remains enabled and a synthetic local send succeeds in the Node VM; business-write guard remains in place. Final JavaScript syntax, CSS parsing and whitespace/conflict-marker checks passed. Files remain uncommitted under design-review/ only.

## Focused Product revision — environment branding and Job Update indicators

### Authoritative branding mechanism and assets

`src/lib/dev-branding.mjs:1-28` selects development only for `NEXT_PUBLIC_DEV_BRANDING === "true"`; absent, `TRUE`, `1`, or other values remain Production. Its configurations supply product identity, subtitle, default appearance and developer-art flags. The prototype server imports and calls that pure helper for both selector fixtures; the header renderer consumes the returned configuration. No environment file or credentials were read or changed.

Authenticated header (`client-layout-shell.tsx:448-497`, `AppBranding.tsx:6-28`):

- Production: actual `/tenarten-logo-steel-welcome.webp`, accepted source-rendered **TenOps** text, **Operations Control** subtitle (`language.tsx:44`). Source uses text for this wordmark; no separate TenOps wordmark image was invented.
- TenDev: the same source-selected steel crest, underlying TenOps product text with actual `/dev-branding/tendev-overlay.webp`, **RESEARCH & DEVELOPMENT** subtitle and actual `/dev-branding/development-environment.webp`. The existing overlay is not recreated with font styling.
- Locked header: actual `/logo.png`; source product name and TenDev stencil/subtitle treatment, without authenticated overlay/environment artwork. The login card composition is outside this header-only scope.
- Production defaults light; TenDev defaults dark; explicit per-environment review appearance overrides remain available. Both source configurations suppress Early Access badges. Prototype preferences are namespaced separately from real app preferences.

All required referenced header assets exist. Their served bytes were verified against source with SHA-256. No logo files were copied, modified or generated. `PUBLICATION_BASELINE.json:55-56`, `:82`, and README identify omitted/replaced personalized decorative artwork; the prototype uses only the available current-source assets and does not retrieve/reconstruct personalized originals. Full pre-sanitization personalized-art parity cannot be claimed. A minor source metadata discrepancy remains documented: DevBranding declares the overlay 1918×820; the file is actually 1908×824. The prototype uses its actual intrinsic ratio; accepted source is unchanged.

PWA/title configuration (`layout.tsx:12-47`, `manifest.ts`, `manifest-dashboard.webmanifest/route.ts`, `appearance-storage.ts`): TenOps/TenDev product names select matching `*-app-icon-192/512.png` and Apple touch assets, default page title `{productName} Cloud — Dashboard`, and default theme colors `#eef1f4` / `#11151b`. The prototype's browser metadata follows those source identities. Accepted manifest IDs/start URLs, service worker, icons, page-title definitions, flags and real appearance keys remain unchanged. No prototype PWA registration/install behavior was added.

### Original Job Update indicator behavior and restoration

Source `production/components/JobUpdatesIndicator.tsx:24-58` uses the Lucide **MessageSquare** icon in an always-visible neutral bordered control. Ready/positive displays icon, separator and **total Job Update count**. Ready/zero displays icon only, without numeric zero. Loading/error displays an em dash instead of a count. Exact tooltips are `N job update(s)`, `No job updates`, `Loading Job Update indicators`, `Job Update indicators unavailable`; accessible names begin `Open Job Updates for {job number or name}:`.

A separate 6px blue dot appears only when ready, total is positive and `summary.hasUnseenActivity` is true. This is employee/job-level unseen activity, not an unread count or follow-up count (`jobs.ts:272-302`). No new notification rule or unseen calculation was introduced.

Overview placement is beneath job/customer identity on desktop and in the mobile card footer (`ProductionQueue.tsx:134-147`), before file controls in ActivityStrip (`ActivityStrip.tsx:44-91`). Clicking stops row propagation and opens Inspector's Job Updates section (`ProductionJobInspector.tsx:310-319`); its tab includes the total (`:761`). Ordinary Details leaves unseen unchanged. The accepted loaded panel acknowledges seen state through its existing helper (`JobUpdatesPanel.tsx:277-290`).

B Overview restores that control and placement using explicit synthetic update arrays and separate unseen booleans. Synthetic examples include zero updates, seen positive totals and unseen positive totals. The original row/title/arrow navigation remains available. Opening Job Updates simulates a successful seen acknowledgement locally, clears the dot and retains the total. Local fixture posts append to the total without inventing backend delivery/unread behavior. No backend or seen-state RPC is invoked.

### Files Modified

Changed `design-review/index.html`, `app.js`, `navigation.js`, `styles.css`, `serve.mjs`, `README.md`, `ASSESSMENT.md`; added `design-review/branding.js`. No accepted source, public assets, package inputs, manifests or environment configuration changed.

### Behavioral Changes

B now has an external Production/TenDev selector, authentic available header lockups, corresponding preview title/icon metadata and per-environment local theme choices. Accepted navigation hierarchy/order/gates remain. Overview restores always-visible update controls, exact count/tooltip semantics, explicit unseen dot, direct update-tab navigation and representative synthetic data. Other concept/theme/viewport comparisons remain available.

### Architectural Changes

Prototype-only branding.js consumes configuration emitted by the loopback server using the accepted pure branding helper. The server serves a fixed allowlist of existing public images with correct binary MIME types. No backend imports, environment rewrites, production abstractions or replacement branding assets. Job Update fixture summaries remain separate from the personal notification bell and Messaging state.

### Database / Schema Changes

No database changes.

### Validation

- JavaScript syntax checks for branding.js, navigation.js, app.js and serve.mjs passed; CSS parsed successfully.
- Independent bounded Node VM branding checks passed source configurations, deferred script order, authentic/locked lockups, defaults/overrides, theme retention, unchanged navigation and missing-asset diagnostics. Review findings about non-B metadata reset and environment persistence were corrected.
- Indicator VM checks passed total/unseen separation, zero/no numeric zero, loading/error em dash, seen acknowledgement preserving count, B Overview gating and ordinary Details retaining unseen state.
- Final focused VM checks passed Production/TenDev title/config selection, locked variant, selector URL persistence, unchanged navigation route, non-B icon reset and update semantics. Exact flag-string checks passed.
- HTTP returned 200 with correct content types for the prototype, branding-config.js, branding.js, header images and corresponding icon files. Served header asset hashes matched source bytes.
- Actual browser review observed Production/light desktop and its title/icon; TenDev/dark desktop and mobile; TenDev/light mobile; compact development identity; always-visible zero-update icon; positive count with blue unseen dot; direct Job Updates tab opening; then dot cleared while total stayed 1. No whole-app or live backend validation is implied.
- `git diff --check` passed. Accepted src/public/package inputs remain identical to baseline `615026369bd8443888c903f47f7be8ffe60eb745`; only untracked design-review/ is present. No commit, push or deployment occurred.

### Remaining Risks

No missing current-source header asset was found. Personalized pre-sanitization artwork remains deliberately unavailable and was not replaced/reconstructed by this work. Browser review covered representative combinations, not every device/font/role. Actual backend unseen-state acknowledgement, live notification delivery, permissions, authentication and full PWA behavior were not exercised. The source's overlay dimension mismatch remains unchanged.

### Review URL and Source Status

**http://127.0.0.1:4176/?design=b&environment=production** — port **4176**. Environment selector switches to TenDev; `environment=tendev` is also supported. Refresh an existing tab to load the additional branding script.

Worktree `C:\Users\chris\source\repos\tenarten\tenops-ui-modernization`; branch `design/ui-modernization`; unchanged HEAD `615026369bd8443888c903f47f7be8ffe60eb745`. Accepted application and original dev checkout preserved. Stop for Product review.

### Recommended Commit

Subject: `[CF-Pages-Skip] [skip ci] Preserve branding and Job Update indicators in design review`

## Focused Product revision — Overview hitbox and Inspector wording

### Original interaction versus corrected prototype

Accepted `src/modules/production/components/ProductionQueue.tsx:86-96` places a native transparent primary button over the positioned Overview article. Presentation content sits above with pointer events disabled; independent controls restore pointer events (`ActivityStrip.tsx:42-56`). The primary selection passes the existing readiness-derived focus hint (`ProductionQueue.tsx:77`, `:92`); Updates/Files pass their own Inspector section focus.

Previously, the prototype primarily opened jobs through title or trailing-chevron buttons. B Overview now places one native primary button across each desktop row and mobile card while Updates/Files remain separate sibling controls above it. Desktop keeps valid table structure: the primary button lives inside the first td, anchored to the positioned row; the cell stays unpositioned. Mobile puts the button first inside its positioned article. Title and chevron become presentation within the primary target, removing redundant keyboard stops. Both use an inset visible focus outline and native Enter/Space activation. No parent row/card onclick, custom keyboard emulation, nested interactive elements or selection workflow was added. Primary activation still calls the prototype's existing openJob helper; its prior default-Details behavior is retained rather than expanding the source readiness-focus approximation. Dense Table/Timeline and A/C/Before remain outside this hitbox change.

### Exact meaning and source of “locally”

The word was introduced by the design prototype in app.js to describe changes to in-memory synthetic arrays and state. Job/status/update/schedule data resets on reload; only existing namespaced visual/calendar preferences persist. It did not signify a durable browser/offline save and is not the accepted Production Inspector's staged-state terminology.

Accepted source uses Save changes / Discard and explicit state wording: unsaved fields, Changes saved, Schedule changes pending, No unsaved changes (`ProductionJobInspector.tsx:1504-1510`). Dates remain staged until Save All succeeds (`:1012-1018`); the workspace uses Review changes / Discard all / Save all changes (`ProductionWorkspace.tsx:1196-1198`). Post update is the accepted update action (`JobUpdatesPanel.tsx:935`).

### Final employee-facing wording

| Previous prototype wording | Final wording / condition |
|---|---|
| Save details locally / Save locally | Save changes |
| Change status locally / Change local status | Change status |
| Post locally / Write a local review update… | Post update / Write a job update… |
| Approve locally | Save all changes; existing confirmation form/handler retained |
| Session only beside ordinary detail save | Editing details, only while edit mode is active |
| Saved dates…approved locally | Changes not yet saved. Review the proposed dates before saving. Only rendered when staged proposals exist |
| Dates staged locally. Review before approval. | Schedule changes pending. Review before saving. |
| Local schedule batch approved. No backend writes. | Schedule changes saved, after fixture mutation completes |
| Job details saved in this review session. | Job details saved |
| Update added locally. | Update posted |
| Local preview job link | Job link |
| Discard local edits? | Discard changes? Existing confirmation behavior retained |

Merely opening Edit details does not prove a field differs. Therefore it is labeled Editing details, not Unsaved changes. Actual staged date proposals are a genuine unsaved state and get Changes not yet saved. No dirty-calculation, save, staging, confirmation or persistence semantics were changed. The synthetic/reset/backend caveat is explicit in the external design toolbar and Review guide, outside employee-facing Inspector controls.

### Files Modified

`design-review/app.js`, `styles.css`, `index.html`, `README.md`, `ASSESSMENT.md`. No accepted application files were changed.

### Behavioral Changes

Only B Overview's primary click/touch area is enlarged to the source interaction model. Updates/Files retain direct section navigation and count/unseen semantics. Employee labels distinguish edit mode, pending schedules and completed saves without prototype-only “locally” wording. Modern Operations styling, authentic Production/TenDev branding, accepted navigation, Inspector hierarchy and comparison controls remain.

### Architectural Changes

Small prototype-only render helpers produce primary hitbox, title and chevron markup. Existing delegated action routing/openJob is reused. Each row/card has an isolated stacking context, transparent primary overlay and independent shortcut controls. No production abstraction or new persistence layer.

### Database / Schema Changes

No database changes.

### Validation

- JavaScript syntax and CSS parsing passed.
- Independent read-only review and 16 bounded Node VM/markup assertions passed: one primary native target plus Updates/Files, no nested controls, no ancestor row handler, independent single activation, correct stacking/pointer treatment, B Overview gating, unchanged dense Table/A/C behavior and no branding/navigation coupling.
- Focused state/label checks passed: Details retains unseen; employee Production labels omit locally; Editing details does not falsely announce dirty fields; staged proposals show Changes not yet saved; staging leaves saved dates untouched; the unchanged confirmation handler applies and clears proposals; success labels appear after mutations.
- Browser check clicked the desktop Planned Finish cell for Juniper Library, away from its title, and observed the same Details Inspector. The date-cell click verified the positioned table-row overlay geometry in Chrome. Updated Change status / Stage dates labels and branded header remained visible.
- Keyboard runtime review was interrupted by detected user input; native focus painting/restoration, physical Enter/Space and mobile touch were not fully verified. Their native-button markup/source model was inspected. No broad regression campaign was run.
- HTTP 200 confirmed for the updated review. git diff --check passed; accepted src/public/package inputs remain identical to baseline `615026369bd8443888c903f47f7be8ffe60eb745`. Only `?? design-review/` is present.

### Remaining Risks

Native keyboard/focus and mobile touch should receive a brief Product review. The static prototype retains its existing default Details entry rather than implementing all readiness-specific initial field focus. Fixture changes remain in-memory, and no backend save, concurrent update or real notification behavior was exercised.

### Review URL and Source Status

**http://127.0.0.1:4176/?design=b&environment=production** — port **4176**. Refresh an existing tab to load the new hitbox/CSS. Existing Environment, theme, viewport, role and A/B/C controls remain available.

Worktree `C:\Users\chris\source\repos\tenarten\tenops-ui-modernization`; branch `design/ui-modernization`; unchanged HEAD `615026369bd8443888c903f47f7be8ffe60eb745`. No commit, push, deployment, backend or accepted application modification. Stop for Product review.

### Recommended Commit

Subject: `[CF-Pages-Skip] [skip ci] Restore Overview hitboxes and refine Inspector labels`


## Comprehensive icon audit of represented review roles

This inventory audits **109 distinct icon role/context rows**, not 109 SVG assets. A role is an employee action, state marker, source text-only treatment, or explicitly identified prototype decoration. Repeated fixture rows, calendar days, appearances and devices do not multiply the count. Production's submenu Factory and mobile Jobs Factory are one destination role; the persistent Messaging launcher is counted once across desktop/mobile. Different source identities for desktop My Work and mobile My Work are separate contexts. Rows 1-107 cover selected B and shared review controls; rows 108-109 identify comparison-only roles.

The classification records the **original treatment before this icon-restoration task**. **Correct** means the existing identity/treatment matched; **Styling-only** means the same icon family or CSS semantic treatment was present but geometry, sizing or stroke needed normalization; **Incorrect substitution** means a different glyph, custom identity, or an icon where the source is text-only; **Missing** means a source glyph was absent from an already represented function; **Prototype-only** means no equivalent accepted role exists in that form. These are historical classifications, not a list of remaining defects. The final-treatment column describes current B. Source paths below are relative to the isolated worktree.

| Role group | Correct | Styling-only | Incorrect substitution | Missing | Prototype-only | Role rows |
|---|---:|---:|---:|---:|---:|---:|
| Shell and communication | 5 | 10 | 11 | 7 | 0 | 33 |
| Production and Monthly Workload | 9 | 8 | 12 | 9 | 4 | 42 |
| My Work and Task Inspector | 3 | 3 | 9 | 7 | 3 | 25 |
| Prototype and comparison roles | 0 | 0 | 0 | 0 | 9 | 9 |
| **Total** | **17** | **21** | **32** | **23** | **16** | **109** |

The selected-B renderer uses a frozen registry of **51 SVG keys (44 Lucide and 7 custom source renderings)**. Registry keys, distinct glyph identities and audited role contexts are different counts: one glyph serves several roles, aliases can share geometry, and text/CSS roles require no SVG. Source-owned custom artwork stays source-owned. A/C and Before retain their historical hand-drawn comparison artwork and are not asserted to have source-correct iconography; Before remains a reconstruction, not authority.


### Shell and communication (33 roles)

| # | Role / context | Original classification | Source icon / treatment | Final selected-B treatment | Source reference |
|---:|---|---|---|---|---|
| 1 | Dashboard navigation | Incorrect substitution | Custom HomeIcon | Exact source SVG, including 9.5px wall junction. | `src/app/client-layout-shell.tsx:122` |
| 2 | Reporting navigation | Incorrect substitution | Custom LaborIcon | Replace chart with source people/plus mark. | `src/app/client-layout-shell.tsx:76` |
| 3 | Inventory navigation | Styling-only | Custom PackageIcon | Keep source box geometry; normalize source stroke. | `src/app/client-layout-shell.tsx:109` |
| 4 | Production destination / mobile Jobs | Styling-only | Factory | Use exact Lucide Factory for both occurrences; one destination role. | `src/app/client-layout-shell.tsx:73`; `src/components/mobile/MobileNavigation.tsx:42` |
| 5 | Intake destination | Styling-only | IntakeIcon → Inbox | Use exact Inbox rather than square tray approximation. | `src/components/primary-navigation-icons.tsx:3` |
| 6 | Desktop My Work navigation | Incorrect substitution | Custom MyWorkIcon | Restore outlined checklist-document artwork. | `src/components/primary-navigation-icons.tsx:5` |
| 7 | Domain menu chevrons | Styling-only | Custom ChevronDownIcon | Restore exact source SVG; rotation remains presentation state. | `src/app/client-layout-shell.tsx:95` |
| 8 | My Work split-menu chevron | Styling-only | Custom ChevronDownIcon | Use the same source chevron on its existing split control. | `src/app/client-layout-shell.tsx:278` |
| 9 | My Work menu section caption | Missing | Custom MyWorkIcon | Add source caption mark. | `src/app/client-layout-shell.tsx:262` |
| 10 | Tools menu section caption | Missing | Hammer | Add source caption icon. | `src/app/client-layout-shell.tsx:262` |
| 11 | Resources menu section caption | Missing | BookOpen | Add source caption icon. | `src/app/client-layout-shell.tsx:262` |
| 12 | Contacts in shell menu | Correct | Text only | Keep text only; standalone Toolbox ContactRound does not apply here. | `src/app/client-layout-shell.tsx:265` |
| 13 | Other plain destination links / More list | Correct | Text only unless source item explicitly supplies icon | Keep source item-specific treatment; no invented universal menu glyph. | `src/app/client-layout-shell.tsx:225`; `src/components/mobile/MobileNavigation.tsx:32` |
| 14 | Account identity | Correct | Initials and role text | Retain synthetic initials/role, not an avatar glyph substitution. | `src/app/client-layout-shell.tsx:529` |
| 15 | Account Settings action | Correct | Text only | Keep text only. | `src/app/client-layout-shell.tsx:541` |
| 16 | Sign out action | Correct | Text only | Keep text only. | `src/app/client-layout-shell.tsx:542` |
| 17 | Persistent Messaging launcher | Incorrect substitution | Send | Replace envelope with exact Send; desktop/mobile remain one instance. | `src/components/GlobalMessaging.tsx:160` |
| 18 | Messaging menu chevron | Styling-only | ChevronDown | Normalize exact geometry and stroke. | `src/components/GlobalMessaging.tsx:161` |
| 19 | Recent messages caption | Missing | Inbox | Add source caption icon. | `src/components/GlobalMessaging.tsx:162` |
| 20 | Global TenBot launcher | Incorrect substitution | Custom TenbotAvatar | Restore source artwork, colors, viewBox and stroke ownership. | `src/components/GlobalTenbot.tsx:39` |
| 21 | TenBot entry in Messaging menu | Incorrect substitution | Custom TenbotAvatar | Replace robot with the source avatar. | `src/components/GlobalMessaging.tsx:162` |
| 22 | TenBot scripted workspace avatar | Incorrect substitution | Custom TenbotAvatar | Use source avatar; scripted workspace remains an approximation. | `src/modules/tenbot/GlobalTenbotWorkspace.tsx:133` |
| 23 | TenBot conversation avatar | Incorrect substitution | Custom TenbotAvatar | Replace TB initials with source artwork. | `src/modules/my-work/InboxDialog.tsx:248` |
| 24 | Notifications launcher | Styling-only | Bell | Use exact source Bell geometry. | `src/components/AccountNotifications.tsx:371` |
| 25 | Shared-task notification row | Missing | UserRoundCheck | Add source notification-type icon to represented row. | `src/components/AccountNotifications.tsx:318` |
| 26 | Mobile My Work tab | Incorrect substitution | ListTodo | Restore ListTodo; intentionally differs from desktop custom MyWorkIcon. | `src/components/mobile/MobileNavigation.tsx:43` |
| 27 | Mobile More tab | Incorrect substitution | Menu | Replace ellipsis with source Menu. | `src/components/mobile/MobileNavigation.tsx:45` |
| 28 | More sheet close | Styling-only | X | Use exact X; keep accessible Close More label. | `src/components/mobile/MobileNavigation.tsx:31` |
| 29 | Collapsed message sidebar expand | Incorrect substitution | Send | Replace envelope with source Send. | `src/components/GlobalMessaging.tsx:164` |
| 30 | Messaging workspace heading | Missing | Inbox | Add source Inbox to represented Messaging heading. | `src/modules/my-work/InboxDialog.tsx:239` |
| 31 | Messaging attachment action | Styling-only | Paperclip | Use exact source Paperclip on existing demonstration action. | `src/modules/my-work/InboxDialog.tsx:269` |
| 32 | Messaging Send action | Missing | Send | Add source Send to existing submit button. | `src/modules/my-work/InboxDialog.tsx:236` |
| 33 | Messaging dialog close | Styling-only | X | Use exact X and preserve accessible name. | `src/modules/my-work/InboxDialog.tsx:239` |

### Production and Monthly Workload (42 roles)

| # | Role / context | Original classification | Source icon / treatment | Final selected-B treatment | Source reference |
|---:|---|---|---|---|---|
| 34 | New Job entry | Styling-only | Plus | Normalize exact Plus on existing Add job action. | `src/modules/production/ProductionWorkspace.tsx:1007` |
| 35 | Create Job confirmation | Missing | Plus | Add Plus to existing Create Job submit. | `src/modules/production/components/ProductionJobCreator.tsx:317` |
| 36 | Monthly Snapshot tab | Missing | Camera | Add source Camera; keep source small-screen visibility rule. | `src/modules/production/ProductionWorkspace.tsx:986` |
| 37 | Monthly Workload disclosure | Styling-only | ChevronDown, rotated when collapsed | Use one exact Down glyph and rotation, not a separate right-arrow design. | `src/modules/production/components/MonthlyWorkload.tsx:152` |
| 38 | Previous month | Styling-only | ChevronLeft | Use exact source geometry. | `src/modules/production/components/MonthlyWorkload.tsx:193` |
| 39 | Next month | Styling-only | ChevronRight | Use exact source geometry. | `src/modules/production/components/MonthlyWorkload.tsx:195` |
| 40 | On Hold calendar bar | Missing | Pause | Add Pause next to job label; preserve status pattern. | `src/modules/production/components/MonthlyWorkload.tsx:222` |
| 41 | Open calendar task | Incorrect substitution | ListTodo | Replace Unicode checkbox/CSS stand-in with source glyph. | `src/modules/production/components/MonthlyWorkload.tsx:227` |
| 42 | Completed calendar task | Incorrect substitution | Check | Replace font-dependent check with source Check; retain completed text/strike. | `src/modules/production/components/MonthlyWorkload.tsx:227` |
| 43 | Overdue calendar task | Missing | Clock3 | Add Clock3 with existing overdue wording. | `src/modules/production/components/MonthlyWorkload.tsx:227` |
| 44 | Open task in daily overflow | Missing | ListTodo | Add source task glyph beside existing row. | `src/modules/production/components/MonthlyWorkload.tsx:249` |
| 45 | Completed task in daily overflow | Missing | Check | Use Check, independent of Production status. | `src/modules/production/components/MonthlyWorkload.tsx:249` |
| 46 | Daily overflow count | Correct | Text +N, not an icon | Retain textual count. | `src/modules/production/components/MonthlyWorkload.tsx:212` |
| 47 | Daily-list close | Styling-only | X | Use source X in existing utility close surface. | `src/modules/production/components/MonthlyWorkload.tsx:240` |
| 48 | Overview Job Updates indicator | Correct | MessageSquare | Existing explicit path matches source; preserve total/count separator. | `src/modules/production/components/JobUpdatesIndicator.tsx:50` |
| 49 | Job Updates unseen marker | Correct | CSS blue dot | Keep separate boolean marker, not an unread count or new icon. | `src/modules/production/components/JobUpdatesIndicator.tsx:51` |
| 50 | Overview Files shortcut | Styling-only | Paperclip | Normalize exact Paperclip; keep zero/count/section semantics. | `src/modules/production/components/ActivityStrip.tsx:62` |
| 51 | Overview missing-date warning | Missing | AlertTriangle | Add source warning beside existing Needs Dates state. | `src/modules/production/components/ProductionQueue.tsx:142` |
| 52 | Table Columns control | Incorrect substitution | Settings2 | Replace ellipsis with source Settings2; never classify this as text-only. | `src/modules/production/components/ProductionTable.tsx:895` |
| 53 | Pipeline search decoration | Incorrect substitution | Text-only search field | Remove B magnifier; source search input does not use a leading icon. | `src/modules/production/ProductionWorkspace.tsx:1046` |
| 54 | Dense Table Inspector action | Incorrect substitution | Search | Restore Search rather than right chevron. | `src/modules/production/components/ProductionTable.tsx:1041` |
| 55 | Overview trailing open chevron | Prototype-only | No source trailing glyph | Retain decorative ChevronRight as prototype affordance; source parity is the row hitbox. | `src/modules/production/components/ProductionQueue.tsx:92` |
| 56 | Production status decoration | Styling-only | CSS colors/patterns and text; no status icon | Keep proposed stable-label swatch treatment; shared status meanings remain authoritative. | `src/modules/production/components/ProductionStatusBadge.tsx:19` |
| 57 | Material readiness decoration | Styling-only | Text/color treatment; no material icon | Keep proposed CSS dot with explicit label; do not treat it as a source icon. | `src/modules/production/material-status.ts:15` |
| 58 | Production Inspector Share | Incorrect substitution | Share2 | Replace upward-upload glyph with connected-circle Share2. | `src/modules/production/components/ProductionJobShare.tsx:75` |
| 59 | Copy Job link | Incorrect substitution | Copy | Replace chain-link glyph with source Copy. | `src/modules/production/components/ProductionJobShare.tsx:78` |
| 60 | Send Job in Messaging | Incorrect substitution | Send | Replace envelope with Send; draft handoff unchanged. | `src/modules/production/components/ProductionJobShare.tsx:79` |
| 61 | Production file row | Incorrect substitution | File | Replace text-lined document with blank folded File. | `src/modules/production/components/ProductionJobInspector.tsx:1360` |
| 62 | Production Add Attachment | Incorrect substitution | Upload | Replace Plus with Upload on represented file demonstration. | `src/modules/production/components/ProductionJobInspector.tsx:1316` |
| 63 | View linked tasks | Incorrect substitution | ClipboardList | Replace generic task/checklist glyph with ClipboardList. | `src/modules/production/components/ProductionJobInspector.tsx:985` |
| 64 | Post Job Update | Missing | MessageSquare | Add MessageSquare to existing Post update action. | `src/modules/production/components/JobUpdatesPanel.tsx:934` |
| 65 | Recent Changes panel heading | Missing | History | Add History on panel heading, not its text-only tab. | `src/components/inspector/ActivityHistory.tsx:11`; `src/modules/production/components/ProductionJobInspector.tsx:1495` |
| 66 | Production Inspector tabs | Correct | Text only | Keep Details/Planning/Updates/Files/Recent Changes labels text-only. | `src/modules/production/components/ProductionJobInspector.tsx:758` |
| 67 | Production Inspector close | Incorrect substitution | Back on phone / Close on desktop, text only | Remove B X; preserve existing close action. | `src/modules/production/components/ProductionJobInspector.tsx:878` |
| 68 | Bulk Edit details mode | Prototype-only | Source uses editable fields and a separate inline Pencil name editor | Keep prototype bulk-edit action text-only; do not imply inline Pencil workflow is reproduced. | `src/modules/production/components/ProductionJobInspector.tsx:845` |
| 69 | Ordinary Save changes | Correct | Text only | Keep text-only action and actual save-state wording. | `src/modules/production/components/ProductionJobInspector.tsx:1510` |
| 70 | Discard ordinary edits | Correct | Text only | Keep text-only action. | `src/modules/production/components/ProductionJobInspector.tsx:1509` |
| 71 | Status editing controls | Correct | Native selects / text labels, no icon | Keep text-only Change status/Save changes and native selector affordances. | `src/modules/production/components/ProductionJobInspector.tsx:1072` |
| 72 | Review / discard schedules | Correct | Text-only review/revert/discard controls | Keep existing actions text-only. | `src/modules/production/components/ScheduleReviewDialog.tsx:38`; `src/modules/production/ProductionWorkspace.tsx:1196` |
| 73 | Save all schedule changes | Correct | Text only | Keep final submit text-only; no invented save/check glyph. | `src/modules/production/ProductionWorkspace.tsx:1198` |
| 74 | Stage dates button decoration | Prototype-only | No source button: date changes stage on edit | Remove B Calendar decoration; retain documented prototype staging interaction. | `src/modules/production/components/ProductionJobInspector.tsx:654` |
| 75 | Pending schedule banner decoration | Prototype-only | Text-only action bar | Remove B Calendar decoration; pending/save behavior unchanged. | `src/modules/production/ProductionWorkspace.tsx:1180` |

### My Work and Task Inspector (25 roles)

| # | Role / context | Original classification | Source icon / treatment | Final selected-B treatment | Source reference |
|---:|---|---|---|---|---|
| 76 | Add task entry | Styling-only | Plus at source composer entry | Use exact Plus on represented Add task entry; composer layout remains approximate. | `src/modules/my-work/MyWorkPage.tsx:320` |
| 77 | Today view | Incorrect substitution | CalendarCheck | Replace Sun with source CalendarCheck. | `src/modules/my-work/MyWorkPage.tsx:314` |
| 78 | All Tasks view | Incorrect substitution | Text only | Remove invented checklist glyph in B. | `src/modules/my-work/MyWorkPage.tsx:314` |
| 79 | My Tasks view | Incorrect substitution | Custom PrivateTaskIcon | Replace generic task icon with source lock/check identity. | `src/modules/my-work/MyWorkPage.tsx:63`; `src/modules/my-work/MyWorkPage.tsx:314` |
| 80 | Shared Tasks view | Incorrect substitution | Handshake | Replace generic task icon with Handshake. | `src/modules/my-work/MyWorkPage.tsx:314` |
| 81 | Completed view marker | Prototype-only | Source completed section is a disclosure, not this additional tab | Remove decorative Check in B; retain documented prototype view. | `src/modules/my-work/MyWorkPage.tsx:342` |
| 82 | Task-group sidebar filter dots | Prototype-only | No source sidebar-filter counterpart | Retain synthetic group-color dots; do not claim Folder tab parity. | `src/modules/my-work/MyWorkPage.tsx:290`; `src/modules/my-work/MyWorkPage.tsx:312` |
| 83 | Workload review button decoration | Prototype-only | Source Workload is a ChevronDown/ChevronRight disclosure | Remove prototype Clock in B; do not invent a disclosure workflow. | `src/modules/my-work/MyWorkPage.tsx:339` |
| 84 | Task-row completion | Styling-only | CSS empty circle / SVG Check when complete | Preserve source state distinction with exact Check geometry. | `src/modules/my-work/MyWorkPage.tsx:286` |
| 85 | Task-row linked Job metadata | Missing | BriefcaseBusiness | Add source Job metadata mark. | `src/modules/my-work/MyWorkPage.tsx:291` |
| 86 | Task-row file count | Missing | Paperclip | Add source file metadata icon. | `src/modules/my-work/MyWorkPage.tsx:294` |
| 87 | Task-row due date | Missing | CalendarDays | Add source date metadata icon. | `src/modules/my-work/MyWorkPage.tsx:297` |
| 88 | Task-row estimated time | Missing | Clock3 | Add source effort metadata icon. | `src/modules/my-work/MyWorkPage.tsx:293` |
| 89 | Task-row shared visibility | Missing | Handshake | Add source shared identity. | `src/modules/my-work/MyWorkPage.tsx:292` |
| 90 | Task-row private visibility | Missing | Custom PrivateTaskIcon | Add source private identity; retain custom geometry. | `src/modules/my-work/MyWorkPage.tsx:292` |
| 91 | Task-row group metadata | Incorrect substitution | Folder with personal group color | Replace generic colored dot with source Folder treatment. | `src/modules/my-work/MyWorkPage.tsx:290` |
| 92 | Task Inspector close | Styling-only | X | Use exact source X. | `src/modules/my-work/MyWorkTaskInspector.tsx:60` |
| 93 | Task Inspector Open linked Job | Incorrect substitution | BriefcaseBusiness | Replace Link chain with BriefcaseBusiness. | `src/modules/my-work/MyWorkTaskInspector.tsx:66` |
| 94 | Task-color explanation | Missing | Info | Add source Info; group-color precedence remains unchanged. | `src/modules/my-work/MyWorkTaskInspector.tsx:68` |
| 95 | Task attachment row | Incorrect substitution | Paperclip | Replace document glyph with Paperclip; omit icon for empty attachment placeholder. | `src/modules/my-work/task-controls.tsx:42` |
| 96 | Task Add attachments | Incorrect substitution | Upload | Replace Paperclip action glyph with Upload. | `src/modules/my-work/task-controls.tsx:37` |
| 97 | Task Inspector field labels | Correct | Text only | Keep Title/Notes/Due/Estimated/Share/Job/Group/Attachments labels text-only; composer icons do not apply. | `src/modules/my-work/MyWorkTaskInspector.tsx:62` |
| 98 | Task Inspector completion footer | Incorrect substitution | Text only | Remove B Check from Mark complete/Reopen footer; row Check remains. | `src/modules/my-work/MyWorkTaskInspector.tsx:72` |
| 99 | Task Inspector Save footer | Correct | Text only | Keep text only. | `src/modules/my-work/MyWorkTaskInspector.tsx:72` |
| 100 | Task Inspector Cancel footer | Correct | Text only | Keep text only. | `src/modules/my-work/MyWorkTaskInspector.tsx:72` |

### Prototype and comparison roles (9 roles)

| # | Role / context | Original classification | Source icon / treatment | Final selected-B treatment | Source reference |
|---:|---|---|---|---|---|
| 101 | Active jobs metric | Prototype-only | No accepted metric-icon counterpart | Retain Factory on proposed metric. | `design-review/app.js:28`; `src/modules/production/ProductionWorkspace.tsx:1154` |
| 102 | Material attention metric | Prototype-only | No accepted metric-icon counterpart | Retain Flag on proposed metric; not a source follow-up-count claim. | `design-review/app.js:28` |
| 103 | Delivery this week metric | Prototype-only | No accepted metric-icon counterpart | Retain CalendarDays on proposed metric. | `design-review/app.js:28` |
| 104 | Estimated labor metric | Prototype-only | No accepted metric-icon counterpart | Retain Clock3 on proposed metric. | `design-review/app.js:28` |
| 105 | Review switch to Dark | Prototype-only | Design-review control, not employee app action | Retain Moon in review toolbar. | `design-review/app.js:25` |
| 106 | Review switch to Light | Prototype-only | Design-review control, not employee app action | Retain Sun in review toolbar. | `design-review/app.js:25` |
| 107 | Generic review-dialog close | Prototype-only | Review container added around share/status/schedule demonstrations | Retain X on review-only utility chrome; source-specific closes are audited separately. | `design-review/app.js:24` |
| 108 | A/C/Before standalone Toolbox placement | Prototype-only | Standalone ToolboxLauncher uses ToolCase; shell tools live in My Work menu | Keep historical Wrench in comparison directions; B does not claim it as source-correct. | `src/components/ToolboxLauncher.tsx:42`; `design-review/app.js:27` |
| 109 | A/C/Before Review guide navigation | Prototype-only | No accepted employee navigation destination | Keep historical Flag in comparison-only navigation. | `design-review/app.js:27` |

### Source controls and domains outside the rendered review (13 excluded families)

The **13 families E01-E13 below are excluded from the 109 represented-role denominator**. The inventory names source glyphs to preserve during eventual implementation; it does not count each unrendered control as a prototype defect or claim full workspace parity. Glyphs can recur across families, so these are source-control families, not another distinct-SVG total. Navigation destinations and permission visibility are reviewed separately from their unimplemented operational workspaces.

| Excluded family | Source icon inventory and boundary | Source references |
|---|---|---|
| E01 - Full Production toolbar / attention / Timeline controls | ListFilter; spinning RotateCw during refresh; AlertTriangle, Flag and disclosure ChevronUp/Down; Timeline Minus/Plus and LocateFixed. The review renders a bounded weekly preview, not these complete interaction/control states. | `src/modules/production/ProductionWorkspace.tsx:1070`, `:1134`, `:1149`, `:1173`; `src/modules/production/components/ProductionGantt.tsx:989`, `:998` |
| E02 - Inspector actions not implemented | Inline project-name Pencil; eligible Create Rework RotateCcw; document actions Send/ClipboardList; attachment removal Trash2. Do not add ornamental controls suggesting unavailable workflows. The represented linked-task ClipboardList and file Upload/File are already in rows above. | `src/modules/production/components/ProductionJobInspector.tsx:809`, `:855`, `:969`, `:981`, `:1408`; `src/modules/production/components/ReworkQuickAction.tsx:45` |
| E03 - Full Job Update management | Flag follow-up, CheckCircle2 resolution, Pencil edit, Trash2 delete, File attachment rows and Paperclip attachment actions. The prototype represents the conversation, count/unseen indicator and posting demonstration; it does not implement these management states. | `src/modules/production/components/JobUpdatesPanel.tsx:570`, `:647`, `:669`, `:679`, `:745`, `:833`, `:912` |
| E04 - Planning schedule feedback | Check for staged Planning changes; CircleX for errors and AlertTriangle for warnings. No source Planning calculation/error engine or phase editor is reconstructed. | `src/modules/production/components/ScheduleReviewDialog.tsx:40`, `:41` |
| E05 - Intake / Bids | BidWorkspace imports Archive, BriefcaseBusiness, Camera, ChevronRight, File, MessageSquare, Plus, Trash2, Upload, UserRound and X. BidTools adds FileText, FlaskConical and FolderOpen. Main Bid Inspector close is text Back/Close. Destination summaries do not implement this workspace. | `src/modules/pre-production/BidWorkspace.tsx:11`, `:108`, `:118`, `:124`, `:132`, `:148`, `:149`, `:153`; `src/modules/pre-production/BidTools.tsx:3` |
| E06 - Inventory / Pending Receivals / Activity | Inventory owns custom RefreshIcon, PlusIcon and ChevronRightIcon; Pending Receivals owns a rotating inline chevron. Receive, Undo and bulk confirmation are text actions. Activity has no separate imported Lucide/custom-SVG inventory. The review supplies destination context only. | `src/app/inventory/page.tsx:135`, `:146`, `:155`, `:2326`, `:3601`, `:3610`, `:3698`, `:3770`; `src/app/activity/page.tsx` |
| E07 - Manpower / analytics / Material Usage | Manpower uses ChevronDown/Right, Pencil, Plus, RotateCw, Search and Settings2; product category management adds GripVertical and MoreHorizontal. Material Usage editor owns custom SearchIcon, ChevronDownIcon, LinkIcon and TemporaryIcon (pencil geometry). These operational workspaces are destination summaries, not redesigned implementations. | `src/modules/manpower/ManpowerWorkspace.tsx:5`, `:200`, `:1126`, `:1169`; `src/modules/manpower/ManpowerAnalytics.tsx:5`; `src/modules/manpower/ProductCategoryManager.tsx:5`; `src/modules/material-usage/MaterialUsageEditor.tsx:95`, `:104`, `:112`, `:121` |
| E08 - Other My Work controls | Quick-action MoreHorizontal, sort ArrowUpDown, group manager Folder, Workload/Completed disclosure ChevronDown/Right, and the full composer/quick-edit controls are outside the bounded table/Inspector reproduction. Source composer field icons must not be copied onto text-only Inspector labels. | `src/modules/my-work/MyWorkPage.tsx:298`, `:312`, `:323`, `:339`, `:340`, `:342` |
| E09 - Full Messaging controls | New-message MessageSquarePlus, mobile Back ArrowLeft, conversation ChevronDown, FileText file cards, queued Paperclip/removal Trash2 and message-action MoreHorizontal are unimplemented. The represented Send/Paperclip/Inbox and closes are already counted above. | `src/modules/my-work/InboxDialog.tsx:3`, `:37`, `:245`, `:248`, `:265` |
| E10 - Other personal notification types / onboarding | Welcome/feature Sparkles; mention AtSign; message MessageSquare; announcement MyWorkIcon/Send/Inbox; Open Welcome ArrowRight; welcome explainer Bell/AtSign/MessageSquare/AlertTriangle. B represents a synthetic shared-task row only; it does not imply notification delivery or these additional states. | `src/components/AccountNotifications.tsx:318`, `:327`, `:329`, `:344` |
| E11 - Full TenBot workspace | Maximize2/Minimize2 expand/collapse and Send composer action are source controls not implemented by the scripted-question modal. TenbotAvatar identity is preserved across represented entry points, but that does not reproduce the full runtime. | `src/modules/tenbot/GlobalTenbotWorkspace.tsx:136`, `:151` |
| E12 - Document preview controls | ChevronLeft/Right, Download, Expand, ExternalLink, Minus, Plus, Printer and X belong to the actual viewer. Placeholder Preview buttons transfer no files and do not implement the viewer. | `src/components/documents/DocumentViewer.tsx:4` |
| E13 - Standalone Toolbox / document generators | Standalone Toolbox uses ToolCase, Hammer, BookOpen and ContactRound; shell menu Contacts is intentionally text-only. Samples use Copy, FileText, FlaskConical, Plus, Search, Trash2 and X; Purchasing has Settings2. PO, Proposal, Transmittal, Samples, Contacts and Catalog remain destination summaries rather than generator redesigns. Settings is only a preserved navigation destination; no Settings workspace audit is claimed. | `src/components/ToolboxLauncher.tsx:6`, `:42`, `:55`; `src/modules/samples/SampleWorkspace.tsx:25`; `src/modules/purchasing/PurchasingWorkspace.tsx:5` |

### State, accessibility and remaining identity decisions

Icon restoration is presentation-only: no state handler, business permission, persistence contract, action target or data semantics changed in this pass. Native controls keep their own browser affordances. Save/discard/status/Inspector-label actions remain text-only where source is text-only; Columns specifically remains Settings2. Text arrows in Recent Changes are value transitions, not missing icon glyphs.

Preserve the source contexts: Job Updates shows total updates separately from an employee-specific unseen dot; loading/error show an em dash without a count/dot. Share's Send action retains Messaging participation gating. Source Post update disables while posting or when author/body is missing; Add Attachment reflects upload/loading state. The prototype's synchronous fixtures do not prove these backend/loading workflows. Hover/focus/disabled treatments can change visually while glyph identity, accessible names and hit areas remain stable. Decorative SVGs use aria-hidden and focusable=false. The explicit missing-date warning uses an amber treatment in both appearances; it does not change Production status colors.

Two existing source identity inconsistencies remain deliberate: desktop My Work uses the custom document/check MyWorkIcon while mobile My Work uses Lucide ListTodo; Production's submenu and mobile Jobs repeat Factory. Preserve both conventions in this review. A future consolidation is a separate design-system decision, not permission to replace either icon now. Group sidebar dots and the Overview trailing chevron remain identified prototype proposals. Source artwork and installed Lucide definitions are available: no missing icon or branding asset was found for this scoped restoration, and no replacement artwork was generated.

### Icon-audit validation and limits

- Root validation reported successful JavaScript syntax, CSS parsing, conflict-marker and git diff --check checks.
- The exact inner SVG nodes of all 44 Lucide registry entries were compared byte-for-byte with installed lucide-react 1.7.0 rendered through ReactDOMServer. The seven custom renderings retain source provenance; TenBot preserves its artwork, colors and child stroke treatment.
- Root reported 17 focused Node VM assertions, plus an independent 13 assertion-group review exercising 45 registry keys across B views/Inspectors/Messaging/TenBot/navigation/guide without missing keys, runtime exceptions or undefined output. All 39 literal icon references resolve, and all 51 SVG entries have decorative accessibility attributes. These overlapping checks are not summed into a fabricated test-case total.
- HTTP 200 was reported for index, icons, app, navigation, styles and branding configuration. Accepted-source URLs remain unavailable through the review server (404). Accepted src/public/package inputs remain identical to baseline `615026369bd8443888c903f47f7be8ffe60eb745`; only the isolated design-review artifacts are untracked.
- **Updated visual verification is blocked:** the browser attempt stopped under URL-confidence policy. No final rendered icon/layout/hover/touch pass is claimed. The source and Node VM results do not establish pixel geometry, clipping, contrast at every size, physical keyboard interaction or mobile hardware behavior.
- This append changes only `design-review/ASSESSMENT.md`. No backend, database, migration, credentials, deployment or accepted application change is part of the icon audit. Final post-append status/diff inspection remains with the task owner.

### Icon-audit completion report

**Files Modified:** design-review/app.js, navigation.js, icons.js (new), styles.css, index.html, serve.mjs, README.md and ASSESSMENT.md. All task changes stay inside the existing isolated prototype.

**Behavioral Changes:** B restores exact source icon identities and missing represented indicators; source text-only controls lose invented glyphs. Modern Operations styling, Production/TenDev branding, navigation hierarchy, role fixtures, Job Update counts/unseen behavior, Overview hitboxes, Inspector actions and A/C comparisons remain. No event handler or fixture persistence semantics changed.

**Architectural Changes:** One static, frozen prototype SVG registry provides exact installed Lucide and source-custom artwork. A B-only dispatcher reuses it; historical comparison directions keep their prior artwork. The local server adds only the explicit icons.js asset route. No accepted application helper/component was modified.

**Database / Schema Changes:** No database changes.

**Validation:** Focused syntax, CSS parsing, source SVG comparisons, fixture/markup checks and HTTP serving checks passed as recorded above. No production build, repository-wide lint/type campaign or backend test was run. Updated browser visual verification stopped because Computer Use could not determine the browser URL with sufficient confidence to enforce policy; no updated visual pass is claimed.

**Remaining Risks:** Product still needs the desktop light/dark and phone visual pass. The existing fixture workflow limits remain: synchronous posting/files do not reproduce backend loading or real upload states; the restored Needs Dates warning is decorative alongside the represented state, without adding the source's direct Timeline scheduling shortcut. Full operational modules and controls listed E01-E13 remain unrendered. Source identity consistency decisions require separate approval.

**Review URL:** http://127.0.0.1:4176/?design=b&environment=production — refresh existing tabs. TenDev remains available through the Environment selector; theme, viewport, role and A/B/C comparisons remain available.

**Source Status:** isolated worktree C:\Users\chris\source\repos\tenarten\tenops-ui-modernization, branch design/ui-modernization, unchanged HEAD 615026369bd8443888c903f47f7be8ffe60eb745. Accepted src/public/package files match that baseline; status remains only ?? design-review/. Original checkout remains at d1f32ad6a816ade61420917361e952309288a482 with its pre-existing modified AGENTS.md untouched. No commit, push, deployment, backend or accepted application modification. Stop for Product review.

**Recommended Commit:** [CF-Pages-Skip] [skip ci] Restore source icon parity in Modern Operations prototype

## Production Pipeline summary placement

Product's requested operational strip is now immediately after Monthly Workload, as the first content inside the Production queue panel and before its view/search/filter controls and records. The prior prototype only had proposed KPI cards plus a displayed-job chip/footer; this pass restores the accepted strip in the requested position. The KPI cards remain above the calendar unchanged. B alone receives this change; Snapshot and A/C/Before comparisons keep their prior layouts.

Count authority: ProductionWorkspace.tsx:675-683,969-970,1147-1167 and readiness.ts → production-job-facts.mjs:23-43. Active Jobs excludes only Complete/Cancelled and includes Shipped. Scheduled requires both dates; Unscheduled means either missing. These readiness counts apply proposed dates and ignore queue/calendar filters. Need Attention counts jobs missing job number, customer, requested delivery or a null labor estimate, or having unresolved update follow-ups. It is not the material-attention KPI, update total or unseen count; it can overlap Unscheduled. Showing uses the existing filteredJobs result. The existing prototype's search/status/sort definitions are untouched, including its default nine-job active filter; therefore baseline summary values are 1 Unscheduled, 0 Need Attention, 10 Active Jobs, 9 Scheduled and 9 Showing. No follow-ups are inferred from synthetic updates.

### Files Modified

- design-review/app.js: read-only summary helpers, queue-panel placement and Showing refresh during existing incremental search rendering.
- design-review/styles.css: scoped B strip treatment, wrapping and three-column mobile totals.
- design-review/ASSESSMENT.md: this source/validation record.

### Behavioral Changes

The compact operational strip belongs to the queue surface below the calendar. The strip is present for Overview/Table/Timeline, absent from Snapshot, and remains visible when Monthly Workload is collapsed. Existing KPI cards, records, navigation, branding, icons, Job Update indicators and Inspector actions remain. This placement pass does not add the source Attention Center dropdown workflow; summary text is noninteractive and explains scope through native titles.

### Architectural Changes

Two small prototype-only render/count helpers mirror the bounded source predicates using current fixture field names. Showing consumes the existing filtered list. No sorting/filtering/Inspector function or business-state mutation changed; only the search rendering path also refreshes the strip. No accepted application abstraction or server change.

### Database / Schema Changes

No database changes.

### Validation

- Focused Chrome screenshots verified desktop dark, desktop light and mobile preview. The strip follows the calendar legend and precedes the queue heading/controls; mobile wraps attention and totals into readable rows without clipping the strip.
- Chrome search for Juniper changed Showing from 9 to 1 while Active Jobs 10, Scheduled 9, Unscheduled 1 and Need Attention 0 remained fixed. Clearing search restored Showing 9. The review was left in the light mobile preview with no search filter.
- 16 focused Node VM assertions passed: source baseline scope including Shipped, search/status filter relationships, Showing exceeding Active Jobs, proposed-date readiness without saved-date mutation, null versus zero labor, blank customer, unresolved follow-ups counted per job, unseen/material independence, all three queue view placements, Snapshot exclusion and A/C preservation.
- JavaScript syntax and CSS parsing passed. Updated app asset returned HTTP 200. Source inspection verified the existing metrics, filteredJobs, jobResults, Overview hitbox and Inspector functions were unchanged.
- git diff --check passed; accepted src/public/package inputs still match baseline 615026369bd8443888c903f47f7be8ffe60eb745. Only ?? design-review/ remains. No production build or broad regression campaign.

### Remaining Risks

The existing static fixture limitations remain; there is no live backend or Attention Center implementation. Phone layout was checked with the prototype viewport comparison, not physical mobile hardware. No new source discrepancy was silently corrected: summary Active Jobs intentionally includes Shipped even though the separate proposed KPI's active set does not.

### Review URL and Source Status

http://127.0.0.1:4176/?design=b&environment=production — refresh an existing tab. Same isolated worktree/branch and unchanged HEAD 615026369bd8443888c903f47f7be8ffe60eb745. No accepted application changes, commit, push, deployment or backend work. Stop for Product review.

### Recommended Commit

Subject: [CF-Pages-Skip] [skip ci] Place Pipeline summary below Monthly Workload
