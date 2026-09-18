# PO text-size hosted gate and release preparation — 2026-09-18

The hosted database gate and the matching candidate renderer gate passed. The feature is NOT fully active on Production: hosted `generate-purchase-order-pdf` is still version 15 and renders Standard for all presets. The candidate renderer was executed locally against actual authenticated hosted save/reopen and immutable issuance snapshots. No deployment was performed. This distinction is a release prerequisite, not a claim that hosted Compact/Large already works.

Chris explicitly authorized disposable authenticated PO lifecycle verification/cleanup and a local PO-only freeze, and prohibited migration reapplication, push, deployment, and release. Migration 002 was not reapplied. No product implementation or typography was changed during this gate. This was Tier 3 verification.

## Hosted 002, defaults, persistence, and compatibility

Inspected the actual `purchase_orders.pdf_text_size` column/check constraint, draft-save definition, and snapshot-capture definition. They match the intended migration behavior; capture occurs before the existing snapshot hash assignment. The capture function retains its `public, extensions, pg_temp` search path.

Authenticated disposable tests used the actual candidate `savePurchaseOrderDraft`, `loadPurchaseOrder`, preview mutation, and issuance mutation code. Verified:

- Eight existing NULL preferences resolve to Standard. An existing NULL row was read narrowly, not modified.
- A new legacy request omitting the field remains NULL in storage and resolves to Standard on reopen and issuance.
- New candidate-client Drafts save Standard by default.
- Compact, Standard, and Large each save/reopen unchanged and reach the hosted preview request as the effective saved value.
- Explicit `huge`, empty string, and NULL writes are rejected with SQLSTATE 22023. Read/render normalization retains the implemented Standard fallback.
- PO number remains stable through preference changes; separate new Drafts receive distinct numbers.
- Chip, Resin, Pigment, Filler, and Other persist in mixed POs. Seven-column candidate output is retained.
- Candidate editor browser checks at 1440px/375px confirm save-before-preview, reload before rendering, preset payload, selection state, and touch targets using a local fake transport.
- Disposable recovery remains unnumbered and idempotent; conflicting recovery input returns 23505. Anthony's actual recovered Hermes Draft was fingerprinted read-only and remained unchanged. No Anthony authentication/session or write was performed.

## Issuance, immutability, historical compatibility

Issued disposable POs for all three presets, including the legacy NULL-to-Standard path. For each:

1. Read the persisted issuance snapshot and confirmed the effective preset.
2. Recomputed its SHA-256 in hosted PostgreSQL from `order_snapshot::text || E'\n' || lines_snapshot::text`; it equals the stored hash.
3. Generated the stored artifact using the existing hosted renderer and confirmed the document's snapshot hash.
4. Attempted a Draft-save preference change on the issued PO; it was rejected.
5. Changed a separate editable Draft preference and retried generation of the issued document; the entire issued snapshot and downloaded artifact bytes remained unchanged.

The 8 historical issuance snapshots/lines/hashes and their document records matched their pre-gate fingerprints at completion. This proves no change during the gate; no pre-application historical baseline was invented. The new migration contains no historical update/backfill. Historical PDFs were neither regenerated nor replaced.

## Matching candidate renderer and visual evidence

The renderer source SHA-256 is `4ec84e24b43f8cb68b55b84f3b6f8de0c39b968372a1856a25902734e0b92056`. The approved typography mapping is unchanged (line values: Compact 5.6pt, Standard 6.2pt, Large 8pt; full mapping in the implementation report).

Candidate rendering of authenticated hosted fixtures:

| Fixture | Compact | Standard | Large |
| --- | ---: | ---: | ---: |
| Normal preview | 1 page | 1 page | 1 page |
| Long/mixed preview | 4 pages | 5 pages | 7 pages |
| Immutable normal issuance | 1 page | 1 page | 1 page |

Compact is visibly denser and Large visibly larger. The normal Standard candidate has identical text geometry to the actual live PDF, and is byte-identical to rendering the freshly downloaded version-15 source with identical snapshot/logo/date inputs. The original fixed-date Standard compatibility digest also still passes.

All seven headers, long address/contact/Ship To/description/notes tail markers, row fragmentation, horizontal bounds, and footer clearance pass. The six hosted-fixture candidate previews were rasterized and visually reviewed, including long continuation and final summary/notes pages. No clipping, overlap, broken borders, footer collision, or silent truncation was observed. The separate extreme-identity matrix remains green.

Live version 15 was measured at 6.2pt row text even when sent Compact or Large. The candidate's saved-snapshot renders measure 5.6/6.2/8pt. Therefore the live preset-rendering check is explicitly pending coordinated deployment, not marked passed.

## Disposable cleanup and evidence

Successful final run: `po-text-size-1789748384777`.

Zero residue was asserted for PO headers, lines, detail rows, issuances, document records, Pending Receivals, app users, Auth users, private messages belonging to the disposable user, and Storage objects/paths. No new production Job, catalog item, Inventory item, or configured vendor was created. Issuance fixtures referenced an existing active vendor ID without modifying the vendor.

Earlier verifier attempts were also cleaned. One cleanup attempt discovered the deployed purge RPC is service-only; the authenticated grant is denied. Cleanup then used the existing service-role guarded purge without changing permissions. Its recovery report proves 4 remaining headers, 20 lines, 3 issuances and associated artifacts/users/messages were removed. A final cross-marker query found zero `po-text-size-*` POs, app users, Auth users, or marker Storage objects. The complete final lifecycle run then passed with the corrected cleanup boundary.

Evidence is frozen in `evidence/2026-09-18-po-text-size-hosted.json`, including hosted results, zero counts, renderer results, current hosted metadata, and candidate file hashes. QA snapshots/PDFs remain local under:

- `output/pdf/hosted-po-text-size/po-text-size-1789748384777/` — final hosted/database and candidate PDF evidence.
- `output/pdf/hosted-po-text-size/po-text-size-1789747636346/` — candidate visual-review set and guarded-cleanup recovery evidence.
- `tmp/pdfs/hosted-gate/` — reviewed PNG pages.

No tokens, passwords, user sessions, or historical business content are included in committed evidence.

## Frozen boundary and final checks

Prepared on `release/po-pdf-text-size-20260918` in `/tmp/tenops-po-text-size-release`, based on main/origin-main `be83d98bba99c3f35df0385a069cd82b040eba1d`. Its eventual commit SHA is reported in the delivery message and is the branch tip. Only PO text-size implementation, immutable migration 002, focused verifiers, and PO evidence are included.

Concurrent Sample V3 commit `36ca025` remains on dev. It was not modified or included in this isolated candidate. Do not merge dev wholesale. The original dev working files remain in place; the isolated commit is the release source of truth.

Final isolated-boundary checks passed:

- PO PDF model/permanent-PDF compatibility verifier.
- PO issuance, five-type taxonomy, and numbering verifiers.
- Nine-artifact Compact/Standard/Large overflow verifier with Standard byte digest.
- Candidate rendering of hosted preview and issuance snapshots.
- Actual candidate editor desktop/mobile browser check with fake transport; hosted save/reload tested separately using real authentication.
- Targeted ESLint (purchasing plus focused verifier files).
- TypeScript `npx tsc --noEmit`.
- PO-only staged `git diff --check`.
- `NEXT_PUBLIC_DEV_BRANDING=false npm run build` on the isolated candidate.

No broad E2E was run. The first build setup used an external node_modules symlink, which Turbopack rejects; dependencies were cloned locally. An optimized build with shared Dev branding was not treated as the Production artifact; the final build explicitly disables Dev branding. No source change was needed.

## Current hosted PDF identity

Project: `vxdxjhazkqhpkwdqtobp`.

- Function: `generate-purchase-order-pdf`
- Version: **15**, ACTIVE, JWT verification **true**
- Hosted bundle (`ezbr_sha256`): `ce4688bf1085c63fe582f23cb90691cf15f5a806a79226d5b7ed613c763f45da`
- Downloaded entrypoint SHA-256: `aa51caf41d516ecbacd86b51ed41b2fb9cc73dddb27e412ba0deebb23c90d822`
- Document/model version remains `po-pdf-v2`; that label alone cannot identify a deployed renderer.
- Downloaded rollback source is preserved at `/tmp/tenops-po-text-size-hosted-gate/supabase/functions/`.

## Coordinated deployment sequence — requires new authorization

1. Approve the exact frozen PO SHA. Recheck main has not changed from the stated base and inspect the PO-only diff. Integrate only this commit (fast-forward from the base, or selective cherry-pick if necessary), then push only the approved boundary. Do not include Sample V3.
2. Reconfirm the hosted column/function facts; **do not reapply 002**, run broad db push, or apply any other migration.
3. From the approved candidate checkout, deploy only `generate-purchase-order-pdf` plus its bundled shared imports to project `vxdxjhazkqhpkwdqtobp`. Keep JWT verification enabled. The intended CLI operation is `npx --yes supabase@2.110.0 functions deploy generate-purchase-order-pdf --project-ref vxdxjhazkqhpkwdqtobp --use-api`. Leave other Edge functions unchanged.
4. Before exposing the new selector, verify authenticated hosted Compact/Standard/Large rendering against saved disposable POs and one issued snapshot; confirm function source/bundle identity, then clean fixtures. Existing clients send no preference and remain Standard under the new renderer.
5. Publish the Production-branded `out/` from this exact PO candidate to the existing **tenops** Cloudflare Pages Production target/main branch using the established release path. Record the preceding and new client deployment IDs. Do not publish the dev working tree or the Sample candidate.
6. Run the narrow deployed-client save/reopen/preview/issue smoke, inspect Large/continuations, verify historical fingerprints and zero residue, and record both new client and PO Edge identities. Do not regenerate existing artifacts.

Deploying the client before the PDF function would expose a selector that version 15 ignores; this sequence prevents that mismatch.

## Rollback

Prefer rolling back the client to the preceding recorded Production Pages deployment while retaining the new backwards-compatible renderer and additive schema. Existing clients omit the preference; persisted preferences and issued snapshots remain intact.

If the renderer itself must be rolled back, first stop new PO generation/issuance through the release incident procedure; restore the saved version-15 function bundle/source with JWT verification enabled and restore the prior client. Leave migration 002 applied. Existing stored issued artifacts remain untouched and downloadable. Version 15 ignores Compact/Large, so **do not generate pending non-Standard issuance snapshots with it**; resume generation only after a compatible renderer is restored or an explicitly approved corrective release. Do not rewrite snapshot preferences/hashes, delete production documents, reset PO numbering, or regenerate historical PDFs as rollback.

## Blockers and exact authorization

No database/candidate implementation blocker was found. Full deployed end-to-end preset behavior remains unverified and inactive until the coordinated renderer/client rollout; the current hosted renderer demonstrably ignores Compact/Large.

Required authorization: Chris must approve promotion/push of the exact PO-only candidate SHA, deployment of only its PO Edge function with JWT enabled and its Production client, plus the narrow post-deployment disposable authenticated smoke/cleanup above. No migration application is requested. This gate stops at the local frozen candidate and report; no push, deployment, or release is authorized or performed.
