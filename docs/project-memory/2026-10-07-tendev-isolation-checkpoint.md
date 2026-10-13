# TenDev isolation — infrastructure checkpoint

Authority: Chris authorized read-only infrastructure inspection and local reconstruction, with approval required before hosted infrastructure/configuration changes. No MRP implementation is authorized until isolation is verified. Risk tier: 3. Canonical repository HEAD/dev/main at the start of this checkpoint: `8255a1e7cb10d7ab9cc86a9024e4a1f38aed07d4`.

## Verified infrastructure

- Supabase CLI project discovery returned one accessible hosted project: `tenartenDB`, ref `vxdxjhazkqhpkwdqtobp`, organization `uxxhpnseynojdgabanrv`, region `us-east-1`, healthy PostgreSQL 17. No separate hosted development project was discovered. This is scoped to the authenticated account's accessible projects.
- Cloudflare API inspection succeeded after Wrangler refreshed its existing OAuth session. Pages `tenops` tracks GitHub `main`; Pages `tendev` tracks `dev`. Both have automatic branch deployments enabled and preview Git deployments disabled. Both production AND preview backend URLs point to the Production Supabase ref. Both build with `npm run build` and publish `out`.
- Both Pages canonical deployment metadata reported `30680b537fd0d0f2bf985ff577faee72a0242646`. This is deployment metadata, not an independently verified served-SHA attestation. Repository HEAD is newer.
- TenDev production config explicitly requests development branding; TenOps does not. `next.config.ts` and `src/lib/branding-environment.mjs` constrain exported development branding to the TenDev Pages hostname. Branding does not guard backend identity.
- Pages configurations contain public Supabase URL/anon key, not service-role credentials. Root `.env.local` and `supabase/.temp/project-ref` target Production. Do not copy either into a TenDev worktree or rely on implicit linked-project targeting.
- Auth settings read returned email provider enabled, signup enabled, email confirmation required, anonymous sign-in disabled. Private Auth configuration (redirects/site URL/SMTP/hooks) was not exported or attested.
- Storage bucket metadata read returned ten private buckets: job-attachments, project-task-attachments, purchase-order-documents, job-transmittal-documents, receiving-documents, proposal-documents, my-work-attachments, bid-files, sample-documents, my-work-inbox-attachments. Recreate reviewed bucket metadata and policies, never objects. Bucket limits differ; do not infer them from one migration.
- Eight deployed Edge Functions were listed. Seven application/document/admin/cleanup functions have gateway JWT verification enabled. Legacy `monday-material-check` has it disabled and is outside the proposed TenDev baseline until its source and external side effects are audited. No functions were invoked or deployed.
- Existing Docker stacks include permission-review and messaging-isolated Supabase components, plus Production Blend PostgreSQL fixtures. They are local partial harnesses, not verified complete application baselines. Auth QA explicitly disables Storage, Realtime and Edge runtime.

## Schema baseline and dependencies

An official CLI schema-only export succeeded to `/tmp/tenops-isolation-schema-audit.sql`, restricted to owner read/write. It is a raw audit artifact, not an approved migration or repository artifact. It contains 975,311 bytes, 94 CREATE TABLE statements, 275 function definitions and 428 policies. All six checked core tables exist: inventory_items, inventory_transactions, pending_receivals, vendor_catalog_v2, jobs, app_users. GRANT/REVOKE and RLS statements are present.

Initial screening found no top-level COPY/INSERT data statements and no matches for JWT, Supabase secret-key or PAT patterns. This is preliminary screening, not proof that every function literal/comment is free of sensitive content. Do not commit or apply the raw export. No business records, Auth users or Storage objects were exported.

The export includes pg_cron, pg_net, pgcrypto, uuid-ossp, pg_stat_statements and Supabase Vault extension dependencies. It contains `dispatch_messaging_cleanup`, hardcoded to the Production Edge endpoint and referring to Vault secret names. Exclude/replace that dispatcher in the development baseline; leave schedules and integrations disabled until reviewed. Never copy Vault values or external-integration secrets.

The historical migration directory cannot safely bootstrap an empty project: initial migrations alter pre-existing inventory/catalog/receiving tables; reference-data migrations seed real vendor/contact/worker data; the forbidden `20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql` remains superseded. Existing fixtures approximate selected modules. Use a reviewed snapshot baseline, then only explicitly selected development migrations. Do not copy Production's migration ledger or blanket `db push` the historical directory.

Still required: application-specific Auth/Storage triggers/policies outside the default export; Realtime publications/authorization; role-capability and other required configuration rows recreated from reviewed definitions; bucket metadata; email templates and development-only redirect configuration; Edge source/version and secret-name inventory; local restore and relevant RLS/RPC/document verification. Catalog/demo rows must be fictional. Operational/configuration rows need a separate explicit manifest, not an unrestricted data dump.

## Recommended plan for approval

1. Create a dedicated worktree from canonical HEAD. Prepare and screen a schema baseline locally, reconcile platform-managed dependencies, restore to a fresh full local Supabase stack, and verify grants/RLS, Auth, Storage, RPCs and document workflows using fictional records.
2. Provision a separate hosted Supabase project only after Chris approves the option/cost. Retain Production unchanged. Use new Auth users, empty private buckets, independent keys/secrets and an independent baseline migration history.
3. Initialize the reviewed baseline; deploy only audited application Edge Functions to the explicit development ref; recreate only approved configuration/fictional fixtures. No Production credentials, schedules, users, objects or business data.
4. Update only TenDev production AND preview env settings after backend verification. Use an explicit manual Pages deployment targeting `tendev` for feature candidates; do not push/merge `main` or use a broad promotion script. Preserve existing environment branding safeguards.
5. Verify hosted frontend endpoint, API/Auth/Storage/Edge project identity, denied cross-environment credentials and exact served candidate SHA. Reconfirm TenOps mapping/configuration unchanged, then stop for Product review.

Proposed guard: checked-in environment manifest and fail-closed prebuild/deploy checks binding Pages project/hostname to an approved Supabase ref and public key issuer/ref where available; reject Production ref for TenDev, development ref for TenOps, ambiguous hostnames, missing env, and service-role keys in public/build output. Modern opaque keys require backend identity attestation rather than JWT decoding. Migration/function wrappers require explicit development ref/workdir, reject Production ref and implicit links, check destination and approved artifact hashes, and inventory outbound Production URLs. Do not depend solely on frontend guards: sanitize database functions and Edge secrets and verify backend resources too. Negative tests must prove mismatches are rejected without deploying.

## Options, estimates and costs

- Existing hosted development project: none discovered; cannot presently reuse one.
- Separate Free-plan project if account/organization eligibility permits: $0/month; current published limits include 500 MB database, 1 GB Storage, two active Free projects and pausing after one week of inactivity. Suitable for intermittent fictional-data review; eligibility not verified.
- Additional Micro project in an existing paid organization: published starting incremental compute cost $10/month, plus applicable usage. Organization billing plan/allowances were not verified. New Pro organization starts at $25/month with one Micro covered by compute credits.
- Fresh local full Supabase: no additional hosted subscription; existing machine/Docker resources. Sufficient for implementation/integration tests and localhost review, but not a durable remotely accessible TenDev backend. Do not expose a localhost development stack publicly as a shortcut.
- Engineering estimate: 1–3 working days for schema/configuration reconstruction and local validation; roughly another half to one day for hosted setup, guards and isolation verification if access/dependencies cooperate. Planning estimate, not measured completion time.

Sources checked October 7, 2026: https://supabase.com/pricing ; https://supabase.com/docs/reference/cli/supabase-db-dump ; https://supabase.com/docs/guides/local-development/cli-workflows .

## Boundary and verification

No application changes, MRP work, commits, pushes, deployments, migrations, hosted configuration changes, function invocations, business-data writes or permission changes were performed. The schema export CLI reported "Initialising login role" as its connection setup; do not characterize this as proof of literally zero database-side activity. The requested operation was schema-only read/export. No broad application tests/build are warranted for this audit document; validate its diff/paths only.

Approval required next: confirm the isolated-project option and cost ceiling, and authorize hosted setup/TenDev reconfiguration under the plan above. Local baseline preparation is already authorized and can proceed independently; hosted changes remain stopped.
