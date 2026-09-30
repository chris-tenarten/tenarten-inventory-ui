# Sample Work Order PDF row ordering candidate

September 30, 2026. Local review candidate from canonical dev/main `907e4e7324db188a19341d8164ed26e320407aef`, isolated branch `fix/sample-pdf-row-order` at `/private/tmp/tenops-sample-pdf-row-order`. No hosted changes, migration, push or deployment.

## Root cause and correction

New drafts start with Aggregate, Filler, Resin and Hardener; later aggregate rows append to the raw array. The editor sorts a display copy by Formula Role, while buildSamplePdfModel previously mapped raw array order directly. Pagination correctly retained that incorrect sequence; there was no special first-page insertion.

The PDF model now stably sorts a copy by existing role before mapping and pagination: Aggregate, Filler, Other, Resin, Hardener, matching the editor's established treatment of Other. Within-role order is unchanged. Camel-case and snake-case snapshots are supported. Untyped legacy rows retain relative order in the Other position; no material-name/catalog classification inference occurs. No quantity, percentage, unit, vendor, formula, summary or input snapshot is modified. No pagination/layout code changed.

The shared model applies to newly rendered Working/Preview/Issued PDFs. Existing stored issued PDFs and snapshots were not regenerated, rewritten or migrated. An explicit future regeneration uses the corrected presentation order; captured formulation values remain authoritative.

## Concrete reproduction and review

The initially referenced `/mnt/data/Sample-Working.pdf` was unavailable. Chris identified the most recent library draft as the source. A narrow read recovered Sample `1c6c67ab-36e6-4e61-b40e-3775a0db47f7`, updated `2026-09-30T15:26:50.25141Z`, whose raw role sequence exactly matches the report. Exact current header, summary and rows were rendered locally with baseline and candidate models. Private header fields and generated documents are local ignored artifacts, not committed fixtures.

Review PDF: `/private/tmp/tenops-sample-pdf-row-order/output/pdf/Sample-Working-review.pdf`.

Before PDF: same directory, `Sample-Working-before.pdf`.

The corrected two-page review shows five aggregate rows on page 1 in order **40, 30, 20, 5, 5**, with **25.6, 19.2, 12.8, 3.2, 3.2 oz**. Page 2 begins **ATF - 20 (16 oz), 001 White (15 fl oz), Hardener (3 fl oz)**. Actual labels, sizes, types and vendors are preserved. The before/after model comparison proves the full row-value multiset and formulation summary identical.

Actual PDF pages were rasterized with PDF.js and visually inspected (system Poppler unavailable). The exact review's two pages and the continuation fixtures retain headings, borders, row heights, readable wrapping, footers and page numbering with no introduced clipping. Existing narrow-column wrapping remains unchanged. Eighteen aggregates span pages before the final three components; Resin and Hardener naturally split across pages. Forty-five aggregates span four pages and precede the tail. No keep-together whitespace was added.

## Validation and boundary

Tier 2 bounded rendering change; focused Testing Level 3 PDF checks because shared output composition affects generated documents. One implementation/self-validation pass and a final diff/evidence review. No data-contract or lifecycle changes warranted database replay.

Passed:

- New `node scripts/verify-sample-pdf-row-order.mjs`: one aggregate (4 rows/1 page), two (5/1), eighteen (21/3), supplied five-aggregate semantics (8/2), forty-five (48/4). Model equality checks every row field, stable order and input immutability; actual PDF extraction verifies full row contents, ordering, no duplicates/omissions, continuation markers and tail placement. Camel-case, repeated roles, Other, role-less legacy and issued render-context coverage included.
- `node scripts/render-sample-v4-density-profile.mjs` and `node scripts/verify-sample-work-order-pdf.mjs`.
- `node --import tsx scripts/verify-sample-pdf-overflow.mjs`: eight-page stress PDF, all tail markers preserved.
- `node --import tsx scripts/verify-sample-formulation-reactivity.mts`, `verify-sample-ratio-normalization.mts`, `verify-sample-formulation-calculations.mts`.
- TypeScript noEmit; targeted ESLint for regression script; no-config ESLint and syntax check for the normally ignored edge model; git diff --check.

PDF.js text extraction emitted its existing standard-font-data warning; all assertions passed. Rasterization explicitly supplied standard fonts. No app/browser interaction or hosted generation is claimed; review artifacts invoke the actual renderer locally. Production build passed with `npm run build -- --webpack` (22 static pages). The first build invocation using Node `--env-file` failed because Next worker NODE_OPTIONS rejected that flag; rerunning with the normal ignored `.env.local` link resolved the invocation issue. No application changes were needed.

Changed-file boundary: shared Sample PDF model; new focused verifier; this evidence record. Calculations, roles, catalog, managed profiles, persistence, working versions, issued snapshot semantics and Purchasing code remain unchanged. The separate Pool Mix and legacy-unit investigations are excluded.
