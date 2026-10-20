# Reusable Timeline research source

Copied from the October 20 refined research handoff into the isolated mobile candidate. The original research reports, screenshots, initial revision and ZIPs remain untouched in the main workspace.

Product corrections in `prototype/app.jsx` and `prototype/style.css`: primary bars use Job/Bid names; main and phase labels remain fixed inside their own geometry and clip naturally. Short bars truncate or omit visible text. Full identity remains in selection details. Status and scheduling semantics are unchanged.

Build locally with `node docs/audits/2026-10-20-mobile-timeline/build.mjs`. Generated bundles are intentionally ignored. The prototype is an offline simulation, not the Product application. Review the actual integrated candidate at http://localhost:3020 instead. Its shared presenter and separate adapters are under `src/components/mobile/` and the existing Production/Bids modules.
