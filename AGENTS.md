# TenOps durable agent guidance

Read this file before planning, implementation, review, migration, or release work. Keep durable project memory in the repository, not in a long-lived conversation.

## Authority and evidence

Product intent, in descending order: Chris's current explicit decision; the canonical **TenOps — Advisory & Implementation** Product/Architecture thread; durable product decision records; legacy references; clearly labeled inference.

Implementation state, in descending order: actual repository and Git state; narrowly verified hosted schema/configuration/behavior; recent release evidence; durable repository documents; conversational summaries. Re-inspect whenever current state matters. Never let stale documentation override a current product decision, or a conversation claim override repository or hosted reality.

Chris alone approves material product/UX decisions, migration application, Production data mutation, destructive operations, privacy/RBAC policy changes, pushing or releasing `main`, Production deployment, external announcements, and major scope expansion.

## Working-tree and release discipline

- Inspect branch, status, relevant source, migrations, and release boundary first.
- Preserve unrelated dirty work. Do not discard, rewrite, stage, or commit it.
- Dev may intentionally contain unreleased work. Promote only an approved boundary; selective cherry-pick is valid. Never merge `dev` wholesale merely because it is ahead.
- Do not commit, push, deploy, apply migrations, or mutate hosted data without the applicable authorization.

## Domain, privacy, and migrations

- `public.jobs` is the one canonical Production Job model. A Bid entering Production may create/link exactly one canonical Job only at the approved gate. Never fabricate a Production Job or pseudo Job number for Pre-Production work.
- Documents such as Proposals and Sample Forms may exist before and independently of a Production Job. Issued documents retain their historical snapshot when later context is acquired.
- My Work and Inbox content is private to authorized participants. Administrative lifecycle/cleanup authority is not permission for routine content-reading bypass.
- Migrations are append-only, forward-only, narrow, and independently reviewable. Never edit an applied migration. Repository or migration-ledger presence alone is not proof of hosted state; verify required objects, policies, grants, Storage, Realtime authorization, or behavior narrowly.
- `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql` is superseded and must never be applied wholesale. Reintroduce any still-useful rule only through a new, narrow, reviewed migration.

## Verification and implementation boundaries

- Choose and state the smallest sufficient risk tier before directing implementation: Tier 1 for tiny/low-risk changes, Tier 2 for normal bounded features, or Tier 3 for schema, security/privacy, destructive lifecycle, canonical-record, Production-data, or multi-module architectural work. Optimize for engineering confidence per unit of agent work.
- Tier 1 normally needs one lightweight implementation pass and narrow validation. Tier 2 normally needs one capable self-validating implementation pass plus one EM diff/evidence review. Tier 3 justifies stronger implementation, deeper EM review, and focused adversarial/security verification. Add corrective or independent passes only for a real deficiency or risk.
- Use risk-proportionate validation: focused checks for small changes; relevant verifier, lint/type checks, and browser behavior for ordinary features; deeper schema, security/RLS, build, and hosted checks for release-sensitive work.
- Prefer repository verifier scripts under `scripts/` and report their actual outcomes. Do not claim browser, hosted, or migration verification from inspection alone.
- Do not duplicate a relevant deterministic validation merely because the EM is reviewing. Rerun when evidence is missing, code changed afterward, results are suspicious, risk warrants independence, or the exact release candidate requires it.
- Reuse a worker for a small correction while its bounded context remains clean. Start fresh when context is bloated/confused, stale assumptions recur, scope materially changes, or independent high-risk review is justified.
- Escalate genuine Product decisions to Product/Chris instead of spending engineering passes inferring intent. Resolve engineering questions from repository evidence where possible.
- Application builds and broad suites are unnecessary for documentation-only work; inspect the diff, links, and changed paths instead.
- Pre-Production/Bid/Sample lifecycle work is **not implementation-authorized**. Product/Architecture must first issue a Product Acceptance Contract resolving the open semantics in `docs/project-memory/OPEN_QUESTIONS.md`.
