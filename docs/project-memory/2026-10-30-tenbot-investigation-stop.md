# TenBot investigation-to-draft correction — October 30, 2026

Status: **implemented locally; not deployed or write-enabled**. Authority: Chris’s current “DIAGNOSE INVESTIGATION STOP” instruction authorizes the focused correction and local commit. The separate Advisory thread is unavailable. Tier 3 / focused Testing Level 3 applies because this is a source-evidence and privacy boundary; unchanged database/security contracts reuse existing validation.

## Confirmed defect and evidence limit

The accepted hosted source `65e52868fed5c11e1fef310fdfd7b04bdd9a4b10` requires supplier and invoice identities on single colon-labeled lines. The actual synthetic PDF extraction has `Supplier` and `T&M Supply` on adjacent lines, and aligned invoice-reference/date header and value rows. Catalog investigation correctly identifies Alaska White #0, **1 Bag**, but `check_receival_duplicates` deterministically rejects that metadata as `unsupported_invoice_metadata` before calling the receival reader. Draft preparation requires a successful duplicate check, so this valid document cannot reach preparation through that contract.

[Exact accepted-source replay](evidence/2026-10-30-tenbot-receival-readiness/investigation-stop/baseline-metadata-replay.json) captures this safe reason code. It is a deterministic replay, **not a recovered hosted tool trace**. The old hosted terminal `agent.reason` was not retained. One bounded aggregate-only log query found no retained matching reason/structured event in the request window; [log summary](evidence/2026-10-30-tenbot-receival-readiness/investigation-stop/hosted-log-summary.json). The historical terminal reason, error count and precise model continuation remain unknown. Six investigation calls do not prove a step limit, authorization failure or timeout.

## Focused correction

- Bind complete supplier/reference values to their own source labels using existing inline labels, adjacent label/value lines or corresponding aligned table columns. Reject partial identities, foreign references, material/manufacturer substitutions, wrong date columns and ambiguous headers.
- Keep source quantities, catalog candidates, duplicate-read completeness and existing review/approval contracts unchanged. **1 Bag remains 1 Bag**; the catalog’s 50 LB package capacity does not become the receival quantity.
- Emit only `stage`, `tool`, `outcome`, `durationMs` and `reasonCode`. Server allowlists and a fresh projection redact unknown tool names, arbitrary exception/provider text and extra fields. No invoice content, identity, arguments, results, records, credentials or model context enters this sink. Hosted invoice events use the existing Edge logging infrastructure, not a new history store.
- Record the fatal tool failure before enforcing the error limit. Distinguish extraction, source persistence, model/tool execution, investigation, draft construction and draft persistence. Best-effort telemetry cannot change authorization, accounting or execution outcomes.

No routing, limits, funding, permissions, schema, migrations, UI, quantity calculations or write behavior changed. The unrelated pre-existing `after_tool` latency correction is excluded from this candidate.

## Focused validation

[Summary and source hashes](evidence/2026-10-30-tenbot-receival-readiness/investigation-stop/validation.json):

- **7 focused investigation groups passed**, including exact accepted-source failure reproduction, 11 adverse metadata variants and the real runtime/session/tool code path. Scripted model transport and simulated caller-scoped database/Storage replies are explicitly identified; this is neither live model reasoning nor JWT/RLS proof.
- The corrected [runtime replay](evidence/2026-10-30-tenbot-receival-readiness/investigation-stop/corrected-investigation-replay.json) proceeds through extraction, catalog search, duplicate read and preparation to one valid **1 Bag** review draft. Source evidence remains 1 Bag, held reasons are empty, source-state persistence is exercised through the simulated store, and `executionEnabled=false`, `canApprove=false`. No durable approval or business mutation RPC is called.
- **8 diagnostic privacy/failure groups passed**: strict five-field projection, unknown names/error redaction, fatal third-tool capture, authorization/provider failures, sink failure isolation and hosted sink projection. [Receipt](evidence/2026-10-30-tenbot-receival-readiness/investigation-stop/diagnostics.json).
- **20 existing invoice regression groups passed**, reusing the adjacent suite rather than a broad QA campaign. TypeScript, explicit `--no-ignore` affected-source/test ESLint, diff check and standard optimized webpack build passed. The exact focused-source archive restores the excluded pre-existing authorization line; no secrets or `.env` files were copied. The normal prebuild verified packaged knowledge integrity only; **no selective release-proof/hosted attestation is claimed**.
- New inference cost **$0**. No hosted mutations, uploads, approvals, grants, enrollment, canary execution, migrations, push or deployment. Existing OFF controls and historical accounting were not changed. No review server or port was created; localhost:3000 was untouched.

## Remaining gate

Product acceptance precedes selective TenDev release preparation. A future separately authorized, bounded read-only hosted check must confirm actual Deno/log delivery and real model continuation from this PDF to a draft with all write gates OFF, under approved funding and caller permissions. Existing one-shot funding must not be reset or silently reactivated. Real receival execution still requires separate Product authorization; this correction is not another write canary.

Task-owned scratch/build/archive: `/private/tmp/tenops-tenbot-investigation-stop-20261030`. Historical canary receipts are preserved without rewriting their claims. Unrelated dev work remains uncommitted.
