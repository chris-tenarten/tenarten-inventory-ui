# Mobile audit handoff package

Start with [REPORT.md](REPORT.md). All proposals are unapproved; no application implementation or release was performed.

- [Proposal board PNG](proposals/mobile-patterns.png) / [editable SVG](proposals/mobile-patterns.svg): four static mobile patterns.
- `screenshots/`: 46 actual-app viewport captures, all using local synthetic data.
- `evidence/repository-boundary.json`: canonical and Performance boundaries, export provenance and initial dirty-state receipt.
- `evidence/baseline-browser.json`: 15 route captures, visible text, geometry and visible-control sizes.
- `evidence/workflows.json`: draft/task/conversation/photo/detail interactions, internal overflow measurements and recorded limitations.
- `evidence/responsive.json`: 320/430px, Timeline portrait/landscape, actual label dialog and navigation menu.
- `evidence/interactions.json`: Inspector, Messaging, Notifications and unsaved PO interactions, with local RPC responses.
- `evidence/source-index.md`: selected canonical responsive/surface code evidence with paths and line numbers.
- `evidence/local-requests.json`: synthetic server observations; not a hosted HAR or Production performance benchmark.
- `evidence/validation.json` and `SHA256SUMS.txt`: artifact validation and integrity.

## Interpretation cautions

Read the report's evidence legend and coverage gaps. Chromium mobile emulation is not Safari or physical iPhone verification. The short Messaging viewport is not a real keyboard test. Libraries without seeded records are entry/empty-state coverage only. No actual send/upload/save/issuance, hosted session, populated notification deep link or financial/security policy test was performed.

`proposal-editor.png` shows the deliberate local creation denial, not a confirmed application defect. Sample screenshots may show a blocked Production Blend Edge request; the error is fixture-induced. `job-inspector.png` has normalized synthetic missing fields counted as unsaved; do not infer a real-data dirty-state issue. Source-baked example placeholders in the stock movement UI remain visible; these are not retrieved personnel records.

`sample-calculation.png` records the calculation-control interaction. `sample-label-actions.png` is an intermediate capture and does not prove the label dialog opened; use **`color-label-dialog.png`** for that evidence. `job-updates.png` is an early wrong-selector capture; use **`job-updates-tab.png`**. The initial Timeline selector failed in `workflows.json`; the later successful captures/interaction are in `responsive.json`. WebKit was unavailable and is recorded as a gap. These attempts are retained for transparent provenance, not counted as passed gates.

## Optional reproduction in this repository

The handoff is self-contained for reading and advisory review; it does not bundle the application export or dependencies. Reproduction scripts require this repository, installed Playwright Chromium and the **existing clean canonical local-API export** at `.tmp-auth-refocus/source/out`. They must not be pointed at a hosted API. The audit adapter changes only the localhost API port in served JS to 3017, creates a synthetic session, and denies business mutations and Edge generation. Browser contexts also abort external destinations. Its synthetic admin persona does not test actual RBAC.

Start `node docs/audits/2026-10-20-mobile/evidence/local-review-server.mjs`, then run `capture.cjs`, `interact.cjs`, `workflows.cjs` and `responsive.cjs` from this directory using Node. These scripts overwrite audit evidence/screenshots only. `interact.cjs --board` renders the static SVG. Port 3000 was left untouched; this internal audit used 3017. Do not use these fixture exports/transports as deployment artifacts. The audit-owned server was stopped after capture.
