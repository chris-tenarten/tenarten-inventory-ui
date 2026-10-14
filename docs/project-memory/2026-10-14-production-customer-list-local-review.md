# Customer List simplification — local Product review, October 14, 2026

> Product accepted this simplified UX in the historical-import continuation. [Release preparation is stopped at a material hosted authorization mismatch](2026-10-14-historical-customer-import-review.md); acceptance does not authorize release.

Status: implemented locally; stopped for Product review. This revision supersedes the contact-heavy UX in the [original candidate report](2026-10-14-production-contacts-local-review.md), while preserving its company/contact and Project snapshot infrastructure.

## Review

**http://localhost:3001/** — actual TenOps using isolated, disposable local Supabase. Reload the page to see the simplified interface. Port 3000 continues serving the untouched performance-header candidate.

Local accounts: `contact-admin@example.invalid`, `contact-lead@example.invalid`, `contact-member@example.invalid`. Password for each: `Local-contact-review-2026!`. Normal hosted TenOps credentials do not apply to this local database.

The synthetic names **Superior** and **Buslam** are available as configured customers. No Production records or customer data were used for these examples.

## Operator behavior

- New Job shows **Customer → Select customer…**. The searchable dropdown lists one row per configured company, without requiring a person selection. Choosing the name immediately fills the Job's customer and captures any explicitly configured optional default contact. Customer remains optional.
- The dropdown separates **Configured Customers** from **Previously Used Names**. Historical selections remain plain text without a fabricated directory identity. Native Job-derived datalist suggestions remain on the Inspector and existing inline editors.
- Dropdown actions **+ Add New Customer** and **Manage Customer List** use one `CustomerInspector` component and the same save contract. **Save to Customer List** explicitly promotes a selected historical name. No bulk import, automatic merge or inferred identity was added.
- Customer Inspector initially shows only required **Customer / Company Name**. Collapsed **Additional Information (Optional)** contains **Contact Name**, **Phone Number** and **Email Address**. Save Customer requires only the company name. Existing customers use Save Changes and, for shared editors, Remove From List.
- An optional named contact stores phone/email on that person. Without a named contact, phone/email belong to the company. Existing company/contact fields not exposed by this compact form remain preserved. In optional details, a shared editor may choose an existing saved contact as the default instead of creating a duplicate. There is no required contact step in Job creation.
- The Job Inspector retains a prominent free-text **Customer** field with a small dropdown and sliders button. Sliders opens **Manage Customer List**. Optional contact information appears as a compact secondary summary.
- Project override and explicit refresh actions are retained under collapsed **Project contact details**. Shared saved-customer edits do not refresh or overwrite the open Job draft or any saved Job. Snapshot changes still require the existing Job Save action. These controls no longer appear as simultaneous primary actions.
- Native buttons and inputs support Tab/Enter; dropdown Arrow Up/Down/Enter selects customer choices. Escape dismisses the dropdown/Customer Inspector. Controls fit a 390px viewport.

## Persistence and removal

New forward-only migration: `supabase/migrations/20261014210000_production_customer_list.sql`. The previously applied local migration `20261014190000_production_contact_configuration.sql` is unchanged, with its original hash verified against prior evidence.

The extension adds nullable `archived_at` and `default_contact_id` to companies, with a composite FK ensuring the optional default belongs to the same company. **No existing contact is automatically chosen as a default.** This small explicit link allows one customer selection to reuse optional information without making operators choose a person on every Job.

Customer-level search returns one active company with its optional explicitly saved default. Original contact records, contact lookup/save APIs, and Job snapshot structures remain. Existing contact search is extended to exclude archived companies and its save comparison accommodates the additive company fields.

**Remove From List** sets the company archive timestamp. It does not delete companies or contacts, update Jobs, change captured information, or touch documents. Both configured lookup APIs omit archived companies. New Job associations to archived companies are rejected in the database; association creation is serialized against archival. Existing linked Jobs can still be edited, and their captures can be explicitly overridden/refreshed. There is no restore action in this increment.

A removed customer's name may remain under **Previously Used Names** when historical Jobs contain it. That choice is unlinked text, not the archived configured record. Explicitly saving that historical text to the list creates an independent new identity; no archived record is silently restored or merged.

## Authorization and performance

Existing capabilities and role bundles are unchanged. Production creators/routine editors can add/select customers. Shared customer edits, default-contact changes on existing companies, and archival require the existing elevated-edit capability plus `writeBusinessData` (currently Lead/Admin). Ordinary Members cannot modify existing shared customer records through the new API. RPC checks, direct table-write denial, existing snapshot guards and FK validation enforce the boundary beyond the UI.

Directory reads remain under existing Production operational-read authorization. No Bid/Proposal/private content is read or imported by the directory.

Customer lookup remains on demand and debounced. No directory queries were observed at workspace or New Job startup. Customer dropdown and management list share one query state, so opening management from an open dropdown reuses its results. Search uses bounded stable pages (21 returned, 20 displayed), literal prefix matching, and an active-company index. The 10,000 offset cap remains; refine search beyond that. Optional existing contacts load only when the optional management section is expanded, with their own bounded company-scoped pages. No hosted-scale benchmark is claimed.

## Focused validation

Tier 3 / Testing Level 3 for the new archive/default-contact persistence contract. Prior Tier 3 evidence was reused where contracts remain unchanged; unrelated suites were not rerun.

- `tsx scripts/verify-production-customer-list-db.mts`: **PASS**, nine grouped contracts. The forward migration left all existing local Job rows/snapshots unchanged. Tests covered company-only/optional-contact creation, one customer per choice, retained contacts and legacy APIs, shared-edit/archive denial across Member/Guest/Developer/read-only/inactive/anonymous users, raw-write denial, Lead edit/Admin archive, stale-version denial, active lookup removal, archived-link insertion denial, historical editing, explicit promotion, default-contact assignment/removal, and bounded stable pagination.
- `node scripts/verify-production-customer-list-browser.mjs`: **PASS**, ten grouped workflows on the actual `localhost:3001` app. Covered selection, optional customer, name-only/optional details, one-step optional-detail reuse, sliders integration, shared-edit and archive snapshot preservation, historical suggestions/promotion, Member creation and denial, secondary override/refresh, keyboard navigation, and mobile layout. No external origins or page exceptions were recorded.
- TypeScript, targeted ESLint, `git diff --check`: **PASS**.
- Final Production build: **PASS**, Next 16.2.2 Turbopack compiled, type checked and generated 22/22 static pages. An isolated build copy preserved both live reviews; all ten application files match its successful source byte-for-byte.
- Desktop Job/Customer Inspectors and 390px mobile captures were visually inspected. A primary Save button contrast issue was corrected and verified before the final pass.

The old browser verifier entry point delegates to the revised verifier so it no longer asserts the superseded contact-heavy UI. The original database verifier and original evidence remain available.

[Structured revision evidence](evidence/2026-10-14-production-customer-list.json) records checks, per-file hashes and the content fingerprint. Raw screenshots/results are under ignored `output/customer-list/`.

## Exact files changed by this revision

- `docs/project-memory/2026-10-14-production-contacts-local-review.md`
- `docs/project-memory/2026-10-14-production-customer-list-local-review.md`
- `docs/project-memory/evidence/2026-10-14-production-customer-list.json`
- `scripts/start-production-contact-review.mjs`
- `scripts/verify-production-contact-browser.mjs`
- `scripts/verify-production-customer-list-browser.mjs`
- `scripts/verify-production-customer-list-db.mts`
- `src/modules/production/components/ProductionJobInspector.tsx`
- `src/modules/production/contacts/CustomerInspector.tsx`
- `src/modules/production/contacts/ProjectContactEditor.tsx`
- `src/modules/production/contacts/model.ts`
- `src/modules/production/contacts/queries.ts`
- `supabase/migrations/20261014210000_production_customer_list.sql`

The complete uncommitted candidate has 22 files relative to canonical base, including original infrastructure and both review/evidence records. The structured evidence lists the implementation file hashes. Candidate branch remains `feature/production-contact-configuration`, worktree `/private/tmp/tenops-production-contacts`, base/HEAD `1d34f1800635336157f25db10206f7a4938d23ae`. No candidate commit was created.

## Limitations and release boundary

- Legacy companies with multiple contacts have no inferred default. Lead/Admin can explicitly choose a saved contact in optional management details. Existing Job captures are preserved independently.
- Archived configured customers have no restore UI; historical text suggestions intentionally remain available.
- The local fixture supplies limited/empty unrelated modules and does not provision unrelated Storage/Realtime workflows. Document generation and unrelated modules were not exercised or changed.
- Neither migration was applied to hosted Supabase. Hosted compatibility and current capability grants still need narrow verification before separately authorized application/release.
- Original root dirty work, existing worktrees, performance-header review, calculations, Samples, Labels, Blend, Matcher, Messaging, Bids and PWA configuration were preserved.

No hosted writes, push, deployment, release or commit. **Stopped for Product review.**
