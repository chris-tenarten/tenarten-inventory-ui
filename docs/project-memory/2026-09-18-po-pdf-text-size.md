# Purchase Order PDF text size — engineering evidence, 2026-09-18

Historical implementation-stage evidence below. Migration 002 was subsequently applied by Chris and verified; see `2026-09-18-po-text-size-hosted-release-gate.md` for current status.

Implemented locally on dev; Tier 3 (additive schema and immutable snapshot capture). Chris's attached Purchase Order-only acceptance request is the authorization. No commit, push, deployment, hosted data write, or hosted migration application was performed. Concurrent Sample edits in this working tree belong to separate work and were not edited by this task.

## Editor and preference contract

A compact PDF Text Size segmented control sits beside Preview Draft PDF. Compact / Standard / Large use 44px touch targets, pressed-state accessibility, and English/Spanish labels. It wraps at narrow widths and is disabled while saving, previewing, or issuing. Issued records do not expose an editable selector. Existing save-before-preview behavior saves, reloads, and then sends the effective preference to the PDF renderer.

Shared `normalizePdfTextSize` accepts `compact`, `standard`, `large`; absent/invalid read or render inputs resolve to Standard. Database writes reject explicit invalid/null values. Legacy save requests omitting the field preserve an existing preference. Historical NULL preferences resolve to Standard without backfill.

## Typography in points

| Role | Compact | Standard | Large |
| --- | ---: | ---: | ---: |
| Line values | 5.6 | 6.2 | 8 |
| Line leading | 7.2 | 8 | 10.5 |
| Address/contact/Ship To/payment/date values | 6.3 | 7 | 9 |
| Body leading | 8.1 | 9 | 11.5 |
| Job identity, PO metadata, ordinary totals, authorization | 7.2 | 8 | 10 |
| Vendor name | 7.7 | 8.5 | 10.5 |
| Vendor name leading | 9 | 10 | 13 |
| Field labels | 5.6 | 6.2 | 7 |
| Seven-column headers | 4.8 | 5.2 | 6.2 |
| Notes | 7.2 | 8 | 10 |
| Notes leading (summary / continuation) | 9 / 10.8 | 10 / 12 | 13 / 15 |
| Grand total | 8.1 | 9 | 11 |
| PO number | 9 | 10 | 11 |

Definitions are centralized in `supabase/functions/_shared/purchase-order-pdf-model.mjs`. The 18pt title, branding/logo, section bands, draft watermark, and 6pt footer/page metadata retain their hierarchy. Page size and seven-column geometry are unchanged. No completed PDF/canvas scaling occurs.

## Layout and visual acceptance

Typography feeds measured wrapping, long-token splitting, identity block heights, row heights/fragments, notes capacity, and pagination. Summary values wrap in measured rows. Large moves payment/date values below their labels when needed. Metadata wraps and moves the header separator and following blocks down. Continuation headings wrap within their available width.

Exceptionally long identity fields retain their initial lines and explicitly point to labeled detail continuation pages containing all remaining text. This reserves space for the line table and footer without adding input limits. Ordinary identities keep the original form arrangement. All issued PDF downloads still retrieve their stored artifact.

Six required artifacts are in `output/pdf/`:

| Fixture | Compact | Standard | Large |
| --- | --- | --- | --- |
| Normal | `purchase-order-normal-compact.pdf` (1 page) | `purchase-order-normal-standard.pdf` (1 page) | `purchase-order-normal-large.pdf` (1 page) |
| Long/mixed | `purchase-order-long-mixed-compact.pdf` (5 pages) | `purchase-order-long-mixed-standard.pdf` (5 pages) | `purchase-order-long-mixed-large.pdf` (9 pages) |

The fixtures include Chip, Resin, Pigment, Filler, Other; long descriptions and unbroken contact strings; address/Ship To lines; notes; and extractable tail markers. Compact visibly reduces content sizes and fits more description text on each page, though this fixture still needs five pages. Large visibly increases content sizes and reflows across nine pages.

The normal Standard PDF is byte-identical to the pre-change renderer at starting commit `3ed0b50`, using the same fixture, logo, and generation date. SHA-256: `ce8a44e02d567d4424508cb2571edf2795f16ef1d97d7a340d821b8913b72682`. This digest is asserted by the overflow verifier. Standard's extreme overflow behavior additionally gains safe detail pages and wrapped continuation headings.

Additional `purchase-order-identity-overflow-{compact,standard,large}.pdf` stress artifacts contain 3/4/6 pages. Full tail preservation and horizontal/footer bounds pass. These are QA artifacts, not historical issued documents.

All six required PDFs were rendered with the repository PDF.js/canvas renderer and visually reviewed, including continuation/summary pages. Compact, Standard, and Large are visibly distinct; no clipping, overlap, broken borders, or footer collisions were observed in these fixtures. The extreme Large identity pages were also visually inspected. PNGs and desktop/mobile editor screenshots are under `tmp/pdfs/`. Poppler is not installed; the existing repository renderer was used.

## Persistence, issuance, and migration

`supabase/migrations/20260918_002_purchase_order_pdf_text_size.sql` is NEW and UNAPPLIED to hosted databases. Identifier 002 avoids concurrent Sample migration 001.

It adds one nullable checked `purchase_orders.pdf_text_size` column. It narrowly patches the existing draft-save function to validate and persist the preference atomically with draft content, retaining installed function attributes and grants. It adds the effective preference to future issuance JSON before the existing hash calculation. Guarded patch insertion points fail closed if the installed function differs. Existing issuance snapshots, hashes, and PDFs are not updated. No RLS/grant changes or new public RPCs are introduced.

A disposable PostgreSQL 17.6 test executed the migration against fixture tables and repository save/snapshot function definitions. It verified all presets, reload/preservation semantics, invalid/null rejection, legacy Standard fallback, inclusion in the snapshot hash, unchanged historical snapshots, inability to edit issued preferences through draft save, and retained execute grants. The legacy core authorization implementation is stubbed in this fixture; hosted RBAC/schema behavior was not claimed or tested.

## Validation outcomes

Passed:

- `node scripts/verify-purchasing-pdf.mjs` — model/permanent PDF compatibility.
- `node scripts/verify-purchasing-pdf-overflow.mjs` — nine PDFs; Standard byte compatibility; all presets/default/invalid normalization; seven headers; tail markers; horizontal bounds/footer clearance.
- `node scripts/verify-purchasing-text-size-migration.mjs` — disposable local PostgreSQL persistence/snapshot checks.
- `node scripts/verify-purchasing-text-size-ui.mjs` — actual editor, mutation, and query code in Chrome with fake local Supabase; 1440px/375px selection, touch targets, persistence/reload, and save-before-preview payload ordering. The viewer is a fixture; actual PDF rendering is covered separately.
- `node scripts/verify-purchasing-issuance.mjs` — issuance compatibility.
- `node --import tsx scripts/verify-purchasing-line-material-types.mjs` — five-type compatibility. Plain Node cannot resolve this verifier's extensionless TypeScript imports; the tsx loader is required.
- Targeted ESLint for purchasing and changed verifier scripts (no errors).
- `npx tsc --noEmit`.
- `npm run build` — production build; no deployment.
- `git diff --check`.

PDF.js emits existing standard-font-data warnings during extraction/rendering; generated text, bounds, and visual checks passed. The initial temporary baseline TypeScript file was moved outside the project before the successful TypeScript/build checks. No broad E2E suite was run.

## Files changed by this task

- `src/modules/purchasing/PurchaseOrderEditor.tsx`
- `src/modules/purchasing/PurchasingWorkspace.tsx`
- `src/modules/purchasing/defaults.ts`
- `src/modules/purchasing/mutations.ts`
- `src/modules/purchasing/queries.ts`
- `src/modules/purchasing/types.ts`
- `supabase/functions/_shared/pdf-text-size.mjs`
- `supabase/functions/_shared/pdf-text-size.d.mts`
- `supabase/functions/_shared/purchase-order-pdf-model.mjs`
- `supabase/functions/generate-purchase-order-pdf/index.ts`
- `supabase/migrations/20260918_002_purchase_order_pdf_text_size.sql`
- `scripts/verify-purchasing-pdf-overflow.mjs`
- `scripts/verify-purchasing-text-size-migration.mjs`
- `scripts/verify-purchasing-text-size-ui.mjs`
- This evidence report.

## Exact Chris action

Review the three visual presets and approve this PO-only migration/release boundary when ready. A subsequent authorized rollout must inspect the hosted function insertion points, apply only the approved new migration, deploy the PO Edge renderer and frontend together, and verify hosted Draft save/reload/preview and future issuance capture. Do not ship the selector before schema support. Do not promote unrelated dev/Sample changes, regenerate historical documents, or apply the superseded broad RBAC migration. No approval is needed to keep this completed work local for review.
