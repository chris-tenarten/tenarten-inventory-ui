# TenBot permanent reviewed Pending activation — proposed November 2, 2026

**Proposed authorization change; no migration created or applied.** This is the sole database-contract blocker identified during Chris's initial five-employee Production readiness pass. It is not activation or deployment approval. The accepted TenDev business outcome and quantity contract remain accepted; this plan changes how an already reviewed action becomes eligible for execution.

## Verified current contract

Read-only shared verification at 22:15Z found `execute_invoice_receival_draft(uuid,text,uuid)` owned by the non-bypass `tenbot_invoice_executor`, with the existing caller capability, finite TenDev pilot policy, employee enrollment and one-use permit gates. `invoice_receival_execution_permits.origin` permits only `https://tendev.pages.dev`. Its service-only mint RPC likewise requires the pilot. Changing environment flags cannot provide persistent Production Pending creation.

The accepted `execute_tenbot_reviewed_action(uuid,integer,text)` is postgres-owned. It already locks and checks the exact owner/action/revision/hash, current requesting employee and distinct password-authenticated execution session, live action policy and permission epoch. Its Pending branch uses a private canonical stage and inserts a private transaction-bound dispatch before invoking the public canonical wrapper. The independent `tenbot_action_guard_receival_execution()` trigger checks that dispatch and action again at canonical commit.

Fresh captured bodies show no pilot/enrollment dependency inside `tenbot_execute_invoice_receival_core(uuid,text,uuid)` itself. That existing SECURITY DEFINER function retains the non-bypass executor, caller authorization, canonical draft/approval/hash/expiry/permission-version, source/quantity/catalog/duplicate validation, execution-control gate, transactional records, zero received quantity and zero-stock creation. Existing canary-specific source/commit triggers target the old developer account, which is excluded from the verified cohort.

## Smallest proposed change for Product approval

1. One append-only forward migration replaces only the Pending branch's canonical call in `execute_tenbot_reviewed_action`: invoke existing `tenbot_execute_invoice_receival_core` after the existing exact authorized stage and private transaction dispatch. Preserve the completed-receipt reconciliation path, final reauthorization, savepoint/rollback, authorization consumption, immutable receipt and independent canonical commit guard.
2. One corresponding Edge `beforeExecute` branch permits a normal, verified cohort member's reviewed Pending action to stage under existing action controls without requesting the legacy pilot permit. Keep the finite acceptance branch and non-reviewed legacy paths unchanged.
3. Keep `tenbot_action_control.receivals_enabled` and existing canonical execution control OFF during migration application. Retain their version invalidation and separate explicit activation decision. No migration application itself enables execution.

**The material policy decision:** every reviewed Pending action dispatched through this SQL action function would rely on exact password-authorized reviewed-action authority, rather than SQL pilot enrollment/permits. SQL does not currently persist a normal-versus-acceptance lane discriminator. Keeping an additional SQL permit requirement solely for acceptance-created reviewed actions would require more metadata and a larger change. Edge can retain its finite acceptance restriction; do not describe that as a preserved SQL permit requirement for reviewed actions.

No new table, helper, grant, role, RLS policy, cohort database or permit-origin broadening is required by this minimum plan. The public non-reviewed `execute_invoice_receival_draft` wrapper and its finite TenDev pilot/permit behavior remain unchanged. Source/history access and canonical business authorization stay independent of Terra eligibility and funding.

## Focused implementation/application gate

If Product approves this scope, author the exact forward SQL and local Edge change, and use the existing isolated fixture for only the changed authorization boundary: default-OFF denial, legitimate exact own-password reviewed dispatch with the pilot disabled, cross-account/session/hash/revision/stage denial, legacy public bypass denial, current permission/control revocation, rollback and replay/concurrent duplicate prevention with unchanged stock. Reuse accepted source/quantity/Proposal/Messaging evidence. No repeated paid Terra acceptance is required for this contract correction.

Before a separately approved shared application, compare the exact predecessor function bodies/owners/ACLs and disabled controls against the captured receipt; preserve all accounting, history, sources, roles and business records. Independently read back the sole changed function and protected boundaries. A new exact candidate/proof/build must include the reviewed correction before requesting the full initial Production rollout.

Independent review agrees this direct action-to-core path is smaller than adding private-table privileges to the non-bypass public wrapper or expanding legacy permit schema/origin rules. [Focused review evidence](evidence/2026-11-02-tenbot-initial-rollout-readiness/independent-review.json). [Owning readiness receipt](2026-11-02-tenbot-initial-rollout-readiness.md).
