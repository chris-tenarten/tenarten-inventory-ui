# iPhone footer and Safari revision investigation

Status: local candidate only; no push, merge or deployment authorized.

Baseline: `83d0343bf1058dd0a6f21f4abaca194de5211498`, verified canonical main/dev and current TenOps deployment `3816d5e9-eaea-4a5b-9b8b-d90c57f57057`. Branch: `fix/pwa-safari-layout`.

## Footer

The physical iPhone 15 Pro screenshot is consistent with an 87 CSS-pixel footer: a 52px control row, 1px border and 34px home-gesture safe area. Focused browser measurements reproduce those dimensions at 393×793 with scale 1, fixed bottom positioning, zero body bottom padding and 95px content clearance. No duplicate bottom inset, CSS scaling or display-mode-specific sizing was found. The row height alone was not the full component height.

The only application change reduces the shared row variable from 52px to 44px. All four destinations, including the existing separate Messaging slot, remain aligned with 44px touch targets. The full footer becomes 79px with a 34px portrait inset and 66px with a 21px landscape inset. Content clearance follows the same variable and remains footer height plus 8px. The protected home-gesture area remains; this is an 8px reduction, not a promise to eliminate that area.

## Safari

Chris confirmed the exact URL `https://tenops.pages.dev`, default 100% Page Zoom, and an old UPDATE/header remaining after reload. Fresh desktop- and iPhone-Safari-UA requests to both `/` and `/index.html` returned the current release's exact HTML and all 22 referenced JavaScript chunks. No chunk contained the retired announcement marker/title. HTML includes the device-width viewport with `viewport-fit=cover`, and `Cache-Control: public, max-age=0, must-revalidate`. The current service worker matches the released artifact, has `Cache-Control: no-cache`, and has no fetch interception or Cache API. Its earlier Git revisions also do not cache application responses. There is no user-agent or installed-mode shell branch that could restore UPDATE.

Chris then confirmed, after signing in with his existing account:

1. The diagnostic query URL `https://tenops.pages.dev/?releasecheck=83d0343` displayed the new UI in Private Safari.
2. The same URL displayed the new UI in regular Safari.
3. The plain canonical URL subsequently displayed the new UI in both regular and Private Safari.

This establishes that the physical Safari stale view recovered after requesting a fresh document URL; it was not the current release rendering the retired announcement. The exact cache layer (Safari versus the device's response path) was not captured on-device and remains unproven. No speculative cache-policy, authentication or service-worker change was made. Website data, device subscriptions and the installed PWA were not cleared or replaced.

## Focused validation

Tier 2 investigation with focused Testing Level 2 validation. Reused existing verifiers and local disposable fixtures; no accounts or hosted business data were created.

- Production-branded webpack build: passed; no `.env.local` in the isolated worktree. Existing public Production configuration reused without modification.
- TypeScript, targeted ESLint (MobileNavigation and the existing mobile verifier), and diff whitespace check: passed.
- Existing mobile-only verifier: 36 viewport/inset/display-size combinations passed, covering 393px-wide iPhone 15 Pro content viewport, larger representative iPhone widths, and landscape side insets. Full footer dimensions, 44px targets, hit testing, Messages alignment, body/content inset, scale and overflow checks passed.
- Jobs, My Work, More, Contacts and Messaging navigation passed. UPDATE absent, notification bell retained, selected More above the safe area, no startup replay after simulated focus/visibility events.
- Existing full startup playback verifier passed on the candidate export, with no page errors or external requests. The entire startup implementation/assets remain identical to baseline: 60% pre-split sparks, persistent black cut, 888ms hold, 850ms fade, skip and reduced-motion logic unchanged. Prior accepted skip/reduced-motion/authentication evidence is reused rather than rerunning unrelated suites.
- Portrait, landscape and selected-More screenshots inspected.

Evidence: [focused results](evidence/2026-10-21-pwa-footer-safari-review.json). Local review uses the actual exported app at `http://localhost:3000/`, served by the existing local-only fixture server. Original worktrees and unrelated root changes are preserved.

Limitations: viewport/safe-area checks use Chromium's native inset emulation, not a physical installed PWA. The attempted display-mode override did not match `standalone` and is not counted as installed-mode verification. WebKit is not installed locally; no browser installation was added. Chris has verified Safari recovery, but the smaller footer still needs physical-device review before release. Production Web Push, subscriptions, Contacts, backend configuration and all application source except the footer CSS variable are unchanged.
