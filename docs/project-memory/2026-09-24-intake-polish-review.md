# Intake polish — localhost review boundary

Uncommitted on normal `dev`, based on `1aa6e27dfc3e26ee3c8f3c9ee7e7e082d76846ad`. No hosted migration, data mutation, commit, push, or deployment in this pass.

## Planning and workspace

Pipeline and Planning reuse Production's container convention: maximum 1800px, 20px desktop and 8px narrow horizontal gutters. The Opportunity/Job rail stays 240px; extra width goes to the calendar.

Measured content widths in pixels:

| Viewport | Before | After | Calendar after |
| --- | --- | --- | --- |
| 1280 | 1240 | 1240 | 998 |
| 1440 | 1280 | 1400 | 1158 |
| 1600 | 1280 | 1560 | 1318 |
| 1920 | 1280 | 1760 | 1518 |
| 768 | 728 | 728 | 486 |
| 390 | 366 | 374 | 132 |

At 768px the existing global application header causes document width of 860px, before and after this work. Intake itself remains contained; the unrelated global header was not redesigned.

Blank-canvas dragging pans; horizontal wheel/trackpad uses native scrolling. Zoom preserves the viewed date. Today pans to approximately the first third of the calendar without changing zoom. Fit is mode-aware, frames dates, and measures header/control/timeline geometry to position controls below the application header and give the timeline available vertical space. Long Combined/Production row sets scroll locally. Repeated Fit is stable and does not persist anything. Rows/text are not vertically compressed.

Today uses a thin **blue light-mode / red dark-mode** line, with a small header cue. The marker does not move the viewport. Projected blocks retain move/resize and accessible date editing for writers; Production blocks remain navigation only.

## Approved authorization split

Subsequent approved personal TEST exceptions and narrow Production hardening are documented in [the training review](2026-09-24-intake-personal-training-review.md). The general read/write split below still governs ordinary records.

| Role | Intake read/navigation | Intake writes | Conversion / deletion |
| --- | --- | --- | --- |
| Admin | Yes | Existing capabilities | Existing independent guards |
| Developer | Yes | Existing capabilities | No Production-create/admin-delete bypass |
| Lead / Member / Guest | Yes | No | No |
| Anonymous / inactive | No | No | No |

`viewIntake` grants read discovery to active authenticated roles. `accessIntake` retains Admin/Developer management semantics. Read-only users can inspect details, Updates, previews and Planning, and use viewport controls; projected blocks have no move/resize handlers. Existing linked Proposal/Sample navigation retains its separate authorization. Empty related-record creation shortcuts are disabled for viewers. Bid financial/context fields follow ordinary Bid read semantics; this pass does not introduce field-level financial redaction.

The purple UNDER DEVELOPMENT badge is module-level: Intake navigation and Bids heading only.

Prepared migration: `supabase/migrations/20260924180000_intake_view_access.sql`.

SHA-256: `943beeeff7b392e64487e2c0156b9836a7f8a2e887b603361b0c564c69760bbe`.

It checks installed policy/function assumptions, separates restrictive SELECT policies from write policies, and updates six read RPC capability checks. Mutation RPCs, owners, grants, security attributes, other Storage buckets and business rows remain unchanged. The Intake bucket remains private. This migration has **not been applied hosted**. Lead/Member/Guest hosted reads remain unavailable until a separately authorized migration; their new behavior is verified with disposable SQL and mocked headless fixtures. An old client still hides Intake from those roles after migration; Admin/Developer behavior remains compatible. A new client before migration cannot grant backend reads by itself.

## Focused evidence

- Level 2: Planning interaction, role-derived UI, mode-aware Fit, Today, width and badge fixtures. Headless only; no visible Chrome.
- Vertical framing verified with eight projected fixtures plus sixteen Production rows at 1280×720, 1920×1000 and 1440×520, including repeated Fit, lower-row reachability, all modes and no persistence requests. Light/dark line color assertions included.
- Level 3 for the authorization delta: `scripts/verify-intake-view-access.mjs` and `scripts/fixtures/intake-view-access.sql` passed against disposable PostgreSQL with the captured schema and released migrations. Tests cover active-role reads, writer lifecycle, seventeen denied mutation RPC paths for non-writers, raw table/Storage writes/deletes, anonymous/inactive denial, unchanged business rows and non-reader function definitions/owners/grants. This is SQL/Storage-policy evidence, not a hosted Storage API test.
- TypeScript, targeted ESLint, Production build and diff check passed. No unrelated broad suites rerun.

High-priority graphical contextual warnings and future authorization decomposition are recorded in `OPEN_QUESTIONS.md`; warnings are not implemented.

## Review and boundary

Open `http://localhost:3000/pre-production`, then Pipeline / Planning. Review Combined → Fit, local vertical scrolling, Today, zoom, light/dark marker, and module badges.

Changed application files: `BidWorkspace.tsx`, `IntakePlanning.tsx`, `IntakePlanning.module.css`, `planning-viewport.ts`, `BidPlanningCard.tsx`, `BidProposalCard.tsx`, `BidSamplesCard.tsx`, `src/lib/rbac.ts`, Intake route layout, client shell and the new `UnderDevelopmentBadge` component/styles. Supporting changes are the focused Playwright tests, authorization migration/verifier/fixture and project-memory notes.

Pre-existing untracked demo tools (`scripts/fixtures/intake-demo-final/`, `scripts/intake-demo-storage.mjs`, `scripts/prepare-intake-demo-final.mjs`, `scripts/verify-intake-demo-package.mjs`) remain separate and untouched.
