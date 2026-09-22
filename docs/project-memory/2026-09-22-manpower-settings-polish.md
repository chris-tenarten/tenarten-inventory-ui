# Manpower Settings polish — localhost accepted

Baseline: `cd11cc0117910f7541d34433c021eb254d5cd5cc`, normal `dev` workspace. Chris authorized this client-only pass plus shared bulk-button dark-mode contrast and centered panel sizing. Implementation and local validation were completed without committing, pushing, deploying, applying migrations, or writing hosted business data. Chris subsequently accepted localhost and authorized committing and pushing this complete boundary to normal `dev` only; no promotion to `main` is authorized.

## Behavior

- One Manpower Settings entry point, with Workers, Tasks, and Lead/Admin-only Product Categories tabs. Existing Worker/Task operations are retained. Unsaved edits block closing/tab changes.
- Centered 1,080px maximum desktop panel; near-full-width on narrow screens. The maximum height measures available viewport space below the actual panel top, reserving 48px below on desktop and 24px on narrow screens. Panel heading, tabs, and tab-level controls remain fixed; only each tab’s list/table scrolls vertically. Short lists retain natural height. Worker/Task tables retain local horizontal overflow where necessary.
- Category rows have handle-only pointer dragging, arrow-key reorder, overflow Move up/down and Deactivate, and pencil rename. Focus returns after actions; live status announces results. Inactive categories are separate and unnumbered, with Reactivate.
- Active order is contiguous, independent of inactive order values. Add/reactivate append; deactivate closes remaining gaps. UUID identity and labor references never change. Rename retains existing duplicate/reserved-name semantics.
- Reuses the existing category table, grants/RLS, and guarded REST updates. Reorder payloads contain only `sort_order`; audit timestamps are maintained by the existing trigger. No schema/RPC changes.
- Existing API has no multi-row transactional reorder operation. Client checks the full versioned list before writing, uses per-row `updated_at` guards, and verifies results. Failure may leave some category changes saved: UI explicitly reports partial/uncertain results, refreshes, offers Normalize order, and disables further writes when refresh fails. No automatic rollback or repeated insert on an ambiguous response.
- Shared bulk-action disabled style uses explicit readable text/background/border colors at full opacity in both themes; enabled-only hover/focus rules. Layout dimensions unchanged. Automated computed label contrast exceeds 4.5:1 for all six disabled actions in both themes at desktop/narrow widths.

## Validation

Focused browser fixtures cover settings tabs, Worker/Task create/rename/deactivate, category lifecycle and validation, drag/keyboard/overflow reorder, normalization/appending, selector order, partial saves, concurrent edits, failed refresh, responsive layout, both themes, entry behavior, Bulk Apply, Job/Task/Product analytics, and period-scoped Snapshot analytics. All business API requests in browser tests are mocked.

Final results: **36/36 focused browser tests passed**. TypeScript, targeted ESLint, diff whitespace, Production build, branding verifiers, complete-loading/product/rework/bulk scripts, and the disposable Docker/PostgREST authorization/integrity verifier all passed. Logs are under `/private/tmp/tenops-settings-*.log`; screenshots/traces use ignored `test-results/`.

Read-only hosted verification on September 22: **1,674 entries / 7,200 hours**, **974 Job-linked entries / 4,108 hours**. Complete entry-row SHA256: `023473b0126fcc73cc97408a8c3f01d7682dd6402bb860128353820d3876bca7`. This differs from September 21's 955 linked entries / 4,059 hours and digest `9aa703c3c9531a430ad6052bc5a19120dab9a17a06411c6c2e1d91d462dea94f`. Do not claim unchanged historical rows across those dates or overwrite that hosted state. This development pass performs no hosted writes. Local fixtures prove category operations leave all entry fields intact.

An existing ignored recovery archive under repository `tmp/` was accidentally included by the broad TypeScript source glob. Its 30 files were moved byte-for-byte (SHA256 verified) to `/private/tmp/tenops-preserved-dev-reconciliation-local-copy-20260922`. Recovery refs were not touched. No source-config exclusion was introduced.

Review route: `http://localhost:3000/manpower-reporting`, using the existing development server. No additional server or special Git infrastructure was created. Localhost uses the existing environment configuration; automated tests isolate all writes with fixtures. Localhost behavior is accepted; finalize on `dev` only.

## Changed-file boundary / Git handoff

Modified:
- `src/app/globals.css`
- `src/modules/manpower/ManpowerWorkspace.tsx`
- `src/modules/manpower/ProductCategoryManager.tsx`
- `src/modules/manpower/manpower.ts`
- `tests/e2e/manpower-product-categories.spec.ts`
- `tests/e2e/manpower-snapshot-products.spec.ts`

New/untracked:
- `src/modules/manpower/category-order.ts`
- `tests/e2e/manpower-settings.spec.ts`
- `tests/support/manpower-settings-fixture.ts`
- this review note

`dev`, `main`, `origin/dev`, and `origin/main` remain at the baseline SHA. Only the above six modified and four new files are pending, unstaged. No unrelated branch or worktree was changed. No implementation blockers; stop for localhost review.

## Final vertical-layout follow-up — Level 1 only

Chris narrowed the remaining verification to Level 1 UI testing. The initial settings-file run was stopped; no full 36-test, database, authorization, analytics, historical-integrity, or build rerun was performed for this layout-only follow-up.

Four focused browser checks passed: 60-row Workers/Tasks/Product Category lists at 1440×900, 1280×640, and 390×844, plus naturally compact short Product Categories. Checks assert panel bottom spacing, centered width, exactly one vertical list scroller, stationary page and tab actions while scrolling, reachable header/tabs/Close action, and no page horizontal overflow. Desktop and narrow screenshots were visually inspected. TypeScript, targeted ESLint, and diff whitespace checks passed. All validation uses existing localhost and mocked browser data.

Only the existing two UI components, settings test file, and this review note changed for this follow-up. Prior application/API behavior and the rest of the pending review boundary remain intact. No commit, push, deployment, hosted write, or worktree creation.

## Risk-based testing policy clarification

Chris subsequently specified that Level 1 includes a Production build. The final vertical-layout Production build passed (exit 0); log: `/private/tmp/tenops-settings-vertical-production-build.log`. Together with the four focused layout checks, TypeScript, targeted ESLint, and diff check, this completes Level 1 validation for the presentation-only scrolling delta. No unrelated suites were rerun. The durable testing policy is recorded in `AGENTS.md`, adding that guidance file to the pending review boundary (seven modified, four new files). No commit or push.

## Accepted dev finalization

Chris accepted the exact localhost implementation and authorized committing/pushing the complete 11-file boundary on normal `dev`. No implementation or test files changed after the successful final Level 1 validation; only this acceptance record was updated. Diff whitespace verification passed. Existing Level 1 evidence is reused because the final delta is documentation-only. TenDev branding remains unchanged. No candidate branch, worktree, archive ref, manual Cloudflare Preview, or main promotion is included.

Staging exposed one extra trailing blank line in the new browser fixture; it was removed, with targeted ESLint and staged diff checks passing. This formatting-only correction does not change the reviewed implementation or test behavior.
