# TenBot global workspace — November 2, 2026

**Status: implemented locally; pending Product review.** No merge, push, hosted change, migration, inference or deployment. Authority is Chris's **TENBOT — GLOBAL WORKSPACE & FEATURE REQUESTS** prompt and same-day **Product simplification — TenBot capability requests** correction. Separate Advisory/Product Architecture context was unavailable. This isolated UI scope supersedes the infrastructure pass's deferred-relocation status only for this candidate; its backend/release claims remain unchanged.

## Boundary and ownership

- Base: committed `b5f7f66` (existing infrastructure/simplification work), branch `feature/tenbot-global-workspace-20261102`, worktree `/private/tmp/tenops-tenbot-global-workspace`.
- The active `dev` checkout and its unrelated dirty backend/evaluation/documentation work were not edited, staged or committed. The final commit contains only the owned delta listed below; do not promote the entire base merely because this frontend candidate exists.
- Tier 2 / Testing Level 2: bounded presentation/navigation and shared existing conversation state. No provider, orchestration, spending, Job tool, backend API, permission policy or migration changes.
- Modified ownership: `src/app/client-layout-shell.tsx`, `src/components/GlobalMessaging.tsx`, `src/modules/my-work/InboxDialog.tsx`, `src/modules/tenbot/TenbotWorkspace.tsx`, `src/modules/tenbot/events.ts`. New ownership: `src/components/GlobalTenbot.tsx`, `src/modules/tenbot/GlobalTenbotWorkspace.tsx`, `src/modules/tenbot/global-workspace.css`, `src/modules/tenbot/capability-requests/`, two focused verifier scripts and this receipt/evidence plus scoped Current State/execution handoff paragraphs.

## Implemented behavior

The global header has a dedicated TenBot icon. Desktop opens a right panel below the measured header while the current page stays navigable. Expand opens a larger modal workspace. Mobile uses a full-screen surface with safe-area padding, visualViewport keyboard handling, body-scroll restoration, focus trapping and existing mobile detail-navigation Back behavior. Closing/reopening and expansion preserve the mounted history scroller and composer draft. Browser reload uses the existing server history and existing account-scoped text-draft storage.

A single account-scoped conversation provider now serves both the panel and legacy Messaging. It wraps only those header descendants, preserving shell DOM/measurement lifecycle. It uses the unchanged conversation/history/session APIs and current-access checks. The composer reuses the same existing Messaging draft key, not another persistence mechanism. Switching owners remounts the controller/views; losing access removes both assistant presentation and modal background lock. Initialization now occurs once when the authenticated global Messaging/assistant navigation mounts, rather than waiting for the first Messaging dialog. Existing allowed invoice resume/status behavior is retained, and required-password-setup access remains gated.

The Messaging TenBot row/menu, existing `/tenbot` compatibility behavior and generic feedback functionality remain intact pending coordinated integration. Opening a presentation closes the other to avoid simultaneous interactive conversation controls. No transcript is copied to employee messages or to capability suggestions.

## Inline capability requests and backend handoff

The first release includes **only** inline Yes / No / optional context. There is no new backlog dashboard, management/status UI, notification service or scheduler. [The minimal adapter contract](../../src/modules/tenbot/capability-requests/README.md) is the integration owner:

1. The backend supplies an owner/access-bound, genuine automation-gap signal after useful existing-workflow help. Ordinary questions, information requests, permission errors and temporary failures are excluded. Existing `suggestionAllowed` is deliberately not treated as this classifier.
2. Explicit Yes submits only the reviewed requested capability, original objective, optional identified TenOps feature/workflow and optional context, with an opaque gap binding. Backend derives requester/date, validates authorization and deduplicates retries. A durable ID is required for a success message. No calls occur for No. No transcript is included.
3. Backend owns the minimal private record and a consolidated private Chris report **only when new requests exist**, preferably via existing Messaging/notification infrastructure. Manual reporting remains acceptable until automation is supported; reporting does not block this UI rollout.

The default adapter is unavailable and cannot claim persistence. Existing generic feedback APIs do not establish the narrower classifier/private reporting semantics, so this candidate does not reuse them speculatively. `CapabilityRequestProvider` / `CapabilityRequestSlot` enforce owner and access-key matching; no signal means no contextual offer. Backend integration must reissue a signal after access changes. A clearly labeled `?tenbotCapabilityPreview=1` fixture exists only in development on exact hostname `localhost`; it provides synthetic manual help and returns a preview result, never saved success. Production builds exclude this query activation.

## Actual validation and limitations

- Full project TypeScript and targeted ESLint for changed runtime/verifier files: PASS.
- `tsx scripts/verify-tenbot-capability-requests.mts`: PASS, including signal exclusions, assistance gate, bounded/minimal projection, unavailable/invalid/preview receipts and rendered owner/access isolation.
- `node scripts/verify-tenbot-global-workspace-browser.mjs`: PASS, ten focused workflow groups in the actual application, with synthetic Auth/history transport and all outbound origins blocked. Desktop right panel/expand/navigation, mid-history scroll, shared draft/Messaging, focus/IME, failed-send retry, mobile keyboard viewport/Back, inline preview/dismissal, account switch and access revocation were exercised. Zero page errors, hosted calls, inference calls or submitted suggestions. [Browser receipt](evidence/2026-11-02-tenbot-global-workspace/browser.json).
- `npm run build -- --webpack` with synthetic loopback build variables: PASS, all 25 pages generated. This is a Production-mode compilation, not a deployable hosted configuration or hosted smoke. The prebuild retained the unchanged knowledge snapshot.
- `git diff --check`: PASS. Independent EM source review: PASS after correcting provider/header lifecycle, setup gating, focus fallback, access-bound capability state and mobile Back behavior.
- Browser/test startup initially required sandbox escalation. Early checks caught actual focus/header issues, corrected in the final source; the browser harness was corrected to use Supabase's actual BroadcastChannel session mechanism and to close modal Inbox before clicking the header. Retained [superseded checkpoint](evidence/2026-11-02-tenbot-global-workspace/superseded-browser-checkpoint.json) is not the final outcome.

Selected sanitized screenshots: [desktop](evidence/2026-11-02-tenbot-global-workspace/desktop.png), [expanded](evidence/2026-11-02-tenbot-global-workspace/expanded.png), [mobile](evidence/2026-11-02-tenbot-global-workspace/mobile.png), [inline preview](evidence/2026-11-02-tenbot-global-workspace/inline-preview.png). Light-theme and simulated keyboard screenshots remain in task scratch evidence.

Port 3000 was inspected: node PID83974 belonged to the active root `dev` checkout, so it was preserved. Internal browser validation used exact `http://localhost:3100` and synthetic transports; this is the necessary isolation exception, **not** Chris's manual `localhost:3000` acceptance or a real hosted conversation test. The task-owned 3100 server is stopped at handoff; no test API server was created. A shared ignored `node_modules` symlink, local build output and raw task evidence remain in the isolated worktree/scratch directory for reproducibility. Existing root processes and history were left intact.

## Product review and integration risks

Product acceptance remains the next decision. Coordinate a safe functional `localhost:3000` manual review with the active backend owner before integration; never replace their process blindly. No global workspace acceptance, Messaging removal/redirect change or hosted rollout is claimed here.

The main integration surfaces are the small provider/composer extraction in `TenbotWorkspace.tsx` and the shell/Messaging event wiring. Apply only this owned commit delta, reconcile concurrent changes to those paths, then verify against the accepted backend candidate and a legitimate owner session. Keep current JWT, private history reauthorization, receival approvals and write gates unchanged. The inline adapter remains disconnected until the backend validates its classifier/private-record semantics; daily report automation is separately deferred and must not hold the global assistant rollout.

## Provisional acceptance and interactive-action follow-up

Chris's same-day **TENDEV — TENBOT WORKSPACE INTEGRATION & INTERACTIVE AGENT ACTIONS** provisionally accepts exact Workspace `5cb71fb52ffe784715b9ae5d8bb95a14ac6df395` and authorizes only the [isolated action-UI follow-up](2026-11-02-tenbot-workspace-actions.md). This supersedes the earlier pending-review status solely for that provisional acceptance; the original evidence and release limits remain historical receipts. The new action candidate still requires Product review and coordinated backend integration, with no merge, migration or release authority.
