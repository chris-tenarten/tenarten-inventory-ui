# Isolated local permission validation — resource boundary

Chris instructed preserving the current Git state and authorization wrapper, continuing isolated local Supabase validation, and leaving existing environments untouched. The earlier CLI start request was rejected before execution; no stack or configuration was created by that request. This plan uses explicit Docker Compose resources instead of CLI-generated resource names.

## Exact resources

| Resource | New name / binding |
| --- | --- |
| Docker Compose project | `tenops-label-permission-review` |
| PostgreSQL container | `tenops-label-permission-db` |
| GoTrue Auth container | `tenops-label-permission-auth` |
| PostgREST container | `tenops-label-permission-rest` |
| Docker network | `tenops_label_permission_review_network` |
| Named database volume | `tenops_label_permission_review_db` |
| PostgreSQL database | `postgres`, inside the new container/volume only |
| PostgreSQL host port | `127.0.0.1:55582` → container 5432 |
| Auth host port | `127.0.0.1:55583` → container 9999 |
| REST host port | `127.0.0.1:55584` → container 3000 |
| Internal-validation app/gateway | loopback `http://localhost:4318` |
| Local configuration/secrets | `.tmp-label-permission-validation/`, new ignored directory in the feature worktree; secret files mode 0600 |
| Separate build copy | `/private/tmp/tenops-sample-label-permission-build`; no environment file copied |

Reuse only installed image bytes, pinned to the read-only inspected image IDs: PostgreSQL `public.ecr.aws/supabase/postgres:17.6.1.143` (`sha256:9f64a845786d2e5f6cf41610e0cacc1d287d33267806b0db89294ece1a4248e4`), GoTrue `public.ecr.aws/supabase/gotrue:v2.193.0` (`sha256:57eefe69e701e2d6639ad640bebe3e4128bb71cd0bbfd7e04551e9756ea6c193`), PostgREST `public.ecr.aws/supabase/postgrest:v14.15` (`sha256:fcb9fa67dd53b3b978b52ef07fb195d4bb26434c2e8cba8c96ef257abf2ee753`). No image pull is required. No Storage API, Edge Runtime, Realtime, SMTP, Studio, analytics or pooler service is started.

Preflight reads existing container/network/volume names and port ownership. If any planned name/port/path is occupied, stop; do not reuse, reset, delete or replace it. No `prune`, `down -v`, `db reset`, existing-container stop, existing-database SQL, existing-volume mount or hosted connection is part of this plan. Existing Supabase containers, volumes, local databases and hosted environments will not be stopped, reset, overwritten or modified. The current `localhost:3000` label review app remains untouched. Port 4318 is internal validation only; any later manual-review promotion to port 3000 needs a separate controlled handoff.

## Environment variables

All secret values are generated for this new local stack; no existing Supabase keys/passwords or `.env.local` are reused.

- PostgreSQL: `POSTGRES_PASSWORD`, `POSTGRES_DB=postgres`.
- GoTrue: `API_EXTERNAL_URL=http://localhost:4318`, `GOTRUE_API_HOST=0.0.0.0`, `GOTRUE_API_PORT=9999`, `GOTRUE_SITE_URL=http://localhost:4318`, `GOTRUE_URI_ALLOW_LIST=http://localhost:4318/**`, `GOTRUE_DB_DRIVER=postgres`, `GOTRUE_DB_DATABASE_URL` using the new database’s `supabase_admin` role and generated password, pointing only to the new PostgreSQL container, `GOTRUE_JWT_SECRET`, `GOTRUE_JWT_EXP=3600`, `GOTRUE_JWT_AUD=authenticated`, `GOTRUE_JWT_ADMIN_ROLES=service_role`, `GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated`, `GOTRUE_DISABLE_SIGNUP=true`, `GOTRUE_EXTERNAL_EMAIL_ENABLED=true`, `GOTRUE_MAILER_AUTOCONFIRM=true`, `GOTRUE_LOG_LEVEL=warn`.
- PostgREST: `PGRST_DB_URI` pointing only to the new PostgreSQL container, `PGRST_DB_SCHEMAS=public`, `PGRST_DB_ANON_ROLE=anon`, `PGRST_JWT_SECRET` (same new local JWT secret), `PGRST_SERVER_PORT=3000`.
- Local gateway: `SUPABASE_URL=http://localhost:4318`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (new local-only signed JWTs), `TENOPS_ALLOWED_ORIGINS=http://localhost:4318`.
- Isolated app build: `NEXT_PUBLIC_SUPABASE_URL=http://localhost:4318`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (new local anon JWT), `NEXT_PUBLIC_RBAC_MODE=enforced`, `NEXT_PUBLIC_DEV_BRANDING=false`.

## Database contents and migrations

The exact ordered file list is [label-permission-migrations.json](../../scripts/support/label-permission-migrations.json). It reconstructs the repository's relevant identity, Sample, read-only and Production Blend contracts in the **new empty database**, ending with `20261013180000_sample_label_capability.sql`. No applied migration is edited, and `20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql` is excluded.

The fixture bootstrap supplies empty Jobs/Bids reference tables required by Sample foreign keys, empty ancillary Messaging/notification/Storage table shapes needed by the existing read-only migration, and schema-role usage grants. It creates no Production Job or pseudo Job number and copies no hosted or existing local user/message/data records. Sample tables, functions, grants and policies come from the listed canonical migrations; no allow-all Sample policy is introduced. Auth users are newly created confirmed local fixtures through the new GoTrue service; no invitation email is sent. Sample data is copied only from the existing synthetic label fixture into new test rows.

Tests use separate real local Admin and Member sessions, plus local denied/restricted fixtures. Apply/revoke through the actual Admin Edge handler executed locally (not deployed), authenticated RPCs and PostgREST. Compare unrelated capabilities and Sample policies/grants across the new migration and label grant/revoke. Check raw RPC/REST denial, stale-session preview/output denial, and Member refresh/reopen transitions without signing out. PDF/printing evidence is reused; only the changed access/output guards receive focused checks.

## Why the earlier environments cannot be reused unchanged

The existing `tenops-permission-review` stack has real Auth, but `public.samples` is only `id uuid, value text`, with an allow-all `fixture_access` policy. It cannot demonstrate the canonical Sample generator's visibility boundary. The existing `tenops-color-plate-label-review-98302` database has the full Sample model, but its application adapter uses a simulated session and simplified identity bootstrap. Combining or upgrading either would modify an existing local database. A fresh, explicitly named stack provides both real sessions and canonical Sample/RBAC contracts while preserving those environments.

## Actual setup deviations and recovery

The vendor database image makes `postgres` non-superuser and owns `auth` with `supabase_admin`. Initial GoTrue startup using `postgres` failed and applied no application migrations. The new database’s `supabase_admin` password was set to the generated local password and GoTrue was resumed with that role. Migration execution also uses `supabase_admin`; requests through PostgREST still assume the actual JWT role and canonical RLS. This elevated bootstrap/service connection is isolated test infrastructure, not an application authorization substitute.

Empty `job_updates`, `job_activity`, and `production_rework_cycles` tables satisfy identity migration dependencies; empty `realtime.messages` (RLS enabled, no permissive policy) satisfies the read-only migration dependency. The canonical restrictive Realtime policy is applied unchanged. Messaging, Realtime and ancillary business behavior are not claimed as validated. No Sample, user, permission, Auth function or RLS contract is replaced. Failed transactional migrations roll back; successful migrations are recorded and skipped on resume.
