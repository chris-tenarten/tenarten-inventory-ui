# TenBot live history selective source proof

## Accepted candidate source review — bounded live history, November 1, 2026

Chris accepts a00d62e354f4c5086d2ca5ad9bb9c87d31a40a60 and authorizes APPROVED LIVE ANSWER HISTORY STAGING on TenDev.

Scope: tendev-preparation.
This review is not evidence of hosted application or deployment.
This review grants no migration application, write activation, push or deployment authority.

The current separate Product instruction authorizes only the compatible two migrations, TenDev UI/Edge deployment and private purge configuration after proof.

| Path | Git blob | SHA256 | Authority | Kind | Accepted authority revision |
|---|---|---|---|---|---|
| supabase/functions/_shared/tenbot-operational-history.ts | 43e7f98f10a3e91e5c9f48f07ced8e99df735ee8 | 4d8435ae37aa6f95a1e5f3adf4583c7ad82cf7d8c8a5654ce01a949a09c4d2d0 | product-accepted | runtime | a00d62e354f4c5086d2ca5ad9bb9c87d31a40a60 |
| supabase/functions/_shared/tenbot-agent-history-store.ts | f1a0eeccd9fd676416482bc643d5ed91f18c1c07 | d2d34a13c696b26a38880e004627f05a6b90bdf585c05c4ffce4862059f2421f | product-accepted | runtime | a00d62e354f4c5086d2ca5ad9bb9c87d31a40a60 |
| supabase/functions/_shared/tenbot-conversation-context.ts | 8dc0ddf2b32a553dc442d091f43ee68328c40e1e | 72b99a701bc37c2e57ed12cb72d1984e40c6afb6c8bceb4b7b8ce12e38187cc9 | product-accepted | runtime | a00d62e354f4c5086d2ca5ad9bb9c87d31a40a60 |
| supabase/functions/_shared/tenbot-job-routing.ts | ea993275b38186a539fcdb470441202391415fd6 | e0a111b97d28033c0c5b52d33553b01184c46b0969dbc26c364f20b13122a03c | product-accepted | runtime | a00d62e354f4c5086d2ca5ad9bb9c87d31a40a60 |
| supabase/functions/_shared/tenbot-job-session.ts | 04a943f15d0be767fba4bc8ede4b26389fee2680 | d147c0e05a8c0fd15583bd7a76f2e57d6a152bd7947da3d2a42a6c907462d20c | product-accepted | runtime | a00d62e354f4c5086d2ca5ad9bb9c87d31a40a60 |
| supabase/migrations/20261101180000_tenbot_reauthorized_operational_history.sql | 44b7a835f3d9f70e38b873b0d6433c4062f95188 | 67ce36cca4e5ecee965182e544ef588c70f18f17125992089a556cf14a0ad342 | product-accepted | unapplied-migration | a00d62e354f4c5086d2ca5ad9bb9c87d31a40a60 |
| supabase/migrations/20261101181000_tenbot_operational_history_retention.sql | da3818f66fd9e2daad1a5c4a3a2a04db21aa6e25 | 8dda0d2e7dcb665f4b589f3cd16c15269b66ff41900db2b80ea46a0b7b85a472 | product-accepted | unapplied-migration | a00d62e354f4c5086d2ca5ad9bb9c87d31a40a60 |
| supabase/functions/_shared/tenbot-agent-operations.ts | 47426326a951f007ab9e56747b1a9d34c43da93a | 28d8f88895d12dcdb38c3f4a799323256da7cf03890304afb6f64d37c20e1a5a | product-accepted | runtime | a00d62e354f4c5086d2ca5ad9bb9c87d31a40a60 |

## Candidate technical source review — TenDev transport compatibility, November 1, 2026

Product acceptance remains pending for these technical changes.

Scope: tendev-preparation.
This review is not evidence of hosted application or deployment.
This review grants no migration application, write activation, push or deployment authority.

Technical release integration is necessary because the current Production UI rejects the new content scope. A server-only TenDev-origin gate preserves its prior volatile-answer/history transport. It does not change caller permissions, model providers, budgets or tools. Source acceptance must not be misrepresented as exact a00d62e bytes for these two modules.

| Path | Git blob | SHA256 | Authority | Kind | Accepted authority revision |
|---|---|---|---|---|---|
| supabase/functions/_shared/tenbot-agent-session.ts | 370a9be6c18c9a4edcb1589e78ce2503c3e2d60c | 791d47a97e9dddfb5b49093a7636ec264a192ff455d9880059ab19f002883388 | technical-review | runtime | none |
| supabase/functions/_shared/tenbot-hosted.ts | f3923f458e5cce2679a473704dac933f33fcfdfd | 046517b84ae57dec8c178d86d3e340c99923cb0932fbe83a895b1229fa97df4f | technical-review | runtime | none |

Tier3/focused Level3 release integration. Advisory thread unavailable; current explicit Chris instructions govern. Reuse accepted 44 deterministic groups,12 genuine PostgreSQL/JWT/RLS groups,5 private purge checks and5 local browser checks. New staging guard is verified with the existing narrow deterministic verifier. Two migrations remain accepted-but-unapplied source contracts, not deployed evidence. Knowledge claims/permission grants and provider/spending configuration remain unchanged. Readable rendered answers expire after10minutes,max4; exact caller-authorized reads are repeated before display. No raw results, model-native continuation, credentials or private display prose enters model memory. No operational writes, inference funding, grants, enrollment or new permissions. The existing trusted postgres scheduler can call the private count-only purge each minute without service-role permission or an HTTP queue; existing hourly signed invoice cleanup stays unchanged.
