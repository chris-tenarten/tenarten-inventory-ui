# Permanent reviewed Pending authorization correction — November 2, 2026

**Implemented and verified locally; ready for Product release review. Shared migration, deployment and activation remain unapproved.**

Authority: Chris's **TENDEV — FINAL PENDING AUTHORIZATION CORRECTION**, attachment `a70ddd08`, accepts the initial readiness findings and authorizes this focused local SQL/Edge correction, isolated verification, selective candidate refresh and local commit. The separate Advisory conversation is unavailable. Tier 3 / focused Testing Level 3 for the changed authorization/canonical transaction boundary. No unrelated workstream, new paid inference or broad browser campaign was opened.

## Implementation and exact migration

Source commit **`047fff5a7abf2aa5522b8a056f83e4ed82a74857`**, on accepted readiness source `e9195ff`, changes exactly five paths:

- `supabase/functions/tenbot/index.ts`
- `supabase/migrations/20261102170000_tenbot_permanent_reviewed_pending.sql`
- `scripts/verify-tenbot-canonical-action-receivals.mts`
- `scripts/verify-tenbot-reviewed-actions-database.mts`
- `scripts/verify-tenbot-permanent-pending-database.mts`

The normal eligible Edge path stages the exact password-authorized Pending action without temporary pilot enrollment/window/permit. It still requires `TENBOT_RECEIVAL_EXECUTION_ENABLED`; all existing cohort, Auth, action permission, exact reference and SQL control checks remain. Finite acceptance retains its Edge pilot/permit branch.

The forward migration changes only the new-execution Pending branch of existing postgres-owned `execute_tenbot_reviewed_action(uuid,integer,text)`: after exact action authorization and private transaction-bound dispatch, call existing `tenbot_execute_invoice_receival_core`. Completed-receipt reconciliation remains on its existing path. The canonical executor stays non-bypass, retaining current capabilities/RLS, original/source/quantity/catalog/duplicate validation, execution disablement, transactional rollback, zero received quantity and zero-stock creation. The independent execution commit trigger rechecks exact authorized action/session/stage/dispatch.

All reviewed Pending SQL dispatches now use reviewed-action authority rather than SQL pilot permits; SQL has no normal-versus-acceptance lane discriminator. The unrelated legacy public pilot wrapper remains unchanged. Its finite authority cannot bypass an action-bound stage. No table, role, grant, RLS policy, helper, financial control or duplicate business service is added.

Migration **`20261102170000_tenbot_permanent_reviewed_pending.sql`**, SHA256:

`be839c362c8363fcc8e40134e53f739dbe66dc0195d684ade7e47d306c33576e`

It requires exact predecessor body MD5 `78e5c6b1bdfebfaaaef5f06846980516`, owner/ACL/configuration, existing non-bypass core/commit trigger and both Pending controls OFF. It changes no control row/version and checks function metadata preservation. New isolated body MD5 is `14b1cf22f3cda304115704b30b11ee06`. **Applied only temporarily to the existing isolated fixture, then restored. Not applied to shared Supabase.**

## Actual isolated verification

Existing fixed standalone fixture **`jltgxcfiprocydhbrahz`** was reused. No environment recreation, actor seeding, new framework or shared business operation was used. Eleven selected real PostgreSQL/Supabase Auth/private Storage groups passed:

- Genuine existing synthetic employee password reauthentication produced a distinct current execution session and completed reviewed Pending with **pilot OFF, enrollment zero and no permit**. One ordinary execution and one concurrent-first-execution case each committed exactly one Pending row, **2 Bag expected / 0 received**, one dispatch and one execution audit.
- Replay returned the committed receipt; concurrent first calls produced one record, not duplicates.
- Wrong owner/session, changed hash/revision, expired authorization, cancellation, supersession, actor revocation, missing business permission and actual Auth logout denied execution. Regrant/control cycling did not resurrect stale authorization.
- Default-OFF action controls, emergency version invalidation and canonical execution disablement remained enforced.
- Direct canonical core execution was denied by ACL; an adversarial privileged fixture call without private dispatch reached the commit guard and rolled back Pending, claims, execution and audit. A valid legacy pilot permit also failed to bypass an action-bound stage.
- Unrelated legacy pilot execution remained compatible under its separate finite policy/enrollment/permit authority, creating one synthetic Pending row with **2 Bag / 0 received**. Legacy controls were then closed.
- Same-ID catalog changes invalidated review. Injected partial business failure rolled back canonical effects while retaining the consumed failed proof.

Stock and Inventory transaction fingerprints, effective capabilities, profiles and Proposal access were preserved. Original target function/owner/ACL/configuration and all other function fingerprints were restored; fixture write controls OFF and enrollment zero. Three committed synthetic Pending receipts/originals remain as evidence.

An existing 20-unretained-upload fixture guard interrupted the first run after seven passing groups. Only thirteen task-owned unexecuted originals were retired through canonical owner cleanup, with original bytes/metadata preserved privately; three committed originals remain retained and **zero prior fixture sources** were touched. The four unfinished groups alone were resumed. This was fixture capacity, not an application authorization failure. [Combined real results](evidence/2026-11-02-tenbot-permanent-pending-correction/database-results.json).

Four new model-free checks execute the actual Edge branch over bounded doubles and verify the exact SQL replacement/default-OFF metadata contract. The prior 61 cohort/hosted/adapter checks and accepted real Terra, Proposal, quantity, history and Workspace/Messaging evidence were reused, not rerun. Final TypeScript, targeted lint and diff checks pass. New test RPC responses initially needed explicit shape guards for TypeScript; guards were added without application/SQL changes or repeated database campaigns. Independent source/evidence review finds no authorization defect. [Validation](evidence/2026-11-02-tenbot-permanent-pending-correction/validation.json).

## Refreshed Production release artifacts

Runtime candidate **`6233fb7d2bac9883fac4f22ec283e90993aca116`**, tree **`5f996554a9e7a88251996da746fa423891574d06`**, descends from accepted **`40037650`**, rooted exclusively on deployed Production **`e71bd981`**. Its four-file delta is the Edge entry, exact infrastructure review receipt/registry and derived snapshot. All frontend/public/branding/PWA/configuration and other selected runtime bytes remain exact accepted-candidate bytes. No dev merge or unrelated source promotion.

**Explicit paired boundary:** the runtime source tree and exact unapplied SQL companion are separate artifacts. The original Production proof only permits migration source to be classified as deployed when it is actually applied; no exception, verifier change or fictitious application evidence was introduced. The companion is pinned to source commit `047fff5` and the full hash above. The runtime proof does **not** approve SQL or establish Pending activation readiness. Approved application and independent shared readback of that companion remain mandatory before activation.

Original unchanged runtime release proof passes **zero holds**. Exact Production build passes: **278 artifacts, 55 resolved Edge modules, 32.55 seconds**. TenOps title/gold icons and both PWA manifests remain preserved, canary route absent/controls OFF, existing Production settings retained. Only the reviewed action adapter is enabled in the local build as already accepted; hosted settings were not changed. Exact source/closure/build, companion, preservation and recovery evidence are retained in this receipt's evidence directory.

Read-only shared observations at **22:27Z** confirm:

| Actual hosted boundary | Unchanged identity/state |
|---|---|
| Production Pages | `e71bd981a583e0a4e706f9953c6cc1fcc4d576e1`, deployment `eb191ab7-6e40-4275-b0a1-c616044b89a5` |
| TenDev Pages | `afb549d157453b767e726313bcea87dc4e43f2ed`, deployment `4f87390b-6f14-490d-b3d6-d859abfd3240` |
| Shared Edge | v67 ACTIVE, JWT ON; hash `7d48ef0647128fb5b78a6624da68df523870a01de1bb4a5b407517a854177230` |
| Required new shared migration | `20261102170000` absent; predecessor/owner/ACL/core/commit guard match the inspected contract |
| Agent controls | Normal employee mode absent/OFF; configured cohort empty; acceptance/review/action/pilot/execution and ordinary spend OFF; enrollment empty, grants/permits zero |
| Existing accounting | 173 usage rows, hash `ef0176dd59599ef82a318c2ea6fce57a`; November accounted $0.363782, held $0.142953 including $0.018723; policy v13 OFF, unchanged |

The six earlier November 2 migrations remain applied history; none was reapplied. The five accepted real employee identities/roles/capabilities are unchanged. This pass's successful Auth uses synthetic fixture accounts, not five new employee browser sessions. Current shared contracts remain compatible with existing Production; the new runtime stays fail-closed before the companion is applied because controls remain OFF and the old SQL still requires its pilot. No hosted release/readback of the new behavior is claimed.

## Funding, credential and next decision

The current Product recommendation is **$10 shared/month, $0.25/request, existing atomic accounting and no automatic top-up**. No funding was changed. The existing `tenbot_openai_monthly_allowance_ceiling` constraint permits at most **$5/month**; $10 requires a separately approved narrow forward financial-ceiling amendment plus funding configuration. That financial change is outside this Pending-only implementation. Do not edit the applied monthly migration or reset charges/holds. [Dependency record](evidence/2026-11-02-tenbot-permanent-pending-correction/funding-and-credential-dependencies.json).

The configured hosted credential cutoff remains **2026-11-28T22:46:56Z**, verified by existing digest without reading/rotating the key. Existing renewal is manual: the owner privately creates a replacement restricted project key, updates `TENBOT_OPENAI_API_KEY` and matching verified `TENBOT_OPENAI_KEY_EXPIRES_AT` through existing Supabase Edge Secrets with spending OFF, verifies the handoff under separately authorized conditions and retires the old key. No automatic renewal exists; changing a date does not extend the old key. The separate local evaluation credential is not a substitute. This is future operational maintenance, not a current Pending implementation defect.

**Recommend Product accept the corrected authorization and authorize the exact migration/runtime release boundary separately.** No remaining Pending implementation defect was found. Actual activation requires explicit shared application/readback of the exact companion, matching Pages/Edge release/configuration, the unchanged five-account membership and independent execution/funding approval. A $10 financial activation must additionally resolve the existing $5 constraint. No optional implementation or new conversational campaign is proposed.

No push, shared migration/data mutation, deployment, employee rollout, funding activation or paid inference occurred. No browser or macOS screen capture was used; no application session, process or previous build output was interrupted. Eight preexisting dirty files are preserved; only an owned execution-standard handoff is appended and staged independently of its prior dirty content. Root/private candidate source, failed capacity checkpoint, scoped cleanup and recovery evidence are retained. Stop for Product review.
