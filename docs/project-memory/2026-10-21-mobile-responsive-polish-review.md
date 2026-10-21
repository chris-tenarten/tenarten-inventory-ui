# Mobile responsive polish candidate

Local branch `fix/mobile-responsive-polish`, based on canonical main/dev `83623d6da1242b813c8c17a9de5d8d43435f04f8`. Both remote branches were rechecked before committing and still match this baseline. No push or deployment.

## Findings and corrections

The supplied physical iPhone screenshots were reproduced against the released application using the existing local review server with controlled, local-only task and Inbox responses. No private hosted conversations were read, no accounts were created, and no messages were sent.

- **Inbox:** the implicit mobile grid track could grow to the conversation preview's intrinsic width. Its oversized sidebar placed the New message label outside the viewport. An explicit single mobile track and shrinkable grid/flex children now constrain the sidebar, names, previews and timestamps. The original 310px desktop sidebar remains. The conversation pane can scroll when a short landscape viewport cannot fit recipient fields and the composer together, making Attach and Send reachable.
- **My Work:** long task/job/group/participant text and a fixed adjacent due label could force cards beyond the viewport. Cards now have bounded widths and wrap long text; below the existing `sm` breakpoint the due label sits beneath the content, with separate 44px completion and quick-action columns. Desktop keeps its previous flex arrangement. No task handlers or data rules changed.
- **Footer:** the Messages icon was 16px while the other icons were 20px. All four are now 20px, with matching spacing and aligned text. Selection uses the existing softer selected-interaction color and a 2px top accent. The 44px touch row, 79px portrait total with a 34px inset, 66px landscape total with a 21px inset, and full safe-area background extension are unchanged.

## Focused validation

Tier 2 because the change touches three adjacent UI surfaces; Testing Level 1 because implementation is presentation-only. The existing `scripts/verify-mobile-visuals.mjs` gained a focused mode; no new test framework or script was created.

- Production build (including TypeScript), separate `tsc --noEmit`, targeted ESLint and `git diff --check`: passed on the final application source.
- Browser cases: 320×568, 393×793, 430×873, 852×393 landscape with native inset overrides, and 1280×900 desktop. Final run: zero layout failures, page errors or external requests.
- Checked task/card/action bounds, a long unbroken reference, participant/job/group metadata, quick-menu opening, New message button/label, conversation timestamps, wrapped message bodies, recipient selection and an unsent composer. Send passed a trial click and vertical bounds check after scrolling; no send action executed.
- Verified unchanged footer dimensions, all four icon/glyph alignments, selected color extending to the viewport bottom, and no startup replay after focus/visibility events. Light/dark selected text contrast is respectively 6.16:1 / 6.19:1; safe-area fill matches in both.
- Independent diff and evidence review: no blocker. Reused previous startup validation: startup, authentication, Web Push, Contacts, manifests, worker, backend configuration and migrations have no source changes. Approved spark speed, cut line, 888ms hold and 850ms fade remain intact.

An initial footer assertion compared a span's line box with other labels' glyph boxes. Inspection showed identical glyph positions; the verifier now compares glyph ranges consistently. The initial landscape capture exposed the clipped Send action and prompted the bounded pane-scroll correction before the final passing build and browser run.

## Review and limitations

Review the actual application at `http://localhost:3000/my-work` using the existing local fixture server. [Machine-readable evidence](evidence/2026-10-21-mobile-responsive-polish-review.json).

These new checks use Chromium emulation, not a fresh physical iPhone/Safari or software-keyboard session. Short landscape requires pane scrolling to reach all composer controls; fields and history need not be simultaneously visible. No claim of new physical-device approval is made.

| View | Before | Candidate |
| --- | --- | --- |
| Inbox, 393px | [Clipped action](evidence/mobile-responsive-polish/inbox-before-393.png) | [Visible action and contained list](evidence/mobile-responsive-polish/inbox-after-393.png) |
| My Work, 393px | [Overflowing cards](evidence/mobile-responsive-polish/my-work-before-393.png) | [Wrapped tasks and softer footer](evidence/mobile-responsive-polish/my-work-after-393.png) |
| Inbox composer, landscape | — | [Reachable Attach and Send](evidence/mobile-responsive-polish/composer-after-852.png) |
