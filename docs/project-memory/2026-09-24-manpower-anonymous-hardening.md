# Manpower and connected Rework anonymous hardening — local review

Status: implemented and validated locally; **not applied hosted, committed, pushed or deployed**. Production therefore still has the audited anonymous exposure. Authorized scope is Chris's 2026-09-24 correction against `e6153d782370f11b868b57eff0d9d57982635936`. This is focused Level 3 security work, not an authenticated RBAC redesign.

## Exact migration boundary

1. `20260924210000_manpower_anonymous_access.sql`
   SHA-256: `b0cb4dfa57d4e4f6ab3bc7634a11b12e1174a444470d4c65bfaf282f5505d77c`
   Revoke all anonymous privileges on `manpower_entries`, `manpower_workers`, `manpower_tasks`, `manpower_reporting_groups`; remove exactly 13 anonymous-only policies; revoke anonymous EXECUTE on `delete_empty_manpower_reporting_group(uuid)`.
2. `20260924210100_production_rework_anonymous_access.sql`
   SHA-256: `5518835d7e477aa414b8d8377f5e0f80c40836abfe0256eccea900316cbcc3c8`
   Revoke anonymous SELECT on `production_rework_cycles`; remove only `anon` from its existing shared SELECT policy; revoke anonymous EXECUTE on `create_production_rework`, `update_production_rework_status`, `save_production_rework_schedule_batch`, and `save_production_rework_mixed_schedule_batch`, with their exact installed signatures.

No function replacement, authenticated/service-role grant changes, schema shape changes, business DML, capability changes, global/default privilege changes, client changes, or unrelated RLS changes. The superseded enforcement migration remains excluded.

Each transaction locks its target tables and checks a portable exact catalog fingerprint before changing authorization: table owners, RLS/force-RLS, table ACLs, column definitions/defaults/ACLs, complete policy definitions/roles/commands, constraints, indexes, triggers/enabled state, exact RPC signatures/bodies/owners/security mode/search_path/ACLs, and role attributes/inheritance. Relevant helper function definitions are guarded too. Postconditions verify effective anonymous denial, including inherited/PUBLIC privileges. Five-second lock timeout avoids an indefinite operational stall.

## Evidence and effective behavior

Fresh schema-only Production dump and read-only catalog/digest capture are under ignored `output/manpower-anonymous-hardening/`. Neither new migration version was present. The exact captured definitions replayed into PostgreSQL 17.6 without normalization or substituted business functions. Auth-schema JWT extraction is a local Supabase-compatible fixture; auth identities are fictional. No Production business rows were copied into the disposable database.

`validation.json` records every before/after outcome, SQLSTATE, row count, API response, digest and drift case. PostgreSQL and PostgREST containers are removed after verification. No browser or broad application suite was run.

### Anonymous matrix

Before values below for writes/RPCs are **disposable replay results**, not hosted mutation tests. Hosted anonymous reads were previously confirmed independently.

| Operation | Before | After |
| --- | --- | --- |
| Read four core Manpower tables | Allowed | Denied `42501` / HTTP 401 |
| Insert Workers/Tasks/groups | Allowed | Denied |
| Update Workers/Tasks/groups | Allowed | Denied |
| Insert labor with active category, no account | Existing category trigger denies | Denied at table boundary |
| Edit/delete existing labor | Allowed | Denied |
| Direct delete Workers/Tasks/groups | No permitted rows under existing RLS | Denied at table boundary |
| Delete empty group RPC | Allowed | Denied |
| Delete occupied group RPC | Business-rule exception | Denied before function executes |
| Read Rework | Allowed | Denied |
| Four Rework creation/status/schedule RPCs | Allowed for valid fictional input | Denied |
| Product Categories / Jobs direct reads | Already denied | Still denied |

Actual anonymous HTTP POST/PATCH/DELETE against all four tables and POST to all five RPCs return 401. SQL effective privilege assertions also cover TRUNCATE, REFERENCES, TRIGGER and column grants. No public views/materialized views exist in this capture. A conservative transitive scan of installed public function bodies finds only these five anonymously callable non-trigger endpoints reaching the scoped relations; none remains anonymously callable after migration. This is not a claim about unrelated platform endpoints or future/dynamic SQL.

### Authenticated equivalence

34 representative operations per identity were compared, including SQLSTATE and affected-row cardinality, not just successful login. All **170 five-role operation pairs** match. Existing broader permissions are deliberately preserved.

| Role | Labor CRUD/reference/group behavior | Empty-group RPC | Category management | Rework RPCs | Before/after |
| --- | --- | --- | --- | --- | --- |
| Guest | Existing behavior retained | Allowed | Denied/zero rows | Allowed | Identical |
| Member | Existing behavior retained | Allowed | Denied/zero rows | Allowed | Identical |
| Lead | Existing behavior retained | Allowed | Allowed | Allowed | Identical |
| Developer | Existing behavior retained | Allowed | Denied/zero rows | Allowed | Identical |
| Admin | Existing behavior retained | Allowed | Allowed | Allowed | Identical |

Reference deletion remains governed by existing RLS/FKs; occupied-group deletion remains refused; invalid category assignment remains rejected. No role gains new authority. Rework direct UPDATE remains denied for authenticated roles while its existing RPCs retain their behavior.

Service role has another **34 identical before/after pairs**, including existing constraint/trigger failures. In particular, service role without an account JWT still cannot create a categorized labor entry through the existing active-account category trigger; this migration does not reinterpret that contract. Service reads, valid edits/deletion and Rework RPC behavior are unchanged.

PostgREST confirms all five roles and service role retain complete paginated joined reads: **1,003 distinct entries, 1,504.5 hours**, fetched in 500-row pages with a 1,000-row API maximum. Category/Worker/Task/Job/group/Rework relationships remain present. Snapshot period joins and Production Job totals retain identical outcomes. Exact catalog comparison verifies that the only changed definitions are the approved anonymous ACL/policy removals.

## Integrity

Fresh hosted baseline (no row contents in report):

| Relation | Rows | SHA-256 of canonical sorted complete rows |
| --- | ---: | --- |
| manpower_entries | 1,868 | `942f36cc8f131e088f1965a3e80abf2be0b4492120d309bfefb7d155f1289ac9` |
| manpower_workers | 21 | `c4e7f1be425d90d9d2cd91a34e518c5221c0eaf067083654f62f57473abe7206` |
| manpower_tasks | 25 | `42ffd9a0e0f4a92eecdfc02bcbb1b199e577cc6c862ed55b6baf402ac6f4bdfa` |
| manpower_reporting_groups | 38 | `06e45ed89018a9669e7b2f4c3fb66c6209b4c594edb9ca7297cfaf1d6adbc0ab` |
| manpower_product_categories | 9 | `f0dea23a8d4f18480c38d5cc0d747c124f8f84b12187c8bce57e687a2ec63a3f` |
| production_rework_cycles | 1 | `a30beca2f636d1aeaf0907afd050a9c28ad0c8bf05031e7a6fcd4e05213f849b` |
| jobs | 39 | `4a895bfd133b6766bfd32d84d5ffc17c0e26192b050aae4594687c1a3fcea45f` |
| app_users | 12 | `0ebad53e88039f5e9ce3bec2d005fc15d8ef9c5833ce4a5a545b4614d26661a4` |
| app_role_capabilities | 75 | `f9483d4977d32ca6565f0430f56d13fb8eca7f00412c1531117afe47cff20726` |

Current captured labor: **8,134 hours** (4,944 AM + 3,190 PM). These are current totals, not the older 1,674-entry release baseline.

Disposable full-row digests are identical before/after both migrations for labor, references, groups, categories, Rework, Rework schedule batches, Jobs, Job activity, users and capabilities. Probe operations roll back their entire subtransaction, including side effects. Denied HTTP mutations leave the same digests. The migrations contain no business DML/backfill. Hosted before/after migration equality is intentionally **not claimed** because neither migration has been applied.

## Guards, release and recovery

18 tested adversarial drift cases cover ownership, RLS, force-RLS, authenticated grants, column grants, policy predicates, trigger state, constraints, function SECURITY DEFINER, search_path, PUBLIC grants, function body replacement, overload/signature changes, and role BYPASSRLS. Both valid migrations were also executed inside transactions then rolled back to prove original authorization restoration. A separate stage-2 failure test proves committed migration 1 remains hardened and migration 2 remains unchanged on its guard failure.

No operator write pause is technically required: authenticated semantics and existing clients remain compatible throughout. Brief automatic DDL locks serialize table operations; lock timeout aborts safely. Before authorized release, refresh guards/ledger and baseline. Legitimate concurrent business activity may change whole-table digests; do not describe such a difference as migration mutation without reconciling intervening writes. For an exact migration-only hosted comparison, capture before/after digests inside the migration transaction while the target locks are held; unrelated tables require transaction-consistent reads and appropriate attribution of concurrent writes, not an invented global pause.

Release order, only after separate authorization:

1. Verify immutable source boundary, exact hashes, current hosted guards and unused ledger versions; capture fresh baseline.
2. Apply migration 1 atomically with its ledger entry; check effective anonymous denial and unchanged authenticated/service authorization.
3. Apply migration 2 atomically with its ledger entry; verify the same for Rework. No hosted test workflows/business fixtures are required; reuse disposable write evidence.
4. Perform focused hosted read-only anonymous denial, authenticated/service grant/policy/function and integrity checks. Confirm no unexpected client authentication dependency.
5. Only under release authorization, commit/push/promote the reviewed migration/tooling/docs boundary using the normal workflow. No client source change is required for compatibility; if normal pushes deploy, verify success and exact served SHA only.

Recovery:

- **Migration 1 fails:** its transaction rolls back; stop. Diagnose drift/lock failure and re-gate. Never bypass guards. Existing exposure remains until corrected.
- **Migration 2 fails after migration 1 succeeds:** keep migration 1 hardened. Stop and correct/re-gate migration 2; do not restore core anonymous access. Rework remains exposed until its correction succeeds.
- **Both succeed but verification finds an authenticated regression:** stop further release steps, preserve security, reproduce against captured definitions and restore only the required authenticated/service behavior in a reviewed forward migration. Do not edit applied migrations or regrant anonymous access.
- **Client/tooling deployment fails:** existing client remains compatible; keep the security migrations installed, fix/retry the deployment. A client rollback is safe if required; an authorization rollback to anonymous exposure is not the recovery plan.

No implementation blocker remains. Hosted application/release authorization remains outstanding.

## Repeatable local verifier

The following first generates read-only SQL locally; collecting hosted schema/capture requires read-only access. These are operator instructions, not an unattended migration runner.

```sh
mkdir -p output/manpower-anonymous-hardening
node scripts/verify-manpower-anonymous-hardening.mjs --print-capture-sql > output/manpower-anonymous-hardening/capture.sql
npx --yes supabase@2.110.0 db dump --linked --schema public --file output/manpower-anonymous-hardening/public-schema.sql
npx --yes supabase@2.110.0 db query --linked --file output/manpower-anonymous-hardening/capture.sql --output json > output/manpower-anonymous-hardening/capture.json
node scripts/verify-manpower-anonymous-hardening.mjs --baseline-dir=output/manpower-anonymous-hardening
```

The verifier requires pre-migration definitions and an empty ledger result for these versions. It runs migrations **only inside disposable Docker**, then removes both containers. It does not use hosted credentials or connect to hosted PostgREST. Generated capture/report files remain ignored; schema and hashes contain no business record contents. The repository fixture rows are explicitly fictional.
