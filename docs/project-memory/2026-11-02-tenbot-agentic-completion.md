# TenBot focused completion and normal availability — November 2, 2026

**Deployed to TenDev; Proposal completed; Pending held; focused correction required before Production.** Temporary spending, enrollment and agent writes closed at 21:18:10Z. Product acceptance is pending. No Production deployment or new migration occurred.

Authority: Chris's **TENDEV — AGENTIC ACTION COMPLETION & NORMAL EMPLOYEE AVAILABILITY**, November 2, 2026. The separate Advisory thread was unavailable; the supplied current Product contract governed. Tier 3 / focused Testing Level 3. This supersedes the current hosted-state observations in the [integrated staging receipt](2026-11-02-tenbot-integrated-staging.md), preserving that receipt's failed historical acceptance. [Sanitized machine evidence](evidence/2026-11-02-tenbot-agentic-completion/receipt.json).

## A. Source and release boundary

| Boundary | Exact identity / state |
|---|---|
| Deployed implementation | `5f32795c66cf230b4d001485a3097be5e802376e` |
| Selective TenDev served SHA | `a1831baf145f2be320cbb5d9160781231ffd826a` |
| TenDev deployment | `f1119ae6-39b9-4a69-947a-e8089b4b1bd9`; <https://tendev.pages.dev> |
| Shared TenBot Edge | Source deployment v62; final v64 ACTIVE, JWT verification ON; intermediate acceptance version not independently captured |
| Edge source/API hash | `497444764f18ec2af89a11c5877e3a9bf8132402e7a53e5262ee717a15cc55fb` |
| Additional local correction, not deployed | `231046e5a5eb6930549070efb8469f0dd2a48920` |
| Production Pages, unchanged | `e71bd981a583e0a4e706f9953c6cc1fcc4d576e1`; deployment `eb191ab7-6e40-4275-b0a1-c616044b89a5` |

The candidate selectively retained the accepted frontend and generic agent, with the five focused runtime changes. No wholesale dev merge, remote push, main promotion, Production Pages deployment or routing change occurred. Fresh post-closure metadata confirmed both Pages projects' deployment configuration unchanged, exact TenDev/Production SHAs, Edge v64 and the same source hash. Exact release verification covered 55 Edge modules and 99 served assets. Eight unrelated dirty paths, including the generic-agent work and Current State/execution-standard edits, remained byte-for-byte intact; they were excluded from commits and release.

Reused the four already-applied migrations `20261102120000`, `20261102130000`, `20261102140000` and `20261102150000`, with their existing independent hosted verification. The monthly allowance migration was already applied. **No migration was authored or applied in this pass.**

## B. Corrections

Deployed in `5f32795c`:

- Proposal decimal handling accepts formatting-only variants of explicitly evidenced nonnegative decimals while retaining raw evidence, precision/range validation and literal dimensions. The new ordinary unit-quote pattern accepts an explicit same-clause “Quote … at $12.50 each” and rejects catalog/cost/negated/cross-sentence contexts in the focused cases; the pre-existing explicit-label matcher remains unchanged. Exact old rejected model arguments were not retained and are not reconstructed here.
- Completed registered preparations use the existing trusted action publisher and host-owned card fields before read-answer prose validation. The model cannot supply action references or bypass current owner/session/access/freshness checks. Ordinary read publication remains strict; incomplete/failed publication does not yield an executable card, and known undelivered references are revoked.
- Failure wording derives from actual preparation/read progress. Pre-tool failures use neutral retry language; unrelated Job fallback is removed from this action lane. No question-specific handler or new registry/tool/framework was added.
- Default-OFF `TENBOT_EMPLOYEE_MODE_ENABLED` separates eligible authenticated TenDev access from temporary acceptance windows and inference funding. Existing capabilities, private history, action controls, exact review/password/session/replay checks and emergency disablement remain.

The actual Pending review then exposed another evidence gap: `read_supplied_document` returned line text/references and a readiness flag but hid the already-attested structured source quantity. Actual retained intent had the correct line ID/text but empty source quantity/unit and expected quantity/unit; the trusted source had **50 / LB**. Local commit `231046e5` exposes a fresh `sources[].source_quantity` only for one exact line-ID/text/hash-bound attested row after the normal original download/authorization checks. Missing, stale, malformed or duplicate evidence returns null; preparation is not auto-filled. This correction passed local checks but **was not deployed or tested with hosted inference**, because the independent canonical rule below still prevents completion.

## C. Actual employee conversation and business outcomes

Chris Ngo used his designated legitimate signed-in account. Password entry and submission were performed by Chris directly in TenDev; the agent did not inspect or supply credentials.

**A initial request:**

> Prepare a Proposal draft for Synthetic TenDev Acceptance Customer, for the Synthetic Lobby Review project. Quote two white terrazzo treads, each 48 by 12 by 2 inches, at $12.50 each. We do not have the customer's address or contact details yet, and freight has not been quoted. Leave those unknown and do not link a Production Job. Show me the review and preview before saving anything. This is approved synthetic acceptance data.

Terra genuinely selected `discover_capabilities` and `prepare_proposal_draft`; both succeeded. A trusted card appeared with quantity 2, rate 12.50, amount 25 and literal 48 / 12 / 2-inch dimensions. The model omitted line UOM. The existing “Ask TenBot to change these details” flow was used with the complete specification repeated and the explicit addition **“Set the Proposal line unit to each.”** This was not a pronoun-only follow-up test. Terra selected the same two operations, produced revision 2, and replaced the earlier action. Unknown address/contact/freight stayed blank; reviewed canonical commercial defaults remained visible.

The inline preview opened as a rendered one-page, 839.2 KB reviewed, unissued PDF. Complete PDF content/layout and download export were not verified: browser blob export was unsupported and the ordinary download event did not yield a file. No issued PDF was generated. After Chris's own password confirmation, UI displayed **“Proposal draft saved. It has not been issued.”**

Canonical readback proved action `29d5d277-617e-4865-9b4f-8df3c3f88122` completed at **21:06:06Z**, consumed its password authorization and used a distinct execution session. Actual Proposal **Q26-1102-1.0**, ID `cf702bf9-71d2-4219-beea-a348d4cbe41f`, is a standalone one-line draft, no Job, no issuance/snapshot/issued-PDF record. [Actual saved draft](https://tendev.pages.dev/proposals?open=cf702bf9-71d2-4219-beea-a348d4cbe41f). The link opened the canonical generator; Customer Proposal fields matched quantity 2, UOM each, dimensions, rate and $25 total. Saved history/receipt survived a normal reload.

**B attachment acknowledgement:** The approved PDF's first normal readback hit private Storage HTTP 500 after successful begin/get-source RPCs. One normal same-file retry after session refresh succeeded; no Storage root cause is claimed. Chris used the paperclip because extension file access blocked automated upload and native control failed to start. Existing owner/hash deduplication reused source `c9cc8e49-ea16-4a26-b142-ffb237a76d1d`, ready/version 1. No source recreation or re-attestation occurred. Evidence remains the prior human-reviewed deterministic synthetic transcription, **not OCR/vision**.

Chris sent **“file uploaded”**. Terra selected discovery and `read_supplied_document`, cited supplier T&M Supply and invoice SYN-TENDEV-ACTIONS-20261102-01, then asked whether to review the invoice or continue the earlier Proposal. User-observed UX: attaching a file alone leaves Send disabled; text enables it. This finding is recorded without unrelated UI changes.

**B full request:**

> Add the materials from this invoice to Pending Receivals, but check whether we already have them outstanding. This is the approved synthetic test. Ordered by Chris Ngo on November 2, 2026 for Denton. Do not mark anything received.

Terra genuinely selected discovery, `describe_assistant_scope`, `read_supplied_document`, `search_material_catalog`, `find_receivals` and `prepare_pending_receivals`. All six tool outcomes were OK across seven completed provider steps. The actual trusted card published: invoice reference, Chris, November 2, Denton, Alaska White #0 and the 50 LB bag package matched. No duplicate warning appeared; the duplicate tool ran, but its underlying row result is not independently reconstructed from aggregate diagnostics. The employee card did not explicitly summarize duplicate findings, so full compound-answer completeness is not established.

Quantity/unit were empty and did not match the attested 50 LB source. The card correctly blocked confirmation and stated **“Nothing has been added to Pending Receivals or Inventory.”** Held action `11ba9eb8-47c9-4ba6-8138-fbdaf6f8344c` has an archive reference but no password stamp, execution session, consumed authorization, dispatch, canonical Pending draft or created records. No B password was requested. Pending remained **76**. This is successful trusted publication and safe missing-evidence handling, **not completed receiving acceptance**.

The model selected the tools; the employee card summaries, validation and execution receipt were host-owned deterministic presentation. Provider metadata establishes real `gpt-6.1-terra` inference, not simulated reasoning. Request/action correlation uses actual UI owner/time; the schema has no request-ID foreign key on action rows.

## D. Verified quantity boundary and narrow next contract

Even correctly copying the attested 50 LB does not unblock this exact invoice. The unchanged TS quantity helper flags `source_quantity_is_package_size` when the separate total equals the parenthetical per-bag quantity. The actual hosted pure `tenbot_invoice_quantity_basis` function was fingerprinted (`c9616fb63241ce96de7c186f8a8c40e2`, security invoker) and called in **BEGIN READ ONLY** with 50 LB, a 50 LB Bag offer, expected 1 Bag and the exact synthetic line. It rejected **SQLSTATE 22023** for the package-size rule. This pure probe was not business execution and changed no record, role, Auth claim or attestation.

**Proposed only; requires separate migration approval:** correct TS and SQL together so an exact per-container mention equal to an attested material total is not itself a rejection when a separate unambiguous non-container total on the same bound source line independently matches the attested total/unit. Preserve package-only, absent/ambiguous/conflicting totals/counts, wrong package sizes/units, unsupported conversions, nonexact/nonintegral counts and missing source-binding holds. Never edit/re-attest the original or bypass validation to force this fixture through. Require focused isolated TS/SQL parity and canonical lifecycle checks for 100 LB + 50 LB/bag → 2 Bags, separate 50 LB + 50 LB/bag → 1 Bag, and the negative cases before applying a narrow forward migration. No migration file or quantity-rule implementation was created here.

## E. Normal availability and final controls

Ordinary released employees must not depend on developer enrollment or acceptance deadlines. The local normal-mode correction implements that availability boundary for existing reviewed access, independently of funding. Hosted employee mode remains **OFF**.

Permanent Pending execution is still materially pilot-dependent: server pre-execution plus SQL permit/executor require finite policy/window/enrollment. Existing Proposal execution does not share that enrollment dependency. A future disabled-first append-only migration should reuse the existing administrator action control/current capabilities for permanent Pending, while preserving exact origin, owner/session/action/hash/revision/password binding, one-use permit expiry, policy/permission invalidation, original-source/duplicate/catalog checks, caller RLS and transactional zero-stock creation. Keep legacy pilot behavior intact. No new role or broader grant is proposed. This is a separate narrow Product/migration decision; normal mode cannot bypass it.

Normal inference still needs expressly approved financial configuration/lifetime using the existing spending switch and atomic monthly accounting. No automatic funding increase or renewal is implemented. Individual action/password authorizations may expire independently of normal availability.

At closure/readback: Edge acceptance/reviewed-operation/reviewed-action/receival-pilot/execution flags OFF; employee ID setting empty; database Proposal/receival controls OFF; pilot OFF; execution OFF; enrollment empty; zero active permits/grants; paid policy **v11 disabled**. Ordinary Production Terra spend, invoice preparation spend and old canary funding/window remain OFF. Operation history is retained but operation-linked content redacts while its rollout gate is OFF. Created Proposal, blocked review, original invoice and accounting were preserved. Stock **187**, inventory transactions **102**, caps/profile/Proposal access and **46** Job identities/hashes were unchanged. Production Pages and configuration were unchanged.

## F. Validation, accounting and Product decision

Deployed correction: 25 Proposal, 22 availability, 10 hosted-session and nine hosted-operation groups passed; integrated TypeScript, targeted lint, diff/preservation checks passed. Exact candidate Webpack build passed (25 pages, 288 artifacts), 55 Edge modules and 99 assets verified. Additional local evidence exposure: **19 business-operation groups**, TypeScript, targeted lint and diff passed; root reviewed the two-file delta. Those tests are model-free. Reused unchanged isolated real Auth/RLS/canonical transaction/rollback/replay/concurrency and desktop/mobile/Messaging evidence; no broad campaign or Qwen tuning. Brief native accessibility window selection supported the Proposal preview; later two native picker startup attempts failed. Browser DOM/screenshots were used; no new native screenshot was taken and no active desktop capture remains.

| Actual request | Provider steps | Measured charge |
|---|---:|---:|
| A initial `1750112e-d33d-4091-83a5-f04a3b4b6764` | 3 | $0.014167 |
| A corrected `e2060b0a-9d27-47dc-a022-07cad455b552` | 3 | $0.010516 |
| B “file uploaded” `a29db86b-c85b-4657-93d7-f2be114c7ee1` | 3 | $0.013600 |
| B full request `2a878c4b-aba6-4b4f-9f6f-64e95ba16d46` | 7 | $0.017499 |
| **Total** | **16** | **$0.055782** |

All 16 provider responses were HTTP 200/completed with model/tier and required token metadata matched. Totals: **91,025 input**, **1,897 output**, **56,234 cached input**, **34,743 cache-write**; optional reasoning-token counts were absent, not zero. No new outstanding reservation/uncertain charge remains. **$0.444218** of the additional $0.50 is unspent under the now-closed allowance; $0.25/request remains unchanged. All prior **149** rows/hash were immutable; total usage rows now **165**. Historical holds **$0.142953**, including unresolved **$0.018723**, remain unchanged. Month accounted **$0.342208** against preserved cap **$0.786426**, policy disabled. No accounting reset or old grant reuse occurred.

**Recommendation: focused correction required; not ready for limited Production rollout.** Product may accept the deployed Proposal completion/publication/recovery work as bounded evidence. The smallest next step is the narrow quantity-contract correction approval, followed by one genuine Pending completion using the existing reviewed/password path. Approve permanent Pending authorization and ordinary funding/rollout separately before general availability. No additional inference or reactivation occurred after closure. Stop for Product review; no Production promotion.

Compact handoff for the existing execution standard: current explicit November 2 contract governs; deployed `5f32795c` → `a1831baf` / Edge64; local-only `231046e5`; Proposal done, Pending held; no new migration; all gates closed; quantity/permanent-Pending approvals outstanding. The concurrently dirty execution standard, Current State and documentation index were preserved for their owning workstream rather than overwritten.
