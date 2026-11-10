# TenOps local design review

Product-selected Direction B now uses the accepted TenOps header, dropdown groups and mobile navigation. Open http://127.0.0.1:4176/?design=b.

This is an isolated, backend-free comparison prototype. Every job, task, customer, message, actor and record ID is synthetic. Accepted application files are unchanged.

## Launch

Requires the already installed Node.js; no package install or build is needed.

```powershell
Set-Location 'C:\Users\chris\source\repos\tenarten\tenops-ui-modernization'
node design-review/serve.mjs
```

Open **http://127.0.0.1:4176**. Exact default port: **4176**, bound to loopback only. If that port is occupied, the server fails clearly; choose a different port explicitly with `$env:TENOPS_DESIGN_PORT = '4177'`. Stop the server with Ctrl+C in its owning terminal. The review server started during this task is intentionally retained for Product review.

## Compare

- Use **A / B / C** at the top for Refined Enterprise, Modern Operations and Industrial Premium.
- **Before** applies a source-derived reconstruction to the same fixtures. It is not a screenshot or proof of authenticated behavior.
- Use **Dark / Light** to compare themes. Use **Mobile / Desktop** to switch the review frame. The phone calendar and dense task table retain horizontal scrolling; mobile job rows become readable cards.
- Direct visual links: `/?design=a&theme=light`, `/?design=b&theme=dark`, `/?design=c&theme=light`.
- Open **Review guide** for the scenario list and assessment link.

## Review scenarios

1. In Monthly Workload switch Jobs / My Tasks / Both, Active / On Deck / All Scheduled, density and month. Click a bar or a + overflow control. Collapse and reload to check the prototype preference.
2. Search the Pipeline. Its filters deliberately do not change Monthly Workload. Compare Overview, full Table and the illustrative Timeline.
3. Open a Job. Inspect Details, Planning, Job Updates, Files and Recent Changes. Edit ordinary details separately from dates.
4. Stage changed dates. Saved fixture dates remain unchanged until Review changes → Save all changes. Stage several jobs, navigate between screens, discard, or return a proposal to saved dates.
5. Share a Job. Copy its local preview link or prepare a Messaging draft. Sending remains a synthetic simulation, as stated in the design toolbar.
6. Open My Work. Compare Today / All Tasks / My Tasks / Shared Tasks / Completed and task groups. Edit a task, save, complete it and reopen it.
7. Open Messaging, Notifications and TenBot. TenBot uses scripted answers. No model or inference endpoint is called.
8. In Direction B, use Role fixture in the external design toolbar to compare Member, Lead, Guest, read-only Member with Messaging participation, and a signed-out shell. The account menu retains Settings / Sign out. These are synthetic fixtures, not account changes.

## Prototype scope and approximations

- Full interactive scope: representative Dashboard/Monthly Workload, job table, Job Inspector, My Work, Task Inspector and local sharing/schedule review.
- Illustrative scope: Snapshot arithmetic, Timeline, file controls, account permissions, Messaging/notifications and TenBot workspace. File controls show a notice; no documents or uploads exist.
- Other navigation entries open source-grounded destination summaries. Intake, Inventory and Reporting were audited in source, not rebuilt.
- All fixture edits are in memory and reset on reload. Only visual/calendar preferences persist under `tenops.design-review.v1`. Existing application preference keys are never used or modified. A synthetic reviewer cannot reproduce employee-scoped ownership behavior.
- Source job links use `/?open-production-job=<id>`. The prototype uses that query shape with deliberately synthetic IDs without extra reference parameters.
- B has no navigation rail or regrouped destinations. Other prototype proposals remain: dirty-close guard, new summary metrics, default table proportions and local minimal composers. These need review before adoption. They are not accepted app changes.
- Source calendar/task calculations, schedule conflicts/idempotency/RPCs, real permissions, uploads, realtime delivery, notification delivery, PDF generation and backend behavior are not implemented or verified here.

## Safety and preservation

The static server serves only an explicit allowlist of prototype files and documentation; it never serves `.env`, application source, node_modules or Git metadata. It accepts only GET/HEAD and binds `127.0.0.1`. Content Security Policy disables outbound connections. No remote fonts, images, scripts or APIs are required.

Worktree: `C:\Users\chris\source\repos\tenarten\tenops-ui-modernization`

Branch: `design/ui-modernization`

Baseline / unchanged HEAD: `615026369bd8443888c903f47f7be8ffe60eb745`

No commit, push, deployment, backend connection or Git synchronization was performed. The original `dev` checkout and its pre-existing AGENTS.md modification were preserved.

## Validation limits

See ASSESSMENT.md for checks actually completed. Browser automation did not reach the page: the in-app browser host was unavailable, and Windows automation stopped at its URL-confidence safeguard. No rendered visual QA, real-phone check, keyboard/focus runtime check, clipboard check or manual authenticated workflow testing is claimed.

Focused checks passed: Node syntax; CSS parser; HTTP serving/allowlist/method handling; a stubbed-DOM Node VM covering initialization, design/theme/frame variants, calendar/filter and staged schedule state, approval and preview-link shape. These do not validate browser layout or native dialog behavior. Accepted source/package inputs were verified unchanged against the requested baseline.

## Direction B navigation review

The accepted source, not Before, defines this revision. Desktop order: Dashboard → Reporting → Inventory → separator → My Work → TenBot → Messaging → Notifications → Account. Domain labels are direct links with hover/focus dropdowns; My Work and Messaging retain separate chevrons. My Work contains My Work / Tools / Resources sections. Daily Production is disabled on desktop and omitted from mobile More. Activity is the exact accepted label.

Mobile uses the source query `(max-width:767px), (max-width:1023px) and (pointer:coarse)`: header branding / TenBot / Notifications / Account; one Messaging instance occupies bottom slot three. Bottom labels: Jobs / My Work / Messages / More. More preserves accepted flattened order, focus containment, Escape and same-route Back handling.

Destination links keep accepted hrefs. Only Production and My Work render complete fixture workspaces; other destinations display route-specific navigation previews with correct active states. Local sign-out selects the locked fixture, not a real account action. Message sidebar demonstrates a collapsed message bar and opens the synthetic Inbox; the full source sidepane runtime and employee-scoped preference are not reproduced. A/C/Before remain earlier visual experiments and are not navigation references.

Browser review resumed after an unrelated Windows permission prompt was dismissed by the user, then stopped by the user's physical Escape key before the refreshed B layout could be verified. Source, Node VM and HTTP checks are the completed evidence for this revision.

## Production / TenDev branding and Job Update indicators

Open **http://127.0.0.1:4176/?design=b&environment=production**. Use **Environment → Production / TenDev** in the external design toolbar. Existing A/B/C, theme, viewport and role comparisons remain available. Refresh an already-open tab to load branding.js and its source-derived configuration.

The preview server reuses the accepted pure `getBrandingConfig` / `isDevBrandingEnabled` helper; only the exact public flag string `true` selects TenDev. The selector simulates that rule without changing an actual environment. Header assets are served unchanged from an explicit public-file allowlist, not copied or regenerated. Production uses the steel Tenarten crest with the accepted TenOps text/Operations Control subtitle. Authenticated TenDev uses the same crest, actual TenDev overlay, R&D subtitle and Development Environment artwork. The locked header uses the accepted gold logo and source product-name treatment.

Production defaults light and TenDev dark. Local review theme choices are separate per environment under `tenops.design-review.branding.v1`; actual application appearance keys are untouched. Browser title/icon/application-name metadata follows the selected source configuration. Accepted PWA manifests, icons, titles/configuration files and service worker remain unchanged; the prototype does not register/install a PWA.

All branding assets required by the inspected header paths are present. The publication record explicitly omits personalized decorative artwork and uses existing generic development artwork. Nothing missing was reconstructed. A/C/Before remain historical visual experiments and are not branding/navigation authority.

In **Production Pipeline → Overview**, each job now has the accepted speech-bubble Job Updates control beneath its identity on desktop and in its card footer on mobile. The number is the **total updates**, not unread updates. A separate blue dot marks the explicit synthetic employee-unseen flag. Zero updates retain an icon-only button. Try Aster Exchange (3 + unseen), Cedar Civic Center (2, seen), Birch Square (1 + unseen), and Juniper Library (no updates). Clicking opens the Inspector's Job Updates tab and simulates successful seen acknowledgement; the total stays unchanged. Ordinary Details does not clear the dot. Fixture state resets on reload and never calls notification/seen RPCs.

Focused evidence: source/flag checks, header asset SHA-256 equality, Node syntax/CSS parsing, bounded branding/indicator VM checks and successful HTTP asset responses. Browser checks observed Production/light desktop; TenDev/dark desktop and mobile; TenDev/light mobile; zero/positive update states, blue dot, direct Job Updates navigation and dot clearing with the count retained. This was a focused review, not a broad regression campaign.

## Direction B Overview hitboxes and employee wording

B → Production Pipeline → Overview now follows the accepted Queue's sibling-overlay interaction pattern: one native transparent button covers each row/card; Updates and Files are independent controls above it. The title/chevron are presentation within that larger primary target, not duplicate keyboard stops. Clicking a date, status, customer or blank primary area opens the existing Details Inspector. Update and file shortcuts still open their respective tabs. No row/card click handler or nested button was introduced. Dense Table, Timeline and A/C/Before retain their existing interactions.

“Locally” meant only in-memory synthetic fixture changes that reset on reload, not an offline/durable save. That caveat now lives in the external review toolbar and this guide. Employee-facing Production actions use Save changes / Change status / Post update / Save all changes. Edit mode says Editing details; pending date proposals say Changes not yet saved. Staging, review, confirmation and fixture mutation handlers are unchanged.

Browser verification opened a job from a desktop date cell away from the title. Focused markup/state checks verified one primary target plus separate shortcuts, no nesting/double activation, unchanged staging/confirmation semantics and source-consistent labels. Native keyboard/focus painting and mobile touch were not manually completed; browser keyboard input was interrupted by user activity. Actual branded headers, navigation and update count/unseen fixtures remain available.

### Direction B icon parity review

B now uses the exact installed Lucide SVGs and accepted custom navigation, private-task and TenBot SVGs through the static prototype-only icons.js registry. A/C/Before retain their historical comparison artwork. The numbered icon-role inventory, corrections and unrendered source-module limits are in ASSESSMENT.md.

Review at http://127.0.0.1:4176/?design=b&environment=production (refresh existing tabs); Environment, theme, viewport, role and A/B/C controls remain available. Focused JavaScript/CSS and fixture-rendering checks passed. Updated browser visual verification was stopped by Computer Use's browser-URL confidence check and remains for Product review.
