# Mobile responsive polish release

RELEASED BOTH. Canonical local/remote main/dev and both served revisions align at `372a7007ada7c79b69278d6beb91d94896d5f953`. Accepted candidate `844e16903df960c8a2cae13f3240e0dafb8db62a`; verified canonical parent `83623d6da1242b813c8c17a9de5d8d43435f04f8`. Integration has exactly the accepted tree.

- tendev: `eb824c94-3f59-4074-b4ca-891136aaccd3`, TenDev / RESEARCH & DEVELOPMENT; 62 served byte matches and the existing essential mobile-maintenance smoke group passed.
- tenops: `48cba687-a296-4cb4-b1a4-f9601936cee4`, TenOps / OPERATIONS CONTROL; 62 served byte matches and the existing essential mobile-maintenance smoke group passed.

Scope: Inbox mobile grid constraints and reachable short-landscape composer; wrapped My Work metadata with bounded task/action columns; matching footer icon/label alignment and softer selection. Footer dimensions and full safe-area background coverage remain unchanged. No new application work during release.

Tier 1 / focused Level 1 release checks, reusing the accepted Tier 2 presentation evidence: five viewport cases, independent review, Production build/TypeScript, targeted lint and diff checks. TenDev built separately with correct branding. Production reused the accepted exact-tree export after current configuration, source identities, all artifact hashes and branding/exclusion checks; NEXT_PUBLIC_DEV_BRANDING=false. Both exports have 266 files; complete manifests and rollback artifacts preserved. Existing release checkouts and helpers reused without new worktrees or test infrastructure.

Main/dev were atomically promoted with skip markers; all four automatic Git-trigger records were confirmed skipped. No active/pending competing deployments at preflight, deployment gates or completion. TenDev passed served-asset, branding and essential browser gates before TenOps deployment. The initial TenDev predeployment read hit expired OAuth (401), before any deployment command ran. Installed Wrangler refreshed the existing session; safety checks were rerun before deployment. No new credentials or scopes requested.

Each served application passed essential portrait/landscape footer geometry and touch bounds, retained bell/removed UPDATE, Jobs/My Work/More/Messages navigation, Inbox opening and no focus/visibility startup replay. Zero browser errors, unexpected external requests, forwarded backend traffic or hosted writes. Candidate layout/metadata/composer and light/dark selection checks were reused. Worker/public assets, Web Push, authentication, Contacts, startup source, Supabase and migrations are unchanged. No live push sends, account creation or database mutations.

Rollback refs `rollback/mobile-polish-20261021-main` / `rollback/mobile-polish-20261021-dev` at `83623d6da1242b813c8c17a9de5d8d43435f04f8`. Prior TenDev `0511e03f-3d33-425e-a207-0df0f3057469`; prior TenOps `ff68e223-526b-494f-8bc1-f6197647fc42`. Bundle `.tmp-mobile-polish-release/accepted-release.bundle`, SHA-256 `45077d1a716604c47d3db04b060e586feafabbcd0e9d58cf916ec74019f1aafb`. Original candidate, unrelated dirty work and worktrees preserved.

Limitations: existing local/hosted Chromium fixture checks, not repeated physical iPhone/Safari software-keyboard or live Web Push certification. [Machine receipt](evidence/2026-10-21-mobile-responsive-polish-release.json). Receipt remains local/uncommitted to preserve the deployed revision. Release verified; no follow-on feature work.
