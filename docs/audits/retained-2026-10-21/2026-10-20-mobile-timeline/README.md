# TenOps shared mobile Timeline research

The current review is the **visual semantics and identification refinement**:

- [Current refinement report](refinement/REPORT.md)
- [Interactive review](http://localhost:3018) — refresh the page to load the update.
- [Production](http://localhost:3018/production) / [Bids Planning](http://localhost:3018/bids) / [Combined](http://localhost:3018/bids?source=combined)
- [Current screenshots](refinement/screenshots/production-portrait.png), [Key](refinement/screenshots/production-legend.png), [phase inspection](refinement/screenshots/production-phase-inspection.png), [full identity](refinement/screenshots/production-expanded-names.png), [landscape](refinement/screenshots/production-landscape-indicator.png)
- [Current browser evidence](refinement/evidence/browser.json) / [adapter evidence](refinement/evidence/adapters.json)

Thin colored spans are Job Planning phases, black/white hatched spans are Planning pauses, and green/white main-bar stripes mean Production status On Deck. The Key and tap inspection explain these distinctions. Names + temporarily widens pinned names; selected identities wrap completely on the map. Requested delivery is shown only for Jobs without complete Production dates, matching existing source behavior.

One shared surface still serves both contexts. Pan/pinch/tap/hold never reschedules. Production edits stage only a local demo; Bids edits only an in-memory projection. Combined Production references retain Open Production and cannot be edited as projected Bids. No real auth, backend, hosted data, conversion, saving or deployment is present. Physical Safari acceptance remains pending.

## Preserved initial work

The [initial feasibility report](REPORT.md), original `evidence/` and original `screenshots/` are historical evidence. The initial prototype, generated bundles, reports, receipts and scripts were also archived together in [revisions/01-initial](revisions/01-initial/README.md), with [preservation hashes](refinement/evidence/preserved-initial.json). The separate original handoff ZIP was not overwritten. The comprehensive mobile audit is unchanged.

Current `prototype/` and `dist/` contain the refinement. Current bundle and verification receipts are under `refinement/evidence/`. The new package is `2026-10-20-mobile-timeline-refinement-handoff.zip` alongside this folder. `SHA256SUMS.txt` describes the current complete package; the original manifest is preserved in the archive.

## Run or reproduce

The existing local static server remains at localhost:3018; port 3000 was untouched. Restart from this folder with `node serve.mjs`, or from the repository with `node docs/audits/2026-10-20-mobile-timeline/serve.mjs`. Included `dist/` needs only Node's standard library to serve. The server permits local GET/HEAD only and sets `connect-src 'none'`.

Rebuilding requires this repository and its existing dependencies: `node docs/audits/2026-10-20-mobile-timeline/build.mjs`. Current focused validation uses `node docs/audits/2026-10-20-mobile-timeline/verify-refinement.cjs` and `./node_modules/.bin/tsx docs/audits/2026-10-20-mobile-timeline/verify-refinement-adapters.mjs`. The server must be running. Checks write only the refinement's evidence/screenshots. `python3 docs/audits/2026-10-20-mobile-timeline/validate-refinement.py` verifies and packages the artifacts.

The Key explains gestures and indicator meanings. To inspect requested delivery, filter Production to 26-1026. For full-name review, filter to 26-1004; for Planning-only references, use Combined and filter to 26-1001. Add `?readonly=1` to a primary context to compare denied editing. All fixtures are synthetic, with a fixed October 20 review date.

Stop for Product/Architecture review. Application implementation, canonical branch changes, push, merge, deployment and hosted mutation remain outside this authorization.
