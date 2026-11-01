# Actual Messaging build and On Deck follow-up — November 1, 2026

**Verified and corrected locally; no deployment.** Authority: Chris's VERIFY ACTUAL MESSAGING BUILD request, continuing the focused Messaging correction. Product confirmed the affected URL is **https://tendev.pages.dev**. Dev baseline `e61d333ccfb2fed1f1488ad8071d169cf67c73b7`; unrelated dirty work preserved. Advisory thread unavailable; current explicit decision governs. Tier 2 / focused Testing Level 2. No schema, authorization, provider or spending change.

## Build identity and classification

Fresh bounded public reads matched exact retained HTML and relevant Messaging chunk bytes:

| Environment | Source artifact identity | Messaging asset |
| --- | --- | --- |
| Affected TenDev URL | `9415adc577e5509c2473001fbd514ab644077e3c` | `/_next/static/chunks/2930.2ace58bc0425857f.js` |
| TenOps | `01c0b4576a61329d973ce65ca58437ce26627be1` | `/_next/static/chunks/2754.a6b9df91d7bfa2be.js` |
| Existing localhost review | `e61d333ccfb2fed1f1488ad8071d169cf67c73b7` | `/_next/static/chunks/5128.f8a4a9e39dfe6480.js` |

TenDev Messaging SHA256: `51739c4df7efdc83f92e03e3e47616fa956e27d6814cf4031071ad92687e2928`. This is the previously verified persistent-history deployment `f62e8e3f-4c5e-40fb-94c0-f0e02feed638`, not the later e61d333 UI correction. A fresh canonical Cloudflare metadata read returned401 for both projects; no OAuth refresh or infrastructure investigation was attempted. Deployment metadata was not freshly confirmed; source identity is established by exact served artifact hashes against retained build/deployment evidence.

The browser connector returned no available browsers/tabs and a native-pipe startup error. No retry, console delivery, session extraction or Auth bypass was attempted. Product's URL confirmation identifies the affected environment, but the actual tab's already-loaded/in-memory asset list remains unobserved. Do not claim a browser cache diagnosis from server asset comparison alone. The service worker has no fetch caching.

| Finding | Classification |
| --- | --- |
| No selected-thread highlight | Fixed in local e61d333; absent from served TenDev9415. No reimplementation. |
| TenBot below employee conversations | Fixed in local e61d333; absent from served TenDev9415. No reimplementation. |
| Dedicated TenBot dropdown entry | Included in e61d333, not deployed to TenDev. |
| Historical live-answer placeholders | Per-turn classification remains unavailable without the genuine owner session. Old volatile answers were not retained, and expired legacy receipts cannot safely be reconstructed. Current persistent answers may also be selectively redacted for access/source failures; these cannot be presumed legacy or a failed migration. No private history was read, rewritten, deleted or unredacted. |
| Production → On Deck | Genuine remaining routing defect reproduced in e61d333's backend, also present in the accepted persistent candidate. Corrected narrowly below. |

The persistent path is present in the served TenDev chunk; the older exact “Ask again to refresh this live answer.” literal is absent. Local e61d333's distinct legacy/restricted/retry notices and persistent-contract diagnostic marker are absent from9415. Prior14 handler/history and11 browser groups remain valid UI evidence; the10 real isolated PostgreSQL/JWT/RLS groups remain the archive privacy evidence. The current investigation did not inspect an authenticated hosted transcript or prove which specific placeholder Product saw.

## Remaining defect and focused correction

Before: after a Production count, bare “On Deck” or “What about On Deck?” had no operational intent and fell into generic knowledge routing. “Which ones are On Deck?” was referential, but reused the previous `in_production` filter while saving `on_deck` as the next selector. The precise hosted model's My Work prose was not captured; the operational fallthrough and incorrect population were reproduced with the real handler/tools and synthetic transports.

The existing canonical status parser is shared with follow-up resolution. A short single-status refinement uses the retained Production subject; an explicit requested status replaces the previous status selection. Existing authorized overview/find tools supply fresh results. Explicit My Work/task requests and a My Work subject remain knowledge questions. Existing whitespace support and the hyphenated label alias remain consistent in selectors, count presentation and required evidence facts. No new tool, argument, permission or general-purpose router was added.

Only three Edge runtime files change: `tenbot-job-routing.ts`, `tenbot-conversation-context.ts`, `tenbot-job-presentation.ts`; the existing context verifier adds the focused regressions. A stale date-format assertion was aligned with the already accepted formatted labor period. All seven existing runtime predecessors for this fix and e61d333 match the retained9415 source byte-for-byte; the new UI helper is the only additional runtime file. No unrelated source must be promoted.

## Actual validation and smallest staging action

**13 focused context groups PASS**, including legacy/persistent restoration, explicit status override, whitespace/alias handling, negative My Work cases, current permissions, ambiguity and expired context. A scripted primary tool continuation verifies that fresh canonical On Deck enumeration replaces incorrect generated My Work/zero-result prose; it is not live Terra inference and does not prove autonomous primary overview selection. Existing primary model-directed tool choice remains unchanged.

One actual local browser scenario used the unchanged e61d333 application UI with the corrected handler and synthetic Auth/records: **7 In Production → 1 On Deck → CTX-2 only → reopen → CTX-2 only**. Production subject/on_deck selection and the persistent history contract survive. No My Work/task tool access occurred. TypeScript, targeted ESLint, diff checks and final task-only standard build PASS. Focused EM review caught and corrected a whitespace-regression risk; the final source was rebuilt. No broad QA, model benchmark, new real database campaign or paid inference.

After Product acceptance, the smallest TenDev staging is **9415adc5 plus e61d333's five UI/helper files and this three-file Edge correction**, with their focused verifiers. Use the unchanged selective release-proof/build process and restore existing Cloudflare deployment authorization when needed. **No migration, funding, provider or write-control change.** Deploy matching UI/Edge only after approval. Then capture the real affected tab's served assets and inspect one owner-authorized new answer/reopen/follow-up plus the typed redaction reason for an existing placeholder. Do not blindly expose old or revoked content. No TenOps release is authorized.

No hosted mutation, grant, enrollment, approval, invoice upload, operational write, push or deployment occurred. Terra/Qwen, budgets/accounting and all disabled agent writes remain unchanged. Existing localhost servers/output were not replaced; browser verification intercepted only synthetic local TenBot requests with the corrected handler. Task scratch `/private/tmp/tenops-tenbot-build-investigation-20261101`; no branch, worktree, framework or new review port.

[Served builds](evidence/2026-11-01-tenbot-build-verification/served-builds.json), [metadata limitation](evidence/2026-11-01-tenbot-build-verification/deployment-metadata.json), [focused context results](evidence/2026-11-01-tenbot-build-verification/context.json), [browser scenario](evidence/2026-11-01-tenbot-build-verification/browser.json), [build](evidence/2026-11-01-tenbot-build-verification/build.json), [selective predecessors](evidence/2026-11-01-tenbot-build-verification/selective-predecessors.json), [validation](evidence/2026-11-01-tenbot-build-verification/validation.json). Stop for Product acceptance and staging approval.
