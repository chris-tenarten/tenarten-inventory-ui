# TenOps Auth resilience release proof

## Accepted manual Auth source review — Production-only bounded restoration

Chris accepts exact Auth authority `ec62998aba228e615279ae7d6e81f04378e62062` and authorizes an Auth-only release, TenDev first and TenOps only after the required TenDev acceptance and target-specific release gates. This script prepares the separate Production candidate; it performs no build, push, deployment or hosted change. Separate Advisory context is unavailable; Chris's current explicit decision governs. Tier 3 / focused Testing Level 3.

Production baseline: `2a3e45c64163968d421d77b5a41a49f5ac469fc2`, tree `e38e798dbe9ddc5eb5b9f24ef9d450c8c8cc1683`. Its Auth BEFORE blob is `e0348f96373847dfb7a7038764da27bf896b50e9`, SHA256 `d8b42e21255414bd0f17ec1eae13921738c90e7ea35faaa7265fd907b52886ec`, exactly the accepted authority's parent bytes. Select Auth AFTER blob `59e3baee0c73978c6253f344923bc72d02f4cc05`, SHA256 `c5321c1ac01daf261516c793aee72e9672aa55bf71d1c8ee4855ee7e6afb1527`, without adaptation. This candidate has only Production ancestry. It imports no TenDev experimental application, Edge runtime, receival workflow, canary UI, permission change, migration or configuration.

| Selected path | Accepted SHA256 | Role |
|---|---|---|
| src/lib/auth.tsx | c5321c1ac01daf261516c793aee72e9672aa55bf71d1c8ee4855ee7e6afb1527 | sole application delta |
| scripts/verify-auth-resolution-deadlines.mjs | 0813dbaca210dfd14d8a6a53d1c24478e48397f4b4011e8725c3b898daca9ea6 | accepted focused verifier |
| scripts/verify-auth-startup-resolution.mjs | 10ff9fce77f9fcb12eea17a7816a5acbdae1f00cf6d10420b817615a154ee73d | accepted focused verifier |

The AuthProvider adds a 20-second application session-restoration deadline and a 15-second profile-verification deadline. Timeout fails closed, clears verified access, invalidates stale generation results and aborts pending profile work. Persisted SDK authentication, session refresh locking and healthy device bindings remain intact; genuine later Auth events must revalidate access. This is bounded application recovery from an unavailable dependency, not a claim that Supabase availability or a particular Safari session is repaired. No sign-out, storage clearing, custom lock or permission bypass is introduced.

The following four accepted small receipts are copied byte-for-byte with their original scope; the diagnostic folder name does not select receival application behavior:

| Evidence | SHA256 | Scope |
|---|---|---|
| [Source manifest](evidence/2026-10-30-tenbot-receival-readiness/hosted-preflight-diagnosis/source-manifest.json) | 68fe48aeeeac9af09ec3d462210973581c74503bcd7d92d96eb1aca281f01290 | Original accepted source pins |
| [Worker validation](evidence/2026-10-30-tenbot-receival-readiness/hosted-preflight-diagnosis/worker-validation.json) | c49bf4e221472afa8d4ff5ff19c853359c13f429cb457c5af967d03395124985 | 9 offline source/SDK groups; injected transport and application clock; focused types/lint |
| [Browser validation](evidence/2026-10-30-tenbot-receival-readiness/hosted-preflight-diagnosis/browser-result.json) | 967f34c0c5f313bb4d22b1bce5a59d5c375fb028fcda3a742393d9120b7cbafd | 20 local-browser groups with intercepted synthetic Auth/profile transport and real deadlines; no hosted writes |
| [Original build](evidence/2026-10-30-tenbot-receival-readiness/hosted-preflight-diagnosis/build-result.json) | 341b43e0b83689d6085cc42e14866ff68a6d71c7c7d341ca466ffa6fe8c3b25d | Original accepted local build, not this Production candidate's proof/build |

Existing relevant tests are reused without rerun during selection. The unchanged mandatory full-history, clean-current-candidate, exact committed artifact and zero-hold knowledge/source proof must run for this separate candidate, followed by a target-matching Production build and separately recorded release verification. This appendix neither overrides a hold nor substitutes an earlier build for those checks.

The Production baseline knowledge source/provenance/dependency bindings contain no `src/lib/auth.tsx` dependency. Its source-review registry, generated knowledge artifact, employee entries, structured patches, released authority, Product Manifest and Current State remain byte-identical. No Auth runtime tuple is added to an unsupported registry path, and no candidate acknowledgment, knowledge regeneration or record review is invented to bypass the normal gate.

Exactly one application file, two verifiers, four accepted receipts and this append-only Auth proof document are selected. Every other Production file remains unchanged. All unrelated shared workspace bytes, HEAD, index, refs and branches are preserved. No new migration, Edge deployment, hosted configuration, provider/funding change, role/grant/enrollment, operational write or inference is part of this Auth-only candidate. Actual availability/recovery and release outcomes must be recorded separately.
