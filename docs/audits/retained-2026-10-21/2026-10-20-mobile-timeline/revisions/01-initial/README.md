# TenOps mobile Timeline research package

Start with [REPORT.md](REPORT.md). The preferred recommendation is Option A for a physical-iPhone/operator pilot, with **one shared mobile presentation for Production and Bids Planning** and separate module scheduling commands.

## Open the interactive review

The audit server is running at [http://localhost:3018](http://localhost:3018). Port 3000 and the Performance review process were left untouched.

- [Production](http://localhost:3018/production): committed Job schedules; explicit date review stages only a local demonstration.
- [Bids Planning](http://localhost:3018/bids): tentative projected windows; explicit date review changes only memory.
- [Bids Combined](http://localhost:3018/bids?source=combined): projections plus solid Production references. Production references offer Open Production and cannot be edited as Bid projections.
- Add `?readonly=1` to either primary context, or use the launcher persona switch, to inspect denied editing.
- [Original renderers](http://localhost:3018/reference.html): both existing components rendered unmodified with read-only offline shims and synthetic data. This omits the actual app shell.

**Gestures:** one-finger drag pans in both directions; two fingers pinch the date scale; tap/hold selects without changing dates. Visible Today, −/+, scale presets, Locate and Back provide essential alternatives. Help explains these controls. No inertia is simulated. Fixed review date: October 20, 2026.

No backend, credentials, real auth, hosted data or business writes exist here. All local edits reset on reload. The prototype does not perform real schedule Save All, Bid conversion or Job creation. Physical Safari, Home Screen, edge swipe and keyboard behavior require testing. The prototype's read-only switch is not a live RBAC test.

## Package contents

- `REPORT.md`: both existing implementations, shared architecture, module-specific differences, gesture findings, A versus C, risks and proposed first increment.
- `screenshots/`: 23 final actual-browser prototype/reference captures, including portrait and landscape for both contexts.
- `prototype/`: isolated presentation source, module adapters, synthetic fixtures and explicit offline reference shims.
- `dist/`: standalone bundled prototype and reference page. No external asset/network dependencies.
- `evidence/browser.json`: 17 passing focused browser groups; geometry, network methods and client errors.
- `evidence/adapters.json`: 6 passing module/helper compatibility groups.
- `evidence/source-capabilities.md`: numbered source excerpts supporting the capability assessment.
- `evidence/source-boundary.json`: canonical source hashes and unchanged tracked-source receipt.
- `evidence/bundle-inputs.json`: exact imported module inventory for both bundles.
- `evidence/validation.json`, `SHA256SUMS.txt`: artifact/link/isolation verification and integrity.

## Restart or reproduce

After unzipping, `node serve.mjs` serves the included `dist` on **localhost:3018** using Node's standard library. From the repository, use `node docs/audits/2026-10-20-mobile-timeline/serve.mjs`. The static server rejects business POSTs and sets a CSP with `connect-src 'none'`; do not point it at a hosted service or deploy it as TenOps.

Rebuilding requires this repository and its existing installed esbuild/PostCSS/React dependencies: `node docs/audits/2026-10-20-mobile-timeline/build.mjs`. It only writes the isolated `dist` and bundle inventory. Reproduction checks use the installed Playwright Chromium: `node docs/audits/2026-10-20-mobile-timeline/verify.cjs` and `./node_modules/.bin/tsx docs/audits/2026-10-20-mobile-timeline/verify-adapters.mjs` while the server is running. Checks overwrite research evidence/screenshots only.

The first proposed implementation increment is read-only full-screen presentation for both contexts, connected to existing authorized controllers. Explicit mobile date editing is a later approval boundary. Desktop, persistence, authorization, conversion and historical contracts remain unchanged. Stop for Product/Architecture review.
