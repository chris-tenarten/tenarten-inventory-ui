# DYMO 30256 print convenience — local Product review

Candidate: uncommitted `feature/dymo-print-qol` at `/private/tmp/tenops-dymo-print-qol`, based on released canonical `535164204195c457f9a484eef0db7e61e14ed778`. No commit, push, deployment, migration, Edge change, permission change, hosted business-data write, printer-settings mutation or new print integration.

Chris reports Anthony successfully printed a physical label directly from the released TenOps preview, with the workflow well received. Chris clarified Anthony uses **Windows and must select 30256 every print**, not merely after Chrome restart. This supersedes the older worksheet's wholly pending physical-test status, but it is an operator report, not an independent print/measurement/retention test in this session.

## Findings and feasibility

The established output is correct and unchanged: PDF page/MediaBox `[0, 0, 288, 166.5]` points, 4 × 2 5/16 inches, wide orientation, no page rotation; `doc.addPage([LABEL_WIDTH, LABEL_HEIGHT])` creates that page. Primary Print uses the SVG in a standalone HTML tab, not the fallback PDF. Its CSS specifies `@page{size:4in 2.3125in;margin:0}` and matching body/SVG dimensions. Current renderer and field-source hashes match the prior preservation evidence exactly (`ac1fea…` / `7ab49d…`); accepted PDF/browser-size results are reused. No label generation/PDF suite was rerun.

The application requests physical page dimensions; it cannot name/select the Windows driver's **30256** stock, force a printer destination, change queue defaults, or promise Chrome persistence. [CSS Paged Media](https://www.w3.org/TR/css-page-3/#page-size) distinguishes page-box layout from browser transfer to a physical sheet. No output metadata or CSS correction is warranted from the available evidence.

[Current Chromium print-preview source](https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/resources/print_preview/data/model.ts) includes `mediaSize` among sticky settings, serializes settings selected through UI, and also initializes media from printer capabilities/defaults and applies policy overrides. Remembered settings exist, but this is not a guarantee for Anthony's Chrome version, driver, printer queue or profile. Opening the existing standalone print tab does not introduce a setting that selects a different stock.

**Automatic 30256 selection is feasible through a correct saved printer/driver default and compatible Chrome behavior; it cannot be guaranteed by ordinary TenOps page code.** The exact root cause of the repeated reset is **not established** without Anthony's workstation. There is no apparent application page-size defect. Remaining candidates are Chrome state/policy/destination selection, the Windows per-user queue default, or DYMO driver default reporting. Do not label this a confirmed DYMO/Chrome bug or infer that a local service is necessary.

## Recommended Windows setup — one-time setup person task

1. In Windows, open the actual **DYMO LabelWriter 550** queue's **Printing Preferences** (Windows 11: Settings → Bluetooth & devices → Printers & scanners → DYMO LabelWriter 550 → Printing preferences; Windows 10 may use Manage first). Use the same queue Anthony selects in Chrome.
2. In **Advanced → Paper Size**, choose the offered **30256 / 30256 Shipping** stock matching 4 × 2 5/16 inches. Click **OK**, then **Apply/OK**. Confirm the saved choice by closing and reopening Printing Preferences. Menu/stock wording depends on the installed driver. No custom paper size is proposed.
3. Return to normal TenOps Print. Select that same DYMO destination and 30256 once if Chrome still has a previous choice. Keep the currently successful physical orientation/scale/margins; do not change working output settings speculatively. Print a second label and reopen Print to inspect retention.
4. Restart Chrome in the same Windows account/profile and recheck. Optionally repeat after Windows restart. Record Windows/Chrome/DYMO driver versions and actual queue/stock names.

[DYMO's official Windows guidance](https://www.dymo.com/support?cid=software-faqs) documents Printing Preferences → Advanced → matching label size → OK/Apply for third-party printing. That FAQ section names older 450/4XL printers, so the menu path is guidance to confirm on Anthony's installed 550 driver, not a newly verified 550-specific screen. His successful print already establishes the stock is selectable. No driver reinstall/update is required by this finding; if stock is missing, inspect installed driver/queue identity and supported [DYMO downloads](https://www.dymo.com/support?cfid=user-guide) before proposing a change.

If Windows preferences reopen with a different size, investigate OS/queue/driver persistence (C/D). If they retain 30256 while Chrome alone resets, compare the same queue through Chrome's system dialog for diagnosis and record Chrome version/profile/policy (B). This diagnostic is for the setup person, not a new daily operator step. Changing the system-wide default printer is unnecessary; a default printer and a default stock are separate settings. Do not add extensions, silent/kiosk printing, SDKs or local services for this issue.

## Local application change

The authorized label editor alone shows:

> Select DYMO LabelWriter 550 and label size 30256 the first time you print.

**Got it** dismisses it and saves a versioned preference in this browser/origin's localStorage. It is workstation/browser scoped, independent of user permissions. It does not claim to save a printer setting. There is no new dialog or mandatory acknowledgement before Print. If storage is unavailable, dismissal still works for the current editor visit; clearing browser data/new profiles can make the hint appear again. The hint stays outside printed label content. Print popup, page CSS, PDF, authorization checks, Sample editing and download fallback logic are preserved.

## Focused validation and review URL

Tier 2 / focused Testing Level 2 because the small presentation change remembers a browser preference. PASS: six focused Chromium checks in `scripts/verify-dymo-print-qol-browser.mjs`: no global instruction; contextual first-use hint with Print available; dismissal across reopen/reload; saved-state context recreation; narrow editor layout; blocked-storage fallback. Context recreation simulates a browser restart for **hint persistence**, not native Chrome printer-settings persistence. Desktop and scrolled narrow screenshots inspected. PASS: targeted ESLint, TypeScript via webpack Production build, and diff check. No broad Sample/auth/database/calculation/PDF/native-print suite repeated. [Evidence receipt](evidence/2026-10-14-dymo-print-qol.json).

Local manual review: **http://localhost:3000/samples?open=00000000-0000-0000-0000-000000000056**. Port 3000 was inspected and free; no existing process was stopped. The actual exported TenOps UI uses a synthetic read-only local session with a fixture label grant, through a loopback adapter. It creates no database and forwards nothing to hosted services. It is not a print service and does not prove authorization or hardware behavior. Enter Chips wording to see the prepared label and Print action. Run `node scripts/start-dymo-print-qol-review.mjs` from this worktree to restore the review server; current server is left running. Do not run this adapter against Production.

## Exact changed files

- `src/modules/samples/ColorPlateLabelEditor.tsx` — contextual tip and optional dismissal persistence only.
- `scripts/start-dymo-print-qol-review.mjs` — isolated read-only UI fixture adapter, adapted from the existing portable local review pattern.
- `scripts/verify-dymo-print-qol-browser.mjs` — focused hint behavior checks.
- `docs/project-memory/2026-10-14-dymo-print-qol-review.md` — findings, setup guidance and Product boundary.
- `docs/project-memory/evidence/2026-10-14-dymo-print-qol.json` — focused results. Ignored screenshots under `output/dymo-print-qol/`.

Remaining physical verification: save 30256 on Anthony's Windows queue, confirm repeated-print/restart retention in Chrome, and confirm existing successful physical output remains correct. No independent DYMO test occurred here. Product must approve any release of this local UI change; none is authorized. Stop for Product review.
