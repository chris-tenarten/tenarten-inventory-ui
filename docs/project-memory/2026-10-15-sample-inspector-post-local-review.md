# Sample Inspector Post to Job — local Product review

October 15, 2026. Uncommitted local candidate based on released `350c556129312a0321ced8bb23c29b128848e00c`. Persistent worktree: `/Users/chrisngo/source/worktrees/tenops/sample-post-button-polish`; branch `feature/sample-post-button-polish` (the workstream expanded from the initial button-only request). No commit, push, deployment, migration, Edge change or hosted business-data write.

## Product decisions and behavior

Chris chose existing issued Sample Work Orders only. Post to Job must not silently issue, approve, save or change Sample lifecycle. Both the new Inspector action next to document-generation controls and the preserved PDF-preview action use `PostSampleToJob` and the released publishing implementation.

Both entry buttons retain the accepted **Upload → Paperclip → Post to Job** treatment: closely grouped Lucide 16px/stroke-2 icons, white label/icons, muted blue/navy background, brighter blue border, existing 36px toolbar height and subtle hover/focus feedback. No animation, gradients or glow. Existing preview controls and toolbar position are unchanged.

The Inspector composer offers:

- **Sample Work Order:** choose an existing issued document, then automatically render/open its PDF using the existing generator and immutable issued snapshot. No new issued version is captured. If none exists, explain the restriction and link to the existing explicit issuance controls. Existing generation-in-progress status is respected.
- **Working Sheet:** automatically generate from the saved Sample with the existing working generator. Unsaved/current configuration errors block posting and link to existing Save/configuration controls; posting never saves implicitly.
- **Blend Sheet:** load the latest existing captured sheet on demand with the established bounded `blend-list` query, and generate through existing `blend-pdf` using that plan ID. Show its captured quantity/date and retain recorded configuration/overrides. No new plan is issued by posting. Missing captured plans link to existing planning/generation controls. Unsaved Blend planning blocks posting so it cannot silently fall back to an older capture.

The composer validates the destination before generation and the existing publisher rechecks before upload. Preview Document uses the existing DocumentViewer. Generated files are cached by document/input identity and reused for posting. Changes invalidate the selected preview/cache identity; in-flight generation rejects stale input identity. Issued/captured snapshots use their immutable identities. Retry request IDs are scoped to destination plus document/input identity. Existing PDFs from the preview entry bypass generation. No new PDF generator, calculation defaults, backend/RLS or issuance contract was added.

## Focused validation — PASS

Risk Tier 3 / focused Testing Level 3 for automatic document generation, snapshots and publishing. Existing released database/RLS/notification and PDF-engine evidence reused. No database, broad PDF, Messaging or authorization suite rerun.

- Targeted ESLint, TypeScript through local Production build, diff check and verifier syntax checks passed.
- Focused actual localhost browser checks passed: Inspector discovery; document selection; no-issued explanation/issuance link; saved Working Sheet automatic generation; exact retrieved PDF bytes; Preview-to-Post byte reuse without regeneration; changed inputs invalidate cache; unsaved Sample changes require explicit Save; existing preview entry; existing issued Work Order reuse with no additional issue; captured 200-lb Blend configuration including its adjustment; unsaved Blend settings block silent fallback; generation/post failures; cleanup; lost-response retry and duplicate prevention; desktop/mobile layout and two-icon toolbar.
- Five successful Updates and five stored objects in the disposable adapter. Sample state equals the expected state captured after the user's explicit Save/issuance actions; posting itself does not alter Sample state. Zero external browser requests during fixture-mode workflow and zero page exceptions.
- Corrective continuations addressed the document selector accessible name, the existing fixture's missing exact-count header, and the unsaved Blend-planning guard. Only affected local build/browser checks were repeated. No broad suites were added.
- The local fixture intentionally emits failed generation/post/lost-response/conflict statuses; Realtime is not implemented by this adapter. These expected fixture diagnostics are distinct from page errors, which were zero. Actual hosted auth/posting/notification writes were not tested.

## Local Product review

URL: http://localhost:3000/samples?open=00000000-0000-4000-8000-000000710001

Normal TenOps sign-in; existing read-only auth forwarding is reused. All Sample, Job, document and posting operations stay in disposable local memory. Product can try Working Sheet or captured Blend Sheet immediately; to test Work Order, explicitly use the existing Generate Sample Work Order action once, then choose that issued record in the Inspector composer. Restarting the review adapter resets disposable records. Real account login is left to Product; a fresh-browser sign-in/unauthenticated-local-denial smoke check passed.

Screenshots: `output/sample-inspector-post/inspector-desktop.png`, `inspector-mobile.png`, `preview-toolbar-desktop.png`, `preview-toolbar-mobile.png`, `composer-success-desktop.png`, `composer-success-mobile.png`. [Machine focused results](evidence/2026-10-15-sample-inspector-post-local-review.json).

## Exact changed files

- `src/modules/samples/PostSampleToJob.tsx`
- `src/modules/samples/SampleWorkspace.tsx`
- `src/modules/samples/post-to-job.ts`
- `scripts/start-sample-job-update-review.mts`
- `scripts/verify-sample-job-update-browser.mjs`
- `docs/project-memory/2026-10-15-sample-inspector-post-local-review.md`
- `docs/project-memory/evidence/2026-10-15-sample-inspector-post-local-review.json`

No backend release dependency was introduced. Production release is not authorized. STOP FOR PRODUCT REVIEW.
