# Performance header — local Product review only

October 14, 2026. **NOT RELEASED. STOP FOR PRODUCT REVIEW.** The initial lightning treatment was visually rejected. Functionality is accepted; this revised visual treatment requires Chris’s explicit acceptance before any release. The later local-only gate supersedes the pasted expedited release authorization.

Base/canonical main and dev: `1d34f1800635336157f25db10206f7a4938d23ae`. Isolated worktree: `/private/tmp/tenops-performance-header`, branch `feature/performance-header-polish`. Resolve the candidate SHA with `git rev-parse feature/performance-header-polish` from the canonical repository. No existing header candidate was found; no reconciliation was required. Released retrieval code is inherited unchanged.

## Local preview

Open **http://localhost:3000/manpower-reporting?performancePreview=active**. This is the actual TenOps Production-mode export with the established synthetic read-only retrieval fixture. The confirmed obsolete DYMO review process was replaced on port 3000. No hosted connections, business-data writes, migration, Edge deployment, push or TenOps/TenDev deployment occurred. Restart with `node scripts/start-performance-header-review.mjs` from this worktree.

The build uses `NEXT_PUBLIC_DEV_BRANDING=false`, `CF_PAGES_URL=https://tenops.pages.dev`, no `.env.local`, and synthetic localhost Supabase settings. It is a **local review export and must not be deployed**. The actual Production Pages/Supabase targets were verified in the immediately preceding retrieval release; this work does not change them.

Use `performancePreview=expired` to show the exact seven-day end state and `performancePreview=before` for pre-activation. Without the override, the indicator is hidden. Preview virtual time is frozen and starts no clock. `PERFORMANCE_ACTIVATED_AT` remains `null`; actual activation/expiration dates are deliberately unset pending explicit Product approval. The visibility interval is inclusive at activation and exclusive exactly seven days later.

Click the indicator to open What's New. The × button, Escape, outside click and route changes close the popover without dismissal. Only **Dismiss announcement** persists dismissal. Preview storage is separately namespaced, so testing cannot dismiss the future Production announcement. To replay the entrance animation, use a fresh browser session; it fades/slides 5px over 400ms once per session. Reduced motion disables it.

## Design and validation

Revised desktop treatment uses plain navy/slate PERFORMANCE UPDATE text with a restrained underline and no icon, colorful badge or decorative container. Below 1400px it uses UPDATE alongside the product name without consuming subtitle width. At 640–1279px the three domain controls use the application’s existing compact icon presentation; labels remain accessible, and destinations, hover menus and click behavior are unchanged. Full TenOps / OPERATIONS CONTROL branding remains visible at 1024px. Mobile retains its navigation row and header height. The popover matches existing square slate borders, white dropdown surfaces, compact spacing, slate section headings and the existing dropdown shadow. It opens below the entire header, preserving visibility of branding and navigation. Approved content and explicit dismissal behavior are unchanged.

Tier 1 / Testing Level 1. TypeScript, targeted ESLint, diff check, Production-mode webpack build and mandatory branding verifier pass. Eight focused browser check groups pass: desktop, 1024px breakpoint and 390/320px mobile layout; popover open/close and keyboard/outside click; dismissal reload/context persistence; once-per-session entrance; reduced motion; seven-day boundaries; brand navigation; and TenOps / OPERATIONS CONTROL branding. No runtime page errors or external HTTP requests occurred in the focused browser pass. Validation was rerun only to correct real test-harness issues, replace the older preview fixture and resolve a compact-desktop overlap. Three builds completed; one earlier build was interrupted after a lint finding. No broad application/database/authentication/PDF/calculation suite was run.

Screenshots in `output/performance-header/`: `desktop.png`, `desktop-1024.png`, `mobile.png`, `popover.png`, `mobile-popover.png`. Images were visually inspected. The original 1024px subtitle clipping concern is resolved: both the wordmark and full subtitle remain visible, without wrapping, compression or control overlap. Existing landscape mode hides branding, so the announcement follows that existing behavior. Activation still requires Product approval.

## Exact candidate boundary

```text
src/app/client-layout-shell.tsx
src/components/PerformanceAnnouncement.tsx
src/components/PerformanceAnnouncement.module.css
src/lib/performance-announcement.mjs
scripts/start-performance-header-review.mjs
scripts/verify-performance-header.mjs
docs/project-memory/2026-10-14-performance-header-review.md
docs/project-memory/evidence/2026-10-14-performance-header-review.json
```

Screenshots and local export remain untracked/ignored review artifacts. [Focused validation receipt](evidence/2026-10-14-performance-header-review.json). Canonical unrelated untracked release records are preserved. No follow-on work is authorized by successful validation.

## Visual revision validation — awaiting Product review

This local working-tree revision is based on candidate `83c634b79db69addfd3cdac5d8f0cda86947db9f`; it has not been committed, pushed or deployed. The original visual design must not be released. Current canonical main/dev remain `1d34f1800635336157f25db10206f7a4938d23ae`.

Tier 1 / focused Testing Level 1. The final Production-mode export (synthetic localhost backend, no `.env.local`, explicit Production branding) passed TypeScript, targeted lint, branding verifier and diff checks. Focused visual/responsive checks passed at 1440, 1280, 1024, 768, 390 and 320px: full branding, no overflow, wrapping or overlap; unchanged header height; correct full/compact labels; contained square popover with unchanged copy; Escape focus restoration; 1024px hover-menu navigation and reduced-motion styling. No page errors or external HTTP requests occurred. The review fixture and localhost URL are unchanged.

Four exports were completed during the visual revision, with corrective iterations for inline baseline alignment, tablet navigation fit and placing the popover below the entire header. No unrelated suites ran. Seven-day expiration, explicit local dismissal and persistence logic are unchanged; their accepted functional evidence was reused rather than rerun.

Current screenshot artifacts: `desktop.png`, `desktop-1024.png`, `mobile.png`, `popover.png`, `mobile-popover.png`, plus width-specific snapshots. [Visual validation receipt](evidence/2026-10-14-performance-header-visual-review.json). The replay script is the ignored local artifact `output/performance-header/visual-review.mjs`.

Exact revision delta from the original candidate:

```text
src/components/PerformanceAnnouncement.tsx
src/components/PerformanceAnnouncement.module.css
scripts/verify-performance-header.mjs
docs/project-memory/2026-10-14-performance-header-review.md
docs/project-memory/evidence/2026-10-14-performance-header-visual-review.json
```

No outstanding visual defect was found at the checked sizes. The responsive compact navigation presentation is part of this Product review. Activation remains unset and the local preview clock remains frozen. Stop for Product review.

## Final Product positioning correction — local review only

Supersedes the plain-text trigger described above. The trigger now reads blue ⚡ UPDATE, positioned as a normal-flow sibling to the RIGHT of the complete logo/branding link. The lightning is a currentColor SVG so it shares the TenOps blue accent with UPDATE. No underline, background, border or badge container. Below 360px only the blue lightning remains. The second iteration's compact square popover and all announcement logic are unchanged.

Tier 1 minor presentation correction. Reused existing validation evidence; inspected one desktop (1440px) and one mobile (390px) viewport with closed/open screenshots. Both retain full branding, original header height and no horizontal overflow. One Production-mode local export refreshed the actual preview; no repeated builds, broad suites or unrelated tests ran. Screenshot inspection initially treated the expected darker blue hover tone as a failure; only the pending mobile capture was completed afterward, with no source correction or rebuild.

Updated artifacts: `output/performance-header/final-desktop.png`, `final-desktop-popover.png`, `final-mobile.png`, `final-mobile-popover.png`. Preview remains http://localhost:3000/manpower-reporting?performancePreview=active. Activation remains unset. No commit, push, deployment or hosted-data change. STOP FOR PRODUCT REVIEW.

## Combined release preparation acceptance

Chris accepted the complete final blue SVG lightning + UPDATE treatment for combined release preparation. Earlier “awaiting acceptance” statements are historical. The full dirty visual overlay is preserved in the candidate commit, not just 83c634b. Activation remains null. The existing verifier’s desktop label assertion was aligned to the accepted UPDATE text; no app source was changed or broad validation rerun. [Final positioning receipt](evidence/2026-10-14-performance-header-final-trigger.json) preserves the completed final mobile inspection; desktop screenshots and the prior final positioning report provide desktop evidence.
