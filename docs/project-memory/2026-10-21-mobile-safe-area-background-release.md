# Selected footer safe-area background release

RELEASED BOTH. Canonical local/remote main/dev and both served revisions: `83623d6da1242b813c8c17a9de5d8d43435f04f8`.

Accepted candidate `3eaff7bab6effdaa87d45bbb41c0c5bcd2168a69`; verified latest parent `c490747c08404a3b2877538404d9af8bf98460a6`. Integration exactly matches the accepted candidate tree. Only application change: selected mobile navigation background extends through the bottom safe-area padding; 44px controls and 79px portrait footer remain unchanged.

- tendev: `0511e03f-3d33-425e-a207-0df0f3057469`, TenDev / RESEARCH & DEVELOPMENT; 62 served byte matches and one existing essential mobile-maintenance smoke group passed.
- tenops: `ff68e223-526b-494f-8bc1-f6197647fc42`, TenOps / OPERATIONS CONTROL; 62 served byte matches and one existing essential mobile-maintenance smoke group passed.

Tier 1 / focused Level 1 release. Reused accepted 36 layout combinations, physical iPhone footer preview, physical cut-line replay, Production build, TypeScript, lint and diff evidence. Separate TenDev build passed. Exact-tree Production export reused after source, current public configuration, artifact hashes, branding, local-env and review-marker exclusion checks. Production branding explicitly false. Existing release checkouts/helpers reused; no additional worktree or new verification script.

Atomic main/dev promotion used skip markers; all four Git-trigger records were confirmed skipped. TenDev deployed and passed essential asset/branding/smoke gates before TenOps deployment. No competing deployments at the gates or completion; source/environment configuration unchanged. Complete artifact manifests and verified rollback bundle preserved under `.tmp-safe-area-release`.

Production Web Push implementation, worker bytes, manifest identities, authentication, Contacts, startup animation and other application functionality preserved. No migration, database/RLS change, hosted business-data mutation, new credentials/scopes or infrastructure change. Accepted physical preview evidence reused; no repeated phone or live-push certification. Hosted smoke used intercepted fixtures and forwarded no backend requests.

Rollback refs `rollback/mobile-safe-area-20261021-main` / `rollback/mobile-safe-area-20261021-dev` at `c490747c08404a3b2877538404d9af8bf98460a6`. Prior deployment IDs and bundle SHA-256 are in the [machine receipt](evidence/2026-10-21-mobile-safe-area-background-release.json). Original candidate and unrelated root/worktree state preserved. Receipt remains local and uncommitted to preserve the deployed revision.
