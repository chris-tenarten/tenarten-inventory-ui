# Sample Color Plate Label Generator — local Product review

Chris authorized a new local implementation combining the original specification and October 13 printing-simplicity addendum. Primary workflow: Open Sample → **PRINT COLOR PLATE LABEL** → Review → **Print**. PDF download is secondary. No hosted writes, new migration, push, deployment, release, new approval lifecycle, or print service is authorized.

## Candidate boundary

- Branch: `feature/sample-color-plate-label-generator`.
- Worktree: `/private/tmp/tenops-sample-color-plate-label-generator`.
- Latest fetched canonical `origin/main` and candidate HEAD: `1866efe4f862621513c0a45def9cc249286805f2`.
- Candidate changes are **uncommitted**; there is no new candidate commit SHA. No staging or commit was authorized/performed.
- Main checkout preserved. Port 3000's former TenOps review process was identified by its working directory and local evidence endpoint, then replaced with this isolated candidate. No unrelated process was stopped.
- Risk Tier 3; focused Testing Level 3 because PDFs, explicit approval evidence, private Sample data and unchanged persistence contracts matter. No schema/auth-policy/canonical-record change is included.

## Implementation and product behavior

The action sits beside the existing Sample Work Order action in `SampleWorkspace`. Its editor and PDF library load only when requested. A native modal contains seven plain-English fields, required-field feedback, an inline label preview, primary Print and secondary Download PDF. Escape/Cancel return to the Sample. Long wording produces an actionable error rather than truncation or unreadably shrinking the critical text.

Print opens a transient standalone label tab synchronously from the operator's click and immediately requests the browser print dialog once fonts are ready. It neither downloads nor imports a file. A blocked popup has an actionable retry message and preserves edits. No silent printing is assumed. Retrying replaces the previous transient print tab; closing the label editor closes its remaining print tab. The application does not claim that a label was physically printed.

The primary browser view and PDF fallback share measured text positions and wrapping. Browser CSS requests 4 × 2 5/16 inches with no page margins; content keeps 9-point side margins. PDF geometry is exactly **288 × 166.5 points**, landscape, one page. Material text has an 8-point floor, project 7.5-point floor and plate identifier 11-point floor; fixed disclaimer text is 6.5 points. Unsupported characters receive a validation error. Label text is HTML-escaped before SVG rendering.

The supplied front photograph establishes centered company identity, italic manufacturing subtitle, address/telephone line, project/date row, boxed prominent plate number, bold matrix/chips/size/finish rows, two-line disclaimer and contact. The supplied back photograph confirms DYMO item 30256 and 2 5/16 × 4 inches (59 × 102 mm). The candidate follows this hierarchy and wording, with standard Helvetica/Arial typography rather than claiming an exact historical font match. Representative normal, draft and wrapped PDF renders were visually inspected.

## Approval and field authority

`SampleRecord.approvedDate` / `samples.approved_date` is an existing explicit field. The label reuses that evidence; it does not infer approval from saving, document generation or creation dates. No approval field/lifecycle is added or changed. A Sample without that date receives a visible draft warning and a **DRAFT COLOR PLATE** identifier in both print and PDF output. Entering a label date does not approve the Sample.

| Label field | Initial source |
| --- | --- |
| Project | Current Sample `projectName`; no new Bid/Job fetch or invented relationship |
| Color Plate number | Current Sample `colorPlateNumber`, preserving wording |
| Label date | Explicit Sample `approvedDate`; otherwise visibly missing |
| Matrix / color | `resinColorNumber`, plus existing `resinSupplier` when present; supplier alone does not establish a matrix |
| Chips | Operator wording required; never derived from percentages, SKUs or aggregate colors |
| Chip sizes | Distinct authored aggregate-row `size` strings, preserving wording; no inferred NTMA classification |
| Finish / sealer | Existing `finishRequested` and `sealer`, joined for review; no formulation inference |

All label edits live only in the modal. They do not call save/issue/history/Storage endpoints or update formulation, aggregate percentages, preparation quantities, dimensions, Resin System, approval or manufacturing instructions. Reopening resets to the current Sample. Labels are transient, not issued documents; persistent overrides, immutable captures and history remain deferred.

## Permissions

The existing authenticated app shell and Sample loading/RLS remain the data boundary. The label receives only the already-loaded Sample and requires existing `readOperationalData` plus allowed account access. There is no new backend, token flow, shared URL containing Sample data, permission capability or bypass. Label presentation editing is local and does not require a business-data write. Inactive account denial is covered in browser checks. No hosted permission state was inspected or changed for this feature.

## DYMO research and remaining acceptance gate

1. **Browser dialog:** the initial candidate uses standard browser printing. [MDN's print API](https://developer.mozilla.org/en-US/docs/Web/API/Window/print) opens a dialog; it offers no printer-selection or silent-print parameters. [CSS page size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40page/size) specifies the page box, not proof of an installed DYMO driver's retained paper settings. Local Chromium PDF output with CSS page size enabled was checked separately from the native dialog.
2. **Existing DYMO software/driver:** normal OS printing needs a working installed driver. Proposed workstation setup is supported DYMO Connect/driver installation, connecting the 550, loading authentic compatible 30256 stock, and one-time printer/stock/orientation/actual-size/header setup if required. Whether these settings persist must be tested on Anthony's actual workstation. Repeated technical setup is not accepted as the intended shop workflow. Manually downloading/importing each label into DYMO software is not the primary path.
3. **Supported browser integration:** DYMO's [SDK page](https://www.dymo.co.uk/online-support-sdk.html) links its Connect Framework Web SDK. The [official framework README](https://github.com/dymosoftware/dymo-connect-framework) lists DYMO Connect Software as a prerequisite and provides printer discovery, label XML rendering and printing. The [vendor certificate article](https://help.dymo.com/s/article/Reinstalling-the-Web-Service-Certificate?language=en_US) concerns the local DYMO Connect service; its full page body did not render during research, so exact certificate-repair steps are not claimed as verified. The [vendor compatibility chart](https://newellbrands.imgix.net/a6568e21-953c-3b37-8405-123fd5c15799/a6568e21-953c-3b37-8405-123fd5c15799.pdf) lists 30256 Large Shipping stock at 2 5/16 × 4 inches.
4. **Local dependency:** direct supported browser printing would require **DYMO Connect Software and its running local service**, plus the JavaScript SDK and a separately validated DYMO label representation. It is not a generic PDF print API. If Product approves it, workstation steps would be install supported Connect software, connect/load the 550, verify service/certificate trust, permit required browser local access if prompted, discover/select the printer, and physically test output. Exact prompts and version compatibility require the shop OS/browser. No service, SDK integration, proprietary label format or custom bridge was installed or implemented.

Chris confirmed his current machine is not connected to the DYMO; Anthony's will be. Native Chrome opened the correct one-page label without downloading. With the existing **non-DYMO** destination, Chrome retained Letter paper and browser headers, even for the standalone view. This is a material limitation: automatic DYMO paper retention and settings-free printing are **not established**, and the printing approach is not finalized for acceptance. Do not infer failure or success of the DYMO driver from that unrelated printer. The supported alternative has been investigated before this review checkpoint.

Anthony's gate: use the actual LabelWriter 550 with authentic 30256 stock; open Sample → Print Color Plate Label → review → Print. Confirm one physical label, correct orientation and size, no cropping, readable text, no browser headers, appropriate margins, and retained settings after cancel/retry, new Sample and browser restart. If settings cannot be retained reliably, return the supported DYMO Connect dependency to Product before adopting it. Final approval of printing simplicity requires that workstation evidence.

## Verification status

- **PDF generation verified:** focused fixtures validate exact geometry, one page, extracted fields/date/plate, draft marking, wrapping, clipping bounds, missing fields, long-text rejection, unsupported characters, escaped markup and unchanged source data. Normal/draft/wrapped renders inspected. Poppler is unavailable locally; PDF.js and its installed canvas renderer were used for PNG inspection.
- **Browser workflow verified:** actual exported application at exact `http://localhost:3000`, safe disposable PostgreSQL adapter with no hosted credentials/forwarding. Primary print creates a ready standalone document and requests print without a download; native Chrome dialog observed and cancelled without sending a job. Headless regression tests instrument print() separately, verify CSS-sized PDF output, popup-block recovery, retry, secondary PDF, mobile widths 1440/390/320, cancel/focus/reset, and zero label persistence calls with complete Sample/formulation/history equality.
- **DYMO driver compatibility not verified:** printer disconnected, per Chris. No claim about installed DYMO behavior.
- **Physical printing not verified:** reserved for Anthony/Chris.
- **Adjacent regression:** library loading, new draft label preview, saved Sample creation and existing Sample Work Order generation are checked through the disposable local adapter. Existing canonical SQL contracts are reconstructed only in that disposable test database; no hosted migration was applied and no migration file changed.
- TypeScript, targeted ESLint, Production webpack build with `NEXT_PUBLIC_DEV_BRANDING=false`, branding verifier and final diff checks **passed** for this candidate. The ordinary Turbopack command failed on its worktree-external `node_modules` symlink; the successful webpack build uses the same source and Production configuration without altering repository build settings.

## Changed source and documentation files

- `package.json`
- `package-lock.json`
- `src/modules/samples/SampleWorkspace.tsx`
- `src/modules/samples/ColorPlateLabelEditor.tsx`
- `src/modules/samples/color-plate-label-fields.ts`
- `src/modules/samples/color-plate-label.ts`
- `scripts/start-color-plate-label-review.mjs`
- `scripts/verify-color-plate-label.mts`
- `scripts/verify-color-plate-label-browser.mjs`
- `docs/project-memory/2026-10-13-sample-color-plate-label-review.md`

`pdf-lib` moves from development to production dependencies without a version change. No other dependency is added. Generated local review evidence is under ignored `output/pdf/color-plate-label/`; built application output remains ignored. No environment file was copied into the isolated worktree.

## Reproduction and review

Build with local-only environment:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://localhost:3000 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-review-only NEXT_PUBLIC_RBAC_MODE=enforced NEXT_PUBLIC_DEV_BRANDING=false npm run build -- --webpack
```

After inspecting port 3000 ownership, start `./node_modules/.bin/tsx scripts/start-color-plate-label-review.mjs`. This starts a disposable Docker database and serves the real exported application. Current review URL: `http://localhost:3000/samples?open=5698d0ba-2dea-4a60-b583-cd97cbf876e2`. Its generated URL on a future restart is in `/private/tmp/tenops-color-plate-label-review/server.json`. Run `./node_modules/.bin/tsx scripts/verify-color-plate-label.mts`, `node scripts/verify-color-plate-label-browser.mjs`, `node scripts/verify-dev-branding.mjs`, TypeScript, targeted ESLint and `git diff --check`.

Stop at Product review. No commit, hosted write, hosted migration, push, deployment, release or external announcement is authorized by this candidate.
