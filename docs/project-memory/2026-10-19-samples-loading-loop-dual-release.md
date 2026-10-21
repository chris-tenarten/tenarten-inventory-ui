# Samples loading-loop fix — TenOps and TenDev release

**RELEASED BOTH** October 19, 2026. Accepted candidate, canonical main/dev, origin/main/dev and both served SHAs: `f9230b9606d629567caea28a61401ba592951882`. Base for both hosted environments and canonical branches: `a79e13dadee7a3489cb05fdc3ea0c129edb810aa`. Chris accepted the localhost workspace and explicitly authorized only this fix for both environments, preserving the established environment branding and release rules.

A verified complete-history candidate bundle and separate isolated exact-commit worktrees are preserved under repository `.tmp-samples-dual-release/`. The exact accepted three-file boundary fast-forwarded without conflicts or unrelated source changes. Runtime change is limited to `auth.refreshProfile`: preserve the already-verified decision for explicit revalidation of the exact unchanged session, preventing the Samples mount/refresh/shell-unmount feedback loop. Initial/session-change pending gates, failure/denial, stale-response protection, capabilities and backend authorization remain intact. Sample formula/calculation/issuance/PDF/label/DYMO/Post to Job code is unchanged.

## Environment isolation and verification

- **tenops**: https://tenops.pages.dev/samples — `TenOps / OPERATIONS CONTROL`. Deployment `b77b95fa-c0ad-4ba2-8098-27ead396fabe`, created `2026-10-19T15:15:51.643513Z`. Development branding explicitly `false`. All 32 checked routes/assets match that environment's isolated export byte-for-byte.
- **tendev**: https://tendev.pages.dev/samples — `TenDev / RESEARCH & DEVELOPMENT`. Deployment `d5146872-aef9-4f5a-8a4a-062a5a45fe50`, created `2026-10-19T15:14:21.879223Z`. Development branding explicitly `true`. All 32 checked routes/assets match that environment's isolated export byte-for-byte.

One Production-mode webpack/TypeScript build per target; mandatory branding verifier and actual generated export inspection passed separately. No .env.local in either worktree; correct existing project public Supabase configuration retained; no local review guard runtime exported. Main/dev pushed atomically with `[CF-Pages-Skip] [CI Skip]`. All four automatic Cloudflare builds were confirmed skipped. TenDev was manually deployed and verified first, then TenOps using its separate Production-branded artifact. Existing environment source features are inherited from each verified a79e13d baseline; only the accepted hotfix delta was added.

Tier 3 release checks reuse the seven accepted local browser groups and Chris's successful localhost review. Narrow checks against each actual served Samples bundle passed direct entry and refresh: two expected profile requests per load, one initial restoration entrance, no repeated restoration flashes or request loop, zero client exceptions. All Auth/data traffic in these browser checks was intercepted in isolated synthetic sessions; no real account, permission or hosted business data was mutated. No broad suites repeated.

No migrations, Edge deployments, permission changes, Supabase configuration changes, hosted business-data writes or external announcements. The local review remains available. Release receipt files remain uncommitted project memory outside the deployed boundary; no extra push/deployment.

## Exact deployed files

- `docs/project-memory/2026-10-19-samples-access-refresh-loop.md`
- `scripts/verify-samples-access-refresh.mjs`
- `src/lib/auth.tsx`

[Machine release receipt](evidence/2026-10-19-samples-loading-loop-dual-release.json). STOP AFTER RELEASE.
