# Selected mobile footer background / physical PWA review

Local candidate on `fix/mobile-safe-area-background`, based on verified canonical main/dev `c490747c08404a3b2877538404d9af8bf98460a6`. No push or deployment.

## Footer cause and correction

The white region is the fixed navigation element's own 34px bottom safe-area padding. On the physical iPhone 15 Pro, the viewport is 393×793 CSS pixels at scale 1 and DPR 3. The footer is 79px tall and ends at y=793; its selected 44px control ends at y=759. The navigation background is white, while the selected control is blue. This is a background-coverage defect, not excess row height or duplicate body padding.

The selected control now paints an inherited-color `::after` background through the native bottom inset. It has no pointer events. Control height, footer height, content clearance, navigation behavior and icon/label positions are unchanged. The same rule covers Jobs, My Work and More-selected modules such as Inventory. Portrait remains 79px total; landscape with a 21px inset remains 66px.

The exact CSS was temporarily previewed in the affected physical PWA through Safari Web Inspector. Its blue fill ended at y=793 while controls remained 44px high. Chris confirmed that the footer now looked correct with labels above the home indicator. The temporary style and diagnostic samples were removed after review; this did not publish the candidate.

## PWA version investigation

Chris created the new app from `https://tenops.pages.dev` after the cut-line release and reported the missing line after closing/reopening. Inspection of that actual Home Screen app established:

- Launch URL `https://tenops.pages.dev/`, standalone mode true, default display size/light appearance.
- Loaded layout `app/layout-8c5c3ff75b515a0a.js` and CSS `84d202a076eb9b29.css` match the current canonical release. Its actual loaded Webpack factory contains the corrected `if(e<t.start||e>1630)continue` condition, without the old completed-path expiry.
- No service-worker registrations or Cache Storage entries in this new PWA. These were read only; no subscriptions or site data were cleared.
- One replay using the existing introduction handler retained black canvas pixels `[14,10,8,247]` at point `[207,230]` at both 2400ms and 2600ms of transformation. Chris confirmed the cut line was visible in that replay.
- Fresh iPhone-UA requests to root, My Work, Inventory, both installation pages, both manifests and the worker matched the deployed artifact; all 29 referenced client assets matched too. Production deployment remains `e183bfd2-02a6-47c0-94be-e39fdfb22e0f`, revision `c490747c08404a3b2877538404d9af8bf98460a6`.

Both existing manifests launch `/` with scope `/`; their IDs remain `/my-work` and `/`. [WebKit documents multiple installation identities](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); that is not evidence that an installation pins old JavaScript. Neither manifest, caching policy nor startup code was changed. The earlier visually missing line was not reproduced in the inspected running app, so its historical cause is not established and no cache workaround is justified.

## Focused validation and preservation

Tier 1 / Testing Level 1. Existing mobile verifier passed 36 viewport/inset/display-size combinations, selected-background coverage, unchanged geometry/touch targets, Jobs/My Work/Inventory/Contacts/Messaging navigation and no refocus startup replay. Light/dark portrait screenshots and a fresh landscape screenshot were inspected. Physical PWA background preview and cut-line replay were confirmed by Chris. Production build including TypeScript, separate TypeScript check, targeted ESLint and diff check passed. One verifier attempt used the wrong Inventory label; corrected to the existing “Current Inventory” label and passed.

No new test harness, worktree, account, migration, hosted business-data mutation or deployment. Startup timing remains 60% pre-split speed, 888ms hold and 850ms fade. Authentication, Web Push implementation/subscriptions, Contacts, manifest identity and backend configuration are unchanged.

[Evidence receipt](evidence/2026-10-21-mobile-safe-area-background-review.json). Local review: `http://localhost:3000/` using the existing disposable local fixture server. Physical preview was removed; the live site retains its released CSS until a release is approved.
