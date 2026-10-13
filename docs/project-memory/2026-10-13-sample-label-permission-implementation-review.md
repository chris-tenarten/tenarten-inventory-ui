# Product review — local Sample label permission implementation

Local implementation is complete for review. No Production release, hosted change, push, commit or deployment was performed. The authorization wrapper `color-plate-label-access.ts` is preserved. Work remains uncommitted on `feature/sample-color-plate-label-generator`, based at Git HEAD `1866efe4f862621513c0a45def9cc249286805f2`. This is a base SHA, **not a commit containing the candidate**. The [candidate content manifest](evidence/2026-10-13-label-permission-candidate.json) records exact changed paths and their SHA-256 hashes.

## Implemented contract

- `sample_labels.generate` / **Generate Color Plate Labels** uses `app_users.sample_labels_generate boolean not null default false`. Active Admin has inherent access. Every other role requires an explicit individual grant. Inactive and anonymous accounts are denied. No actual Anthony or hosted account was changed.
- Independent invite/account checkbox follows the Production Blend pattern. A missing backend flag disables the checkbox and shows service-version guidance. Client grants normalize strict boolean true; older backends fail closed at the authorization RPC.
- Migration `20261013180000_sample_label_capability.sql` appends the flag to `get_my_app_access` and `admin_list_app_access`; authenticated ACLs are restored after recreation. It adds active-Admin-only `admin_set_app_access_v3`. The explicit label choice cannot be null. V3 locks the user, preserves omitted Blend grants and delegates existing validation/last-Admin safeguards to v2. Existing v1/v2 signatures and setters remain intact and preserve the new grant.
- `authorize_sample_color_plate_label(uuid default null)` is side-effect-free and SECURITY INVOKER. It requires **both** operational-read and dedicated label access. A saved Sample must also be visible through the caller's SELECT grants and canonical RLS. Null supports transient unsaved previews and still requires both capabilities. Public/anonymous execution is revoked; authenticated only.
- Sample RLS intentionally continues controlling Sample visibility, not label entitlement. No Sample policy is changed to require the label grant. The additional RPC enforces label entitlement while preserving that visibility boundary.
- Editor opening, preview generation and each Print/Download attempt consult the current database grant. Revocation denies stale-session output; Print closes its blank popup before content/print on denial. Sample reopen refreshes the existing access profile, with no sign-out requirement. Account ownership checks prevent carrying an editor across account changes.
- No label-generation Edge endpoint, persisted document or print service was added. The existing Admin handler executes v3 when the new field is supplied; legacy payloads retain v1/v2 behavior. The supported UI and its authorizer are gated; client-rendered labels are not a DRM boundary against a Sample reader independently recreating information already visible to them.

## Focused validation — Tier 3 / Testing Level 3

[API/database evidence](evidence/2026-10-13-label-permission-api.json): **32 passed** using real local Auth sessions. Includes active Admin inherent access; ordinary Member/Lead/Developer and anonymous/inactive denial; explicit read-only Guest access without business/Blend authority; grant/revoke with the exact same Member token; non-Admin Edge/v3/raw-table escalation denial; malformed/null grant rejection; legacy v1/v2 compatibility; independent Blend/label grants; unchanged Sample readability and policies/grants.

A temporary **restrictive** Sample SELECT policy in the new database hid the fixture from the granted Member. Both direct SELECT and the SECURITY INVOKER authorizer denied access. It was removed in `finally`; canonical policies were never removed or weakened. Baseline and final Sample policy/ACL snapshots match exactly. Existing container identities are preserved.

[Browser evidence](evidence/2026-10-13-label-permission-browser.json): **8 passed** with separate actual Admin and Member browser contexts, real UI sign-in and the actual local Admin handler. OFF→ON via Admin checkbox + Member refresh/reopen exposes the action. ON→OFF hides it and denies generation, download and print from a stale open editor. Same user/access token throughout; no re-login, page errors, downloads or print calls during denied-output tests. Sample Work Order action remains available. Screenshots: ignored `output/label-permission/granted.png` and `revoked.png`.

Changed application paths passed targeted ESLint, TypeScript through the isolated Production webpack build, and `git diff --check`. The build used the new loopback API/key and a separate build directory. No original build was replaced. The completed PDF/layout/calculation/native-print suites were **not rerun**. Original renderer/field source hashes, all 15 existing label evidence files, all 248 packet build files and the packet archive were checked for preservation only; results are recorded in the candidate manifest.

## Isolation and deviations

Exact resources, environment variables, ordered migrations, recovery and ancillary fixture shapes are recorded in the [isolation plan](2026-10-13-label-permission-isolation-plan.md) and [migration manifest](../../scripts/support/label-permission-migrations.json). Only the new `tenops-label-permission-review` project/database/volume was written. Real GoTrue/Auth, PostgREST, repository identity/user/permission contracts, Sample contracts and RLS were used unchanged. No authorization-critical schema or policy was stubbed or replaced.

The test bootstrap supplies empty dependency tables for Jobs/Bids, Job updates/activity/rework, Messaging/notifications, Storage and Realtime. They do not establish full validation of those unrelated modules. No Job row or pseudo Job number was created. Canonical migrations supply all Sample/user/permission policies. The vendor `supabase_admin` role is used for new-database bootstrap/Auth migrations because `postgres` lacks auth-schema ownership; application requests assume the actual JWT role. Initial Auth startup and a dependency migration failed, then setup resumed without resetting the database or replaying successful migrations.

The actual Admin Edge source is transformed and executed locally with real clients; no Edge runtime is deployed. Gateway proxies real Auth/REST and injects no session/role mocks. SMTP/Realtime/Storage API/Studio are not started. Local secrets are new, ignored, mode 0600. Internal app port **4318** preserves the current manual-review app at **3000**; the old app/portable packet remain the earlier accepted label build and do not represent this permission candidate. New test resources remain running for review; none of the existing resources were stopped/reset/replaced.

## Exact permission increment paths

Application/security: `src/lib/rbac.ts`, `src/lib/auth.tsx`, `src/components/AdminSettingsPanel.tsx`, `src/modules/samples/SampleWorkspace.tsx`, `src/modules/samples/ColorPlateLabelEditor.tsx`, `src/modules/samples/color-plate-label-access.ts`, `supabase/functions/admin-manage-users/index.ts`, `supabase/migrations/20261013180000_sample_label_capability.sql`.

Validation infrastructure: `scripts/prepare-sample-label-permission-validation.mjs`, `scripts/build-sample-label-permission-validation.mjs`, `scripts/start-sample-label-permission-validation.mjs`, `scripts/verify-sample-label-permission.mjs`, `scripts/verify-sample-label-permission-browser.mjs`, `scripts/support/label-permission-migrations.json`.

New review/evidence: this document, `docs/project-memory/2026-10-13-label-permission-isolation-plan.md`, `docs/project-memory/evidence/2026-10-13-label-permission-api.json`, `docs/project-memory/evidence/2026-10-13-label-permission-browser.json`, and `docs/project-memory/evidence/2026-10-13-label-permission-candidate.json`.

The manifest also lists all preserved earlier label implementation/package/worksheet/proposal/evidence paths, distinguishing the total uncommitted candidate from this permission increment. The older proposal/checkpoint documents remain historical evidence, not current implementation status.

## Product boundary / remaining release blockers

1. Product review of this uncommitted candidate, including the migration and compatibility contract. A committed candidate SHA requires commit authorization; no new commit is claimed.
2. Separate approval/current-state checks before any hosted migration, Admin Edge update, frontend deployment or real account grant. None is authorized or performed. No broader Anthony permissions are required.
3. Anthony's actual DYMO 550 / 30256 physical test and Chrome settings-retention test remain pending. PDF generation and browser flow have prior evidence; DYMO driver compatibility and physical printing do not. Use the preserved [operator worksheet](2026-10-13-dymo-physical-print-test.md): Open Sample → PRINT COLOR PLATE LABEL → Review → Print → select DYMO destination → Chrome Print, without downloading/importing a PDF. First setup may require destination, 30256 stock, wide orientation, 100% scale, no margins and headers/footers off. Whether any persist is unverified. The old portable packet remains suitable only for hardware/layout testing, not permission demonstration.
4. If correct stock/settings do not persist, return to Product before adopting the researched DYMO Connect SDK/local service. No print bridge or background printing integration was introduced.

Stop for Product review. Production permission demonstration is not yet enabled.
