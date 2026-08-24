# TenOps RBAC rollout

RBAC is split deliberately into compatibility infrastructure and final enforcement.

## Compatibility phase

The currently applied database compatibility state consists of `20260818_001_rbac_identity_infrastructure.sql` and `20260818_003_rbac_compatibility_authenticated_access.sql`. It adds application users, fixed role bundles, identity columns, trusted capability helpers, notification discovery, Admin helpers, and authenticated access equivalent to the legacy anonymous database contract. It does not revoke anonymous database access. The application shell independently requires an authenticated, active TenOps account and no longer exposes the legacy client-side Internal Access gate.

Deploy `admin-manage-users` only after the infrastructure migration. It is an additive Admin-only Edge Function; its service credential remains server-side and its caller must pass the trusted `manageUsers` check.

Bootstrap the first Admin through `bootstrap_first_tenops_admin` while authenticated as the intended Chris Auth user. Then use Settings → Admin to prepare Anthony and Gio as Leads and Marcos and Pat as Members. These are intended assignments only; the migration does not create users or send invitations.

Run `report_job_update_identity_backfill()` and review every unmatched or ambiguous row before any separately authorized backfill. Display-name matching is never silently guessed.

## Cutover prerequisites

- At least one active Admin exists and can sign in, reset a password, and reach Settings → Admin.
- Guest, Member, Lead, Developer, disabled-user, and Admin test accounts have passed the authorization matrix.
- Every browser mutation, server route, Storage policy, RPC, and Edge Function has a trusted capability boundary.
- Rework direct-RPC tests prove Guest/Member/Developer/disabled users cannot mutate it; Lead/Admin can.
- Production smoke tests pass with `NEXT_PUBLIC_RBAC_MODE=enforced` in an isolated environment.
- A rollback window and owner are named, and
  `supabase/rollback/20260818_002_rbac_final_enforcement_rollback.sql` has been
  reviewed against the exact `_002` candidate being applied.

## Final enforcement

`20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql` is intentionally isolated. It installs the centralized PostgREST pre-request capability boundary, replaces authenticated compatibility RLS and job-attachment Storage policies with capability policies, removes effective anonymous public-schema authority, and wraps the four Rework RPCs while preserving their existing concurrency-safe implementations and return signatures. It must not be applied until the owner explicitly says: **Apply RBAC enforcement now.**

Before applying it, deploy the RBAC-aware document Edge Function source with `RBAC_ENFORCED` absent/false, then smoke-test compatibility mode. At the coordinated cutover, apply the exact `_002` file, set server/Edge `RBAC_ENFORCED=true`, and set the frontend to `NEXT_PUBLIC_RBAC_MODE=enforced`. The Edge flag must never be enabled before the database capability infrastructure and final boundary are live.

The Purchase Order and Letter of Transmittal document buckets remain service-role-only implementation stores; browser callers receive signed results through the capability-gated Edge Functions. The browser-accessible `job-attachments` bucket is governed directly by the final Storage policies.

## Enforced-mode adversarial matrix

Run `node scripts/verify-rbac-enforcement.mjs --list` to review the matrix. The harness reads the canonical role bundles from `src/lib/rbac.ts`; it does not embed credentials or a second permission model.

Supply short-lived, manually obtained access tokens only through the following uncommitted environment variables:

```text
TENOPS_RBAC_TOKEN_GUEST
TENOPS_RBAC_TOKEN_MEMBER
TENOPS_RBAC_TOKEN_LEAD
TENOPS_RBAC_TOKEN_DEVELOPER
TENOPS_RBAC_TOKEN_ADMIN
TENOPS_RBAC_TOKEN_INACTIVE
```

With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` also present, `--run-readonly` executes direct PostgREST, RPC, Storage-read, document Edge, and Admin Edge probes. Invalid identifiers or deliberately incomplete payloads are used so an allowed call reaches validation/not-found while a denied call stops at authorization. This proves the boundary without creating Jobs, Rework, updates, users, or immutable documents.

The matrix covers:

| Boundary | Capability distinction |
| --- | --- |
| Operational SELECT and attachment read | `readOperationalData` |
| Job INSERT, routine PATCH, DELETE | create, routine edit, archive |
| Controlled Job PATCH | routine vs elevated vs scheduling vs archive fields |
| Planning and Job Update mutations | modify, post, edit + assign, resolve |
| Production schedule and Rework RPCs | scheduling and Rework authority |
| Inventory and vendor mutations | adjustment and vendor/catalog authority |
| Unknown legacy `SECURITY DEFINER` RPC | denied to every non-service caller |
| PO and Transmittal preview/issuance | preview vs issuance capabilities |
| Admin list/update RPC and Admin Edge | `manageUsers` only |
| Storage read/upload/delete | read, upload, and delete capabilities |

Every boundary is exercised as unauthenticated, Guest, Member, Lead, Developer, Admin, and inactive authenticated callers. Inactive is expected to fail regardless of its nominal database role. Anonymous calls are expected to lose protected PostgREST, RPC, Storage, and Edge access.

`--run-controlled` is intentionally separate. It requires both `TENOPS_RBAC_ACK_CONTROLLED_MUTATIONS=YES` and `TENOPS_RBAC_CONTROLLED_JOB_ID` for an approved development Job. It temporarily probes routine, elevated, scheduling, and archive fields, restores each field with the Admin session, uploads random temporary Storage objects, verifies deletion authority, and removes them. Run it only after the read-only matrix passes and verify the controlled Job and `rbac-enforcement/` Storage prefix are unchanged afterward.

Successful PO or Transmittal issuance is not required for the authorization matrix: their capability checks run before payload validation or record lookup, so malformed/invalid issuance requests prove allow/deny without creating immutable records. A canonical issuance fixture is warranted only if document business behavior changes independently; it is not required merely to enable RBAC.

## Coordinated cutover order

There is no atomic switch spanning Postgres, Edge secrets, and the frontend. Use a named maintenance window and temporarily prevent operator traffic:

1. Confirm a current backup/PITR point, one active Admin, all six role-state test sessions, compatibility smoke results, and a reviewed recovery owner.
2. Keep `RBAC_ENFORCED` false and the frontend in compatibility mode. Apply exactly `20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql` only after explicit authorization. Database enforcement must exist before Edge enforcement.
3. Immediately set the Edge/server `RBAC_ENFORCED=true`, then deploy the frontend/server configuration with `NEXT_PUBLIC_RBAC_MODE=enforced`. Never reverse steps 2 and 3.
4. Sign out and reauthenticate every matrix browser/session so identity and active-state observations are current; obtain new short-lived tokens.
5. Run `--run-readonly`. Stop on the first mismatch. Only after it passes, run the explicitly acknowledged `--run-controlled` probes and the focused browser smoke test.
6. Reopen operator traffic only after all expected allow/deny results and cleanup checks pass.

The unavoidable short interval after step 2 has database enforcement active while Edge remains in compatibility mode. Maintenance isolation and an immediate Edge flag change minimize that fail-open Edge interval; enabling Edge first is unsafe because it creates the opposite dependency failure.

## First-failure recovery

If the first enforced request fails, stop the matrix before controlled mutations,
capture the failing caller, boundary, HTTP status, and correlation timestamp, and
keep operator traffic closed. The Free-plan project has no assumed backup/PITR
recovery point, so use this exact sequence:

1. Keep operator traffic closed. Set Edge/server `RBAC_ENFORCED=false` and restore
   the frontend to compatibility mode before reopening any client. Do not attempt
   live policy repairs.
2. Execute exactly
   `supabase/rollback/20260818_002_rbac_final_enforcement_rollback.sql` through the
   reviewed exact-file SQL method. Do not rerun `_003` as a substitute. The script
   refuses to run unless the complete `_002` boundary is present, then restores
   the `_001` + `_003` policies, grants, RLS modes, Storage policies, Rework RPC
   implementations, bootstrap grant, and anonymous schema usage in one transaction.
3. The rollback sends both `reload config` and `reload schema` notifications to
   PostgREST. After the transaction commits, allow the reload to complete; if the
   platform dashboard still reports stale schema/config state, explicitly reload
   PostgREST there before testing. Do not reopen traffic yet.
4. Sign out and reauthenticate a known active Admin. Confirm `get_my_app_user`
   still returns the expected active Admin identity.
5. Verify anonymous compatibility operational reads directly against the legacy
   database contract and confirm representative Production data is visible. The
   application shell remains account-authenticated and is not an anonymous test path.
6. Verify authenticated compatibility reads and one already-established,
   non-destructive operational path. Confirm Production data remains visible to the
   authenticated Admin.
7. Confirm anonymous database compatibility remains available and the compatibility
   runtime does not require final RBAC enforcement.
8. Keep `_002`, Edge `RBAC_ENFORCED`, and frontend enforced mode disabled until the
   original failure is diagnosed and a new controlled cutover is explicitly
   authorized. Reopen operator traffic only after these compatibility checks pass.

The rollback preserves `_001` identity infrastructure, `app_users`, role bundles,
business data, generated documents, and Storage objects. It changes authorization
objects only. Any future edit to `_002` requires a fresh direct comparison and
review of the rollback before cutover.
