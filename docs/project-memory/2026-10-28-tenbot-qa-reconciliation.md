# TenBot QA reconciliation and local release candidate — October 28, 2026

**Implemented locally on dev; stop for Product acceptance. No push or deployment.** Chris's current **TENBOT — QA RECONCILIATION & RELEASE CANDIDATE** authorizes focused corrections and a local commit over `ee2baa6`, preserving `dfdef9d`, the five authorized Job tools, Qwen3 and existing privacy/workflows. Separate Advisory context is unavailable. Tier 3 / focused Testing Level 3 covers the combined dispatch, caller authorization, RLS and retained-history boundary. No migration, new worktree, model comparison, framework or hosted TenOps action was performed.

## What the old QA establishes

The independent report evaluated released **`6cb6cf7`**, not current local dev: 52 real questions, 16 failures, eight partial answers, seven permission passes and 21 substantive passes. Those are retained historical outcomes, not current-candidate accuracy statistics. Its seven denials did not exercise the restricted workflows. The original [52-turn transcript](evidence/2026-10-28-tenbot-independent-qa/transcript.json) and [refinement handoff](evidence/2026-10-28-tenbot-independent-qa/refinement-handoff.txt) are retained unchanged as regression inputs; original HTML/source-review/usage files remain in their existing local evidence directory.

Already present before this pass: `dfdef9d` fixes selection/guarded fallback for the compound won-Bid question and mobile document containment; it does not establish successful Qwen prose or resolve the exact Q17/Q18 follow-ups. `ee2baa6` implements [Live Job Intelligence](2026-10-28-tenbot-job-intelligence.md), which none of the 52 old QA questions evaluates as live tool output. The old failure total therefore cannot grade those new tools. Exact source/context replays still exposed the reported selection/authority defects; they were not assumed resolved because dev was newer.

[Full 52-row reconciliation](evidence/2026-10-28-tenbot-qa-reconciliation/reconciliation.json) separates historical verdicts, current corrections and remaining limits. This pass reuses those inputs and focused fixtures; it is **not another 52-question live audit**.

## Reconciled findings

| QA finding | Current correction / evidence |
|---|---|
| Q01 creation availability | Existing `createProductionJob` capability now gates the precise creation source. A denied primary workflow returns an account-specific verified denial, no Available card or inferred action steps. No grant was added. |
| Q05, Q10, Q14, Q23, Q44 | Bounded own-history follow-ups, `fliter`, reporting-period context, captured Sample PDF recovery and personal Task Group/Messaging contrasts select their existing actual workflow. No new FAQ or corpus regeneration. Q14's invented group date-range setting is rejected. |
| Q08 Timeline save | Verified **No**: release stages dates; Review changes, Save all changes and confirmation persist them. Old contradictory prose is rejected. |
| Q17 Bid eligibility | Authorized conversion can omit Job number/committed dates, while saved Won/deposit remain required. New workflow/live dispatch correction prevents “Job number” becoming a record lookup. A real corrected retake returns verified Yes without tools/inference. Denied accounts still receive an account-specific denial. |
| Q18 retry | Existing handoff guide is prioritized; a retry creates/returns the same canonical Job. Recorded prose claiming a retry will “complete the existing Job” is unsupported and now rejects to guide fallback. |
| Q31, Q38 incoming versus stock | Verified read-only facts distinguish PO issuance/pending creation from actual received on-hand quantity. Actual receiving wording is excluded from this negative state decision. |
| Q32 partial receiving | Correct receiving source, not Pending creation; partial receipts are supported. False full-line-only claims reject. HOW-to prose must retain Received By, Confirm Receive, positive quantity and the relationship to the remaining limit; incomplete captured Qwen prose now rejects to the complete existing guide. |
| Q34 history versus writes | Inventory Activity is prioritized; Record Stock/Intake/Outtake cannot substitute for history inspection. Correct warnings about those controls remain allowed. |
| Q35 PO numbering | Existing unlinked draft procedure states first successful Save Draft allocates the stable number, before issuance. Issuance-only numbering rejects. Restricted caller access is separate from feature existence. |
| Q50–52 privacy | Deterministic public policy explains participant-only DM/task access, no routine Admin reading bypass, no independent TenBot DM/task retrieval and explicitly pasted-text support. It distinguishes the separately approved bounded Job tools. |

The eight original partial answers are also reconciled: Q03's omitted final Create Rework now rejects to the complete guide; Q30/Q36/Q42/Q48 lose unrelated or duplicate notices; Q38 gets the explicit receiving transition; Q41 uses read-only Contacts snapshot guidance instead of Proposal issuance. Existing snapshot-preservation wording is reused from verified source, without granting contact/Proposal mutations. Q24 remains a safe but less helpful supplier/lead-time explanation: no predictor, supplier guarantee or employee-facing estimator workflow is added. Permission-gated assessment details remain gated.

## Job Intelligence and integration

Quantitative validation now requires the requested fact, not merely some valid fact. Labor answers need canonical Job identity, recorded total/period and its recorded-hours limitation; overview questions need the requested status/count. Readiness retains recorded material/planning facts, effective/original Rework context and the physical-readiness unknown. The strict existing number/date/unit/subject/unsupported-claim validator remains; it is not a semantic-entailment proof.

Hyphenated Job numbers resolve before descriptive predicates. Canonical owner-scoped follow-ups such as “materials for that job” refetch the right Job; an explicit new Job cannot silently reuse the old seed. Unsupported material-condition counts/status-subset lists clarify their boundary. Deterministic output leads with requested facts while full authorized evidence remains expandable. Questions requiring more than the unchanged six-claim model bound use deterministic output before reserving inference.

Actual integration testing caught an additional current-dev defect: Q17 initially bypassed the correct guide and searched for the words “number or a committed schedule.” The final resolver keeps conversion/receiving procedures out of live Job reads, including after a live lookup. Handler regressions preserve genuine named/numbered Job lookups. The original failed run remains in evidence, explicitly superseded by the corrected actual Q17 retake.

## Actual before / after answers

These are recorded real outputs; modes are explicit. [Actual answers and final no-call validation of recorded failures](evidence/2026-10-28-tenbot-qa-reconciliation/actual-answers.json) preserve the complete examples.

| Question | Old QA / earlier candidate | Current tested result |
|---|---|---|
| Inspect old stock movements | Record Intake/Outtake, falsely “without creating a new record” | **AI:** “open Inventory → Inventory Activity… This is a read-only history and does not record new movements.” |
| Drag release saves immediately? | Yes, immediately, then a contradictory save caveat | **Verified:** “No. Releasing a Timeline drag only stages proposed dates… Save all changes and confirm the save.” |
| Bid without number/schedule? | Both falsely required; first integration run then searched for “Job number” | **Verified, corrected actual retake:** “Yes, an authorized account can convert… Saved Won status and Deposit Received Date are still required… Plan in Production Later…” |
| Captured Sample PDF failed | Generic missing-documentation answer | **AI:** “use Retry PDF on the existing entry under Sample Work Orders instead of generating another issued document.” |
| When does the PO get its number? | Issuance falsely required | **AI:** “The draft gets a PO number upon the first successful save… not during issuance.” |
| TB-2801 recorded labor follow-up | Valid-but-irrelevant status could satisfy validation | **AI:** “Recorded labor: 8.3 hours for 2026-09-29 through 2026-10-28,” with recorded-work limitation and Job identity. |
| How many Jobs are In Production? | A different valid count could satisfy validation | **AI:** “Production Jobs with recorded status In Production: 2.” Active-count question separately returns six in this synthetic scope. |
| Is TB-2801 ready to start? | Subject parsing could include “ready to start” as the Job name | **Deterministic fallback:** recorded material Ordered, Planning Complete, not confirmed arrived, and physical readiness/absence of blockers not established. |

No claimed successful conversational correction replaces an actual failure: Qwen Rework/won-Bid/partial-receiving/conversion-retry prose still sometimes requires verified guide fallback. Recorded omissions or unsupported ownership/completion claims reject under final validation, without another model call. Next-work phase detail also falls back to saved dates and the explicit disabled/unknown boundary. The full existing guide remains accessible through the accepted collapsed source control. These conservative fallbacks and Q24's safe uncertainty are remaining Product quality limits, not evidence of a new unsupported feature.

## Privacy, validation and cost

The original five-tool implementation, query projections, caller-JWT client, RLS and provider/privacy modules are unchanged. No service-role content reader, financial/employee identity/private DM/task/raw-note/document retrieval or new diagnostics were added. Live questions/answers still retain only server-authored lookup markers; follow-ups reauthorize/refetch. Policy explanations never query records and cannot resurrect a prior live Job seed. Explicit pasted-text transformations and confirmed-only feedback retain their prior contracts.

Focused completion evidence:

- 18 exact QA workflow cases using real bounded `serverConversationContext`; existing 113 authored retrieval examples; original workflow-fidelity regressions; harmful-prose/state/permission/negative-wording regressions.
- 20 Job routing/evidence/actual-handler groups, including workflow/live precedence, quantitative relevance, qualifier preservation, new-subject isolation and inference-bound avoidance.
- Six policy-only groups and 81 mock binding/dispatch/privacy cases; no model/network calls in those gates.
- [18 real PostgreSQL groups / 109 direct tool queries](evidence/2026-10-28-tenbot-qa-reconciliation/privacy-jobs.json), caller/RLS/owner/Admin/revocation/history/feedback/private-field sentinels; prior records preserved, no migrations applied, synthetic test reservations remain charged.
- Five real Job browser groups: four validated Qwen answers, one safe model fallback, deterministic ambiguity and no-inference foreground refresh. No request interception/Auth injection by that verifier, page errors or sensitive sentinels.
- [Four mobile/normal-Messaging groups](evidence/2026-10-28-tenbot-qa-reconciliation/keyboard.json), zero inference/page errors: viewport height/pan, bounded multiline composer/Send, balanced scroll restoration, drafts/navigation and original DM send path. [Mobile keyboard](evidence/2026-10-28-tenbot-qa-reconciliation/mobile-keyboard.png), [desktop labor](evidence/2026-10-28-tenbot-qa-reconciliation/desktop-labor.png), [mobile Rework/planning](evidence/2026-10-28-tenbot-qa-reconciliation/mobile-planning.png) visually inspected.
- Application/shared TypeScript, targeted ESLint, diff checks and Production Webpack export pass. The later corrections are server-only, with no frontend import/dependency; final types/lint/focused gates cover them, so the unchanged client export is reused. A TypeScript test-fixture omission and concurrent build-generated-type race were corrected/rechecked; neither is a remaining gate failure. Independent scoped EM review passes. [Validation/source hashes](evidence/2026-10-28-tenbot-qa-reconciliation/validation.json).

Eighteen actual Qwen dispatches in the bounded evaluation window used **16,426 input / 1,975 output tokens**, **136.169 token-derived Neurons**, including rejected and superseded answers. All remain metered; no reset/refund/retry loop. Existing fresh Workers Free verification is reused within its eight-hour boundary. At 15:25:49 UTC Cloudflare reported 665.9575 account Neurons / 76 requests, leaving 9,334.0425 nominal Neurons; delayed analytics and the conservative journal remain distinct. Shared limits stay 300/day, 6,000/month, six/account/minute, 8,000/day and 240,000/month accounted Neurons beneath the 10,000/day Free ceiling. **No paid activation or upgrade; $0 incremental inference charge within the verified Free allowance.** Neuron estimates are not a separate billing measurement.

## Acceptance and release boundary

Review **http://localhost:3000/my-work → Messaging → TenBot**. Original Intake process 77605/port 3000 remains untouched. Only the task-owned adapter 55593 was restarted to load final source; its existing remote binding stays on 55594. Safe examples remain TB-2801 and TB-2805. Raw synthetic artifacts are under `/private/tmp/tenops-tenbot-review/qa-reconciliation-20261028`; selected sanitized evidence is committed. Unrelated dirty Web Push/Contacts work and existing worktrees remain preserved.

No failing local authorization/privacy gate remains in the tested candidate. **Release still requires Product acceptance of the recorded fallback/quality limits and separate release authorization**, then narrow hosted caller-JWT/RLS, logging/privacy, query-plan/deployment checks for the new Job path. Local PostgreSQL role simulation is not hosted HTTP Auth certification. Physical iPhone keyboard remains a manual acceptance item. No new migration is required; the four already released TenBot migrations must not be repeated. Production remains unchanged at `6cb6cf7`. No push, hosted migration/configuration/data mutation or deployment was performed.
