# Customer List dialog hotfix — local Product review

**Uncommitted** on `feature/customer-dialog-hotfix`, based on fetched canonical main/dev `cb5fc4c341e95a670011a84e73508c0fa749466b`. Isolated worktree: `/private/tmp/tenops-customer-dialog-hotfix`. Tier 2 / Testing Level 2, bounded application behavior hotfix. No hosted writes, schema/migration/permission changes, commit, push, Edge deployment or frontend deployment.

## Root cause and correction

The management sliders button was conditional on the Existing Job Inspector variant, so New Job omitted it. CustomerInspector rendered an inline role=dialog section inside the parent, without its own modal focus/inertness/scroll ownership. List and editor were alternative states of one panel; Cancel/Escape called the outer onClose, collapsing the management layer instead of returning to it. Focus restoration always targeted the dropdown, which could be disabled or unmounted during closing. Parent behavior differed: New Job had backdrop-only dismissal and no equivalent Escape/focus trap; the Inspector had an independent window-level Escape/Tab handler that was unaware of native child modality.

Both Customer fields now expose the existing sliders icon; dropdown Add New Customer and Manage Customer List actions remain. Every path uses the same CustomerInspector and save contract. The management list remains mounted while its Add/Edit Customer child is open. Cancel, Escape and backdrop dismiss only that current editor; the management list restores without touching the Job draft. Save returns to the originating workflow with the customer available, preserving existing selection semantics: direct Add selects the new customer; shared management does not silently replace a Project capture.

A scoped ProductionDialog helper follows the existing Color Plate editor's native showModal convention: top-layer modal ownership, browser background inertness, explicit Tab wrapping, cancellation/backdrop event isolation, correct surviving opener fallback, and counted body scroll locks across parent/list/editor. New Job uses it as its outer modal. The existing Job Inspector retains its layout and other overlay architecture, gains balanced scroll locking and defers its window-level key handler while customer management is active. Pending saves retain dismissal guards. No z-index-only workaround.

## Focused validation

Final consolidated pass: **12 browser check groups passed** on the actual application at exact localhost origin, with no external requests or page errors. Coverage: New Job sliders/Close, Add/Cancel, Add/Save from dropdown and manager, shared edit Cancel, one-level nested Escape and backdrop, unsaved name/Job number/remarks preservation, both dropdown actions, focus restoration and background focus prevention, busy-save dismissal guard, balanced scroll locks, existing Inspector management, and 390px mobile fit/usability. Desktop and mobile editor screenshots were visually inspected.

TypeScript, targeted ESLint (zero warnings), script syntax checks, diff check and one isolated Production webpack build passed. Built with explicit Production branding and synthetic localhost API, without .env.local; review export must not be deployed. Earlier textarea locator and nullable-fixture defects were corrected; no application defect was concealed by the harness corrections. No broad RLS, migration, PDF, calculation or Production suites rerun.

Accepted authorization/database/atomic-save evidence is reused. Database query/save implementations, contact model, all six migration checksums and accepted UPDATE header source remain unchanged. The local browser pass tests UX with in-memory name-only saves, not database authorization or persistence.

Configured Customers and Previously Used Names retain their existing separate group labels. `[Place Services] temporary` is deliberately present only in synthetic historical Job suggestions, absent from configured companies. No historical customer text was deleted, merged or cleaned up.

## Local review

Open **http://localhost:3000**. Synthetic login: **customer-review@example.invalid / Local-review-only!**. Restart: `node scripts/start-customer-dialog-review.mjs` from this worktree. Start New Job, enter draft fields, use sliders or dropdown management, then exercise nested Cancel/Escape/backdrop. The API fixture holds name-only customer saves in memory and resets on restart; it rejects Job writes. It contains no hosted credentials and makes no outbound requests.

Port 3000 was free before this hotfix started. The older Contact review at port 3001 and accepted header/contact worktrees are preserved. Shared Docker/Supabase was unresponsive; it was inspected but not restarted, to preserve other running local stacks. The review fixture removes that dependency. No Production test records were created.

## Exact changed files

- `src/modules/production/components/ProductionJobCreator.tsx`
- `src/modules/production/components/ProductionJobInspector.tsx`
- `src/modules/production/contacts/CustomerInspector.tsx`
- `src/modules/production/contacts/ProjectContactEditor.tsx`
- `src/modules/production/contacts/ProductionDialog.tsx`
- `scripts/start-customer-dialog-review.mjs`
- `scripts/support/customer-dialog-review-fixture.mjs`
- `scripts/verify-customer-dialog-hotfix.mjs`
- `docs/project-memory/2026-10-15-customer-dialog-hotfix.md`
- `docs/project-memory/evidence/2026-10-15-customer-dialog-hotfix.json`

[Focused evidence](evidence/2026-10-15-customer-dialog-hotfix.json). Screenshots and isolated build remain ignored local artifacts. Canonical unrelated dirty release records are untouched. STOP FOR PRODUCT REVIEW.
