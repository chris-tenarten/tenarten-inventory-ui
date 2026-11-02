# TenDev quota and bounded token telemetry source proof

## Candidate technical source review — quota retry and bounded token telemetry

Chris's current November 2 instruction authorizes the focused correction after genuine Terra provider diagnostics proved HTTP429 with error.type insufficient_quota. Retrying cannot restore the account credits or spend limit. Local implementation ff8098ebdff7085acbd8179e76d4f2a945ec24de includes that known permanent-quota retry correction, finite safe billing-code metadata and the four bounded token counters required for the actual acceptance report. The Advisory thread is unavailable. Final Product acceptance is pending actual resumed conversational evidence; no accepted source SHA is fabricated.

Scope: tendev-preparation.
This review is not evidence of hosted application or deployment.
This review grants no migration application, write activation, push or deployment authority.
Product acceptance remains pending for these technical changes.

| Path | Git blob | SHA256 | Authority | Kind | Accepted authority revision |
|---|---|---|---|---|---|
| supabase/functions/_shared/tenbot-openai.ts | 5fefd1bdbab029b121bb32b00c0839e507b9d7c0 | 5d804e670dc72eda3ed9614c72a9c7e31d5802b1396d053f54ce89d5eba7c0b5 | technical-review | runtime | none |

Sole source parent: 41e387c028fa845bdd460a63092368964bdb4c03. Exactly one committed runtime module and the existing focused verifier are selected. An HTTP429 response with exact error.type insufficient_quota is no longer automatically retried. Temporary429 and all server5xx failures retain the original one-retry behavior. The four documented organization_usage_limit_exceeded, organization_spend_limit_exceeded, project_spend_limit_exceeded and credit_balance_exhausted codes are added to the finite safe projection. Official source: https://help.openai.com/en/articles/6614457-troubleshooting-api-usage-and-spend-limits.

The existing safe metadata hook additionally projects inputTokens/outputTokens/cachedInputTokens/cacheWriteTokens as bounded integer-or-null values from the provider usage object. Input/cache counters are bounded at500000 and output at100000; valid zero is preserved, while missing, nonnumeric, fractional, negative or excessive values become null. The existing Edge projection reapplies these constraints before the acceptance-only logger. These are numeric telemetry, not a change to usage eligibility or accounting. No raw payload, text, identity or credential enters the hook.

The unknown-cost hold from the first attempt is still retained; no usage is fabricated as zero or settled. Financial policy, ledger rows, reservations, imports, historical local journal and previous holds are not changed by this package. Provider request, endpoint, credentials, pricing, response validation, token/round/cost profile, tool registry, context, factual publication and all other retry behavior remain unchanged.

Existing exact TenDev/owner/window acceptance eligibility, before-reserve/before-fetch checks and acceptance-only safe metadata diagnostics stay unchanged. Ordinary Production funding and operational write gates remain OFF according to root-owned release evidence; source packaging does not mutate or freshly attest hosted state. Production persistent-history eligibility remains exactly as preserved in the source parent. No new handler, framework, operational source, permission, migration, profile adjustment or provider invocation is introduced.

Sixteen focused offline groups, targeted TypeScript, explicit Edge ESLint and diff checks passed on these exact bytes. Added groups prove one provider call and one conservative unknown hold for permanent insufficient_quota, the preserved two attempts/two holds for temporary429 and503, finite billing-code projection with arbitrary error content excluded, and bounded token counters with zero/unknown distinctions and idempotent reprojection. Earlier acceptance/metadata groups are directly adjacent coverage; no broad test campaign was rerun. These are synthetic transport/RPC checks, not live model or database proof.

This remains an Edge-only package. Pages stays at278165095eb000b69610f903424e951ce320acdb. Existing frontend/migration files, knowledge claims/semantics/release pins, generator and release verifier remain unchanged. Exact source reviews and generated integrity metadata alone refresh. Previous proof checkpoints, accounting receipts and superseded reviews remain retained. One exact standard proof/build precedes any root-owned deployment; this packaging activates no provider or funding and performs no live retry.
