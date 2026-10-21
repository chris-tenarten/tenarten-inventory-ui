# Mobile Early Access release — 2026-10-20

**RELEASED BOTH.** Canonical local/remote main/dev and TenDev/TenOps are aligned at `00c4fca4a1433eae0120f7103244721c6f1d2fb9`.

| Target | Deployment | Branding | Verified assets | Smoke |
|---|---|---|---|---|
| tendev | `e0e341a3-180e-4514-9976-41216bc5992d` | TenDev / RESEARCH & DEVELOPMENT | 55 | 13 passed |
| tenops | `7b155f27-1f83-4971-aa4b-8171c4ff4d9e` | TenOps / OPERATIONS CONTROL | 55 | 13 passed |

Accepted candidate `e9cfb5aca64c52dfcbd015a9b68e9becd5002a0f` remains preserved with its original worktree. Integration `00c4fca4a1433eae0120f7103244721c6f1d2fb9` applies its 57 paths onto startup baseline `051f23b81947577c2f4a91fb863df372342622bb`. The only integration conflict joined the two independently appended CSS sections: startup CSS remained verbatim and mobile CSS was appended. Startup animation, 1,850 ms hold, auth/refocus, Manpower, public assets, Supabase and build configuration remain unchanged. No new application implementation was performed.

The stopped assertion assumed the first bar was Retrieval Job 0. Established Timeline sorting is historical grouping, planned start, planned finish and record identity. Fixture Job 2 correctly precedes Job 0 (October 1 versus October 17). Only the existing smoke runner was corrected: filter the expected Production Job and locate its bar by UUID; verify its name and clipping. Combined references also use explicit identity. The corrected gate and previously unrun Bids gate passed; the three earlier successful local groups and existing TenDev build were reused. No new harness or comprehensive audit.

Risk Tier 3 release discipline, focused Testing Level 2 behavior/served checks plus unchanged high-risk contract boundaries. Existing accepted candidate TypeScript, lint, adapter and browser evidence was reused; integrated TenDev build and targeted lint/diff passed. One isolated Production-mode build per branding excluded local env/review runtime and retained existing Supabase configuration. TenOps explicitly used NEXT_PUBLIC_DEV_BRANDING=false. Atomic canonical promotion followed verified recovery bundle creation. Four automatic builds were skipped. TenDev deployed and passed all gates before TenOps build/deployment. Final deployment configurations match preflight snapshots.

Each environment passed all 13 actual-served-bundle groups: startup sign-in; full sequence/1.85-second hold; desktop skip/session/refocus protections; mobile skip; readiness gating; reduced motion; failed artwork; initialization error; denied access; complete 12,888-record Manpower progressive history; mobile navigation/Inspector Back and draft protection; Production Timeline identity/pan/clipping/Key/themes/orientation; read-only Bids/Combined semantics. Zero client exceptions, unexpected external requests or forwarded backend calls. All Auth/data used intercepted synthetic fixtures; no hosted business writes. Hold timings: {"tendev":[1861],"tenops":[1859]}. These are bundle compatibility checks, not Production latency measurements or live-account/RLS certification.

Rollback refs `rollback/mobile-early-access-20261020-main` and `rollback/mobile-early-access-20261020-dev` preserve `051f23b81947577c2f4a91fb863df372342622bb`. Prior deployments remain TenDev `6e794e8a-175c-41a8-9d3f-76ea442dfd41`, TenOps `2f5e90a3-e120-4cde-9b39-afd29eca703f`. Verified recovery bundle: `.tmp-mobile-release/accepted-00c4fca.bundle`, SHA-256 `bd5520a54fbb9428b5c0846cf265061d832f2ee0f7a27ab0488403953cdd982f`. Earlier refs/deployments remain intact.

Root research files overlap nine newly tracked candidate paths. To preserve those files in place without overwriting or moving them, the root checkout remains detached at the prior baseline; all nine SHA-256 hashes were checked after promotion. Main/dev refs are current. Use `.worktrees/mobile-early-access-release` for the integrated application. The original candidate and other feature worktrees remain untouched.

Physical iPhone Early Access checklist: Safari/Home Screen startup and skip, 1.85-second hold and no replay after refocus; portrait/landscape safe areas; keyboard and unsaved Back/Close; Timeline one/two-finger gestures and native edge Back; name clipping and selection identity; Production/Bids permissions and existing editor handoff. No unrelated mobile refinements were started.

[Machine receipt](evidence/2026-10-20-mobile-early-access-release.json). The previous stopped receipt, helper correction, logs, build manifests, private configuration snapshots and recovery bundle remain in `.tmp-mobile-release/`. Receipts stay local/uncommitted to retain the exact approved canonical/deployed revision. Release verified and complete.
