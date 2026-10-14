# Historical customer import — Product preview and release gate, October 14, 2026

> Superseded decision: Chris approved the 20 names, excluded the two held values, and required preserving existing Jobs RLS. See the [access-model assessment and validated local importer](2026-10-14-customer-access-and-import-review.md). The historical discovery counts below remain the original read-only receipt.

**STOPPED at the requested hosted compatibility gate. No hosted import, migration, business-data write, push or deployment.** The simplified Customer List UX and latest blue ⚡ UPDATE header treatment are accepted by Chris's current request. Neither is released by this work.

## Material compatibility finding

Hosted `public.jobs` has authenticated SELECT grants and the permissive **Compatibility authenticated read jobs** policy with `USING (true)`. There is no restrictive Jobs SELECT policy that checks active membership. The existing restrictive write policies/statement guard constrain mutations, not reads.

The validated local fixture instead uses `fixture_jobs_read` with `has_app_capability('readOperationalData')`, which requires active app membership. Consequently, adding the candidate's contact snapshot columns to Jobs would place new contact information behind a **broader hosted database read boundary** than the one locally tested. An authenticated session with inactive app membership is not excluded by the hosted Jobs SELECT contract. The application shell check does not replace database authorization.

This is a catalog-based finding; no hosted account was altered, impersonated or used to test inactive-user access. The capability, permission-requirement and business-write-guard function bodies match canonical repository definitions. The difference is the actual Jobs read contract/local fixture, not a request to change role bundles silently.

Chris explicitly instructed: **“If hosted compatibility differs materially from the validated local baseline, STOP.”** Import-write implementation, local import database tests, candidate assembly and release progression therefore stopped. Existing accepted app source and the header worktree were preserved.

Smallest next decision: authorize focused validation against an exact reproduction of hosted Jobs ACL/RLS/triggers, and decide how newly captured contact information must be protected from inactive authenticated readers. A narrow restrictive Jobs SELECT check for active operational-read authority would match the prior local expectation, but it changes privacy/RBAC behavior and requires Chris's explicit approval. No such policy has been prepared or applied here. Do not infer approval to tighten all Jobs reads from Customer List UX acceptance.

## Complete read-only hosted discovery

Project: `vxdxjhazkqhpkwdqtobp`. Discovery time: 2026-10-14T21:49:31.181Z. Only `jobs.id`, `jobs.customer` and `jobs.archived_at` business fields were retrieved; no financial values, Bids, Proposals or documents were read.

| Measure | Result |
|---|---:|
| Historical Jobs inspected | 41 |
| Active Jobs | 41 |
| Archived Jobs present | 0 |
| Distinct raw customer strings | 22 |
| Distinct nonblank strings | 22 |
| Trimmed, case-insensitive identities | 22 |
| Already configured | 0 |
| Proposed new names | 20 |
| Blank/invalid Job values excluded | 0 |
| Archived directory matches excluded | 0 |
| Held for manual review | 2 |
| Case/whitespace duplicate groups | 0 |

The Jobs query had **no archive filter**, so archived Jobs were eligible. Exact-count pagination returned 41 rows at offset 0, then a terminal empty page at offset 41 with the same total. This is complete retrieval, not a 1,000-row-limited query. The helper advances by actual received rows and rejects count drift, repeated IDs and premature empty pages. It is a paginated observation, not a transactionally frozen dataset; refresh the preview before any future approved import.

Hosted catalog and directory lookup independently confirm **no `production_companies` or `production_contacts` table is installed**. Thus there are no configured/archived directory records to compare today. Absence of the two candidate migrations is expected, not the material blocker above.

## Proposed names — approval required before import

These names are kept exactly as represented in historical data after surrounding-whitespace trimming. Usage counts include all inspected Jobs. No contact details or Job relationships would be imported.

| Proposed customer | Jobs |
|---|---:|
| Atlantic Exterior Wall Systems | 1 |
| Batson Cooke | 1 |
| Buslam | 1 |
| Camarata | 5 |
| Camarata Masonry Systems | 2 |
| Coral Reef | 1 |
| DePaoli Mosaic | 1 |
| IB SUPPLY | 6 |
| IntraState Terrazzo | 1 |
| Joseph Cohn & Son | 2 |
| LX Granite | 2 |
| MTT | 3 |
| RNC Concrete Coatings | 1 |
| Spectra CF | 1 |
| Superior | 5 |
| Superior Terrazzo & Finishes | 1 |
| T. Yorie Corp. | 1 |
| United Enterprises, Inc | 1 |
| Williams | 1 |
| Williams Tile & Marble | 2 |

Total: **20 names representing 39 Job usages**.

### Held; do not import automatically

| Historical value | Jobs | Review reason |
|---|---:|---|
| [Place Services] temporary | 1 | Temporary/test label: verify whether this is a real customer |
| INTERNAL TEST — NOT A CUSTOMER | 1 | Temporary/test label: verify whether this is a real customer; Non-ASCII identity: review normalization explicitly |

`INTERNAL TEST — NOT A CUSTOMER` is explicitly labelled non-customer data; exclusion is recommended. `[Place Services] temporary` may be a temporary placeholder; Chris must approve exclusion or an exact display name. Neither was silently renamed, cleaned up, linked or imported.

Potentially related names remain separate under the approved no-fuzzy-merge rule:

- Camarata (5) and Camarata Masonry Systems (2).
- Superior (5) and Superior Terrazzo & Finishes (1).
- Williams (1) and Williams Tile & Marble (2).

Their shared wording is not proof of common company identity. The proposal retains each literal name separately; no automatic resolution or record merge is recommended.

## Import mechanism status and intended idempotency

**Only the read-only preview mechanism is implemented. No company-writing import RPC, import migration or hosted import command was created/executed**, because of the required compatibility stop.

The preview trims surrounding whitespace, ignores blank names, groups names case-insensitively, retains the most-used original trimmed display spelling (deterministic lexical tie-break), and classifies existing active matches, archived matches, multiple-record conflicts and manual-review names. Its output is an explicit proposed list, not an automatic loader. Generic placeholder/test/temporary or unsupported normalization cases are held for review.

After the compatibility decision, the smallest proposed write mechanism is a narrow Admin-only names-array RPC, in a new forward migration, plus a sealed approved names manifest. It should serialize company writes, recheck exact normalized names **including archived records**, create only missing company-name records using existing empty optional-field defaults, and return inserted/already-configured/archived/conflict statuses. No Jobs scan belongs in the application or RPC startup path. No contacts, Job links, snapshots or documents would be written.

Current company schema deliberately permits duplicate names and does **not** have a normalized-name uniqueness constraint. Do not add a blanket unique index that merges/rejects existing configured identities. A short serialized check-and-insert operation can make the administrative import safe to rerun without changing ordinary directory semantics. This remains a design proposal, not validated import code.

## Focused verification performed

Tier 3 applies to the eventual data-write and authorization contract. Existing Customer Configuration application/database/browser evidence is retained; no unrelated suite was repeated.

- Hosted read-only paginated discovery: **PASS**, exact 41/41 rows with terminal empty page.
- Hosted schema/RLS/grants/function/trigger inspection: **COMPLETE; STOP finding above**.
- Pure read-only preview tests: **PASS**, including 2,505 synthetic rows with a 137-row server cap, truncation/count-drift rejection, blank exclusion, case/whitespace grouping, existing/archived comparisons and ambiguous duplicate holds.
- Targeted ESLint and diff checks: **PASS**.
- Accepted Customer List implementation file hashes: **UNCHANGED** against the prior receipt.
- New import idempotency, historical immutability, no-contact-fabrication and post-import dropdown database/browser gates: **NOT RUN**, because no import implementation was authorized past the stop condition.
- No new application build: application source is unchanged; prior successful build evidence is reused.

No local or hosted historical data was populated into the directory. Raw hosted IDs/customer rows remain in an ignored private local fixture file; the durable report contains names and aggregate counts only. [Structured evidence](evidence/2026-10-14-historical-customer-import.json) includes the narrow hosted catalog capture and read-only preview.

## Candidate and migration status

Canonical `origin/main`, `origin/dev` and contact-candidate HEAD are all `1d34f1800635336157f25db10206f7a4938d23ae` after fetch.

Customer candidate: `/private/tmp/tenops-production-contacts`, `feature/production-contact-configuration`; accepted application remains uncommitted. Local review remains **http://localhost:3001/**. Existing two migrations remain local-only:

1. `20261014190000_production_contact_configuration.sql`.
2. `20261014210000_production_customer_list.sql`.

Hosted migration ledger contains all canonical fourteen-digit versions dated September 23 onward, through `20261013180000_sample_label_capability`. Legacy ledger gaps are not proof of missing objects: 106 canonical files lack a matching ledger receipt by version/name, even though verified Jobs and identity objects exist. The older `20260724020000_delete_empty_manpower_reporting_groups.sql` is also unrecorded; its object/application state was not investigated and it is outside this release. Do not auto-apply it or other legacy files. **Never apply `20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql` wholesale.** No unrelated migration was identified as a required dependency or authorized for application. Full unrecorded-file inventory is in the structured evidence.

Header candidate: `/private/tmp/tenops-performance-header`, `feature/performance-header-polish`, HEAD **`83c634b79db69addfd3cdac5d8f0cda86947db9f`**, plus the existing uncommitted accepted visual overlay. The commit alone contains the older visual treatment and is **not** the complete accepted candidate. Current explicit Product approval supersedes older “awaiting acceptance” prose in that worktree, but does not authorize its release.

Exact accepted application boundary, captured read-only against canonical main:

- `src/app/client-layout-shell.tsx`
- `src/components/PerformanceAnnouncement.tsx`
- `src/components/PerformanceAnnouncement.module.css`
- `src/lib/performance-announcement.mjs`

The current component/CSS overlay supplies blue ⚡ UPDATE as a normal-flow sibling to complete branding, the square popover and responsive treatment. Support/review boundary includes its existing start/verifier scripts and review/visual receipts. `PERFORMANCE_ACTIVATED_AT` is still `null`; visibility must be activated only at an approved release time. Exact application patch is preserved under ignored `output/customer-import/header-accepted-app.patch`; its SHA-256 and each source-file hash are recorded in evidence. The header worktree and port 3000 were not modified.

## Combined release reconciliation plan — blocked, not executed

1. Resolve the Jobs read-contract decision; reproduce actual hosted authorization locally and validate the chosen narrow boundary. Do not bundle unapproved RBAC changes.
2. Complete and locally test the names-only idempotent importer after that gate; test reruns, concurrent duplicate protection, archived records, existing company preservation, Job/snapshot immutability, empty optional fields and customer-dropdown visibility.
3. Obtain Chris's explicit approval for the **20-name list** and disposition of the two held values. Re-read Jobs/directory names immediately before execution and freeze the approved manifest/hash; stop if the comparison materially changes.
4. Assemble a dedicated combined release candidate from refreshed canonical main. Carry the accepted contact diff and the exact accepted header application patch **including its dirty overlay**, plus reviewed migration/import assets and validation receipts. Do not merge unrelated branches or release `83c634b` alone. The two application boundaries have no direct changed-file overlap.
5. Run focused combined-candidate validation for Customer List/import authorization and header behavior/responsiveness. Reuse prior unaffected evidence; do not run unrelated Sample/PDF/calculation suites automatically. Approve an actual header activation timestamp as part of release authorization.
6. Obtain separate explicit authorization for the exact commit/push boundary, hosted migration sequence, approved customer population and Production deployment. Apply only reviewed required migrations, verify actual objects/policies/grants, execute only the approved names import, and verify historical customer text/links/captures remain unchanged before release progression.
7. Target Production only. Preserve TenDev without deployment or branch merges; the protected experimental Matcher branch is `release/sample-match-tendev` at `950dd714da215eaf5a3ad0b351aa344b80e09064`. Its deployed hosted state was not reverified in this read-only pass. No TenDev update is authorized.

## Exact files changed in this pass

- `scripts/support/customer-import.mjs`
- `scripts/preview-historical-customers.mjs`
- `scripts/verify-historical-customer-preview.mjs`
- `supabase/inspection/20261014_customer_import_compatibility.sql`
- `docs/project-memory/2026-10-14-production-customer-list-local-review.md`
- `docs/project-memory/2026-10-14-historical-customer-import-review.md`
- `docs/project-memory/evidence/2026-10-14-historical-customer-import.json`

No accepted application component, prior applied migration, header source, role bundle, or unrelated business module changed. Original dirty work and worktrees remain preserved.

**Remaining approvals:** resolve the material read-authorization mismatch and any privacy/RBAC adjustment; approve the exact import list/held-name dispositions; authorize completion/validation of the importer after the stop gate; then separately approve the exact combined release, hosted migrations, names population and header activation. No hosted import or release is authorized by this preview.
