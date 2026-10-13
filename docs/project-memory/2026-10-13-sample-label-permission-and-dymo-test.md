# Product checkpoint — label permission proposal and physical print test

Chris accepted the local label candidate for continued review, not release. This increment prepares the missing permission extension and a portable hardware-test packet. It does not implement or apply the authorization change. The original label source, built app and all 15 prior validation artifacts are preserved; hashes are recorded in [the preservation manifest](evidence/2026-10-13-label-review-preservation.json). The original [implementation review](2026-10-13-sample-color-plate-label-review.md) remains unchanged.

## Confirmed permission gap

The dedicated configurable **Generate Color Plate Labels** permission was **not implemented**. `SampleWorkspace.tsx` gates its action with `readOperationalData`; `ColorPlateLabelEditor.tsx` combines that capability with `accessAllowed`. There is no label-specific capability, account flag, Admin checkbox, administrative RPC field or Edge payload field. The current local hardware-test candidate therefore uses the already accepted operational-read gate. It must not be described as the completed permission candidate.

Inspected implementation authority: `src/lib/rbac.ts`, `src/lib/auth.tsx`, `src/components/AdminSettingsPanel.tsx`, `supabase/functions/admin-manage-users/index.ts`, `supabase/functions/_shared/production-blend-handler.ts`, and append-only migration `20261005170000_production_blend_capability.sql`. No hosted permission state or Anthony account was inspected or modified.

Production Blend currently uses capability `production_blend.manage`, per-account boolean `app_users.production_blend_manage` default false, profile normalization, Admin invite/user-edit checkboxes, and `admin_set_app_access_v2`. Admin access is inherent; other active roles require an explicit grant. Its explicit grant is checked before the generic read-only restriction. The Edge route authenticates the caller and requires an active Admin for user administration; omitted Blend fields route to the legacy setter so older clients do not revoke the newer grant. Blend generation also checks the capability server-side and retains its own RLS/persistence guards.

## Smallest proposed equivalent contract — pending Product approval

| Item | Proposed value/behavior |
| --- | --- |
| Operator/Admin-facing permission name | **Generate Color Plate Labels** |
| Capability | `sample_labels.generate` |
| Stored per-account flag | `app_users.sample_labels_generate boolean not null default false` |
| Auth profile/client payload | `sampleLabelsGenerate`, normalized only from strict boolean true |
| Admin | Included inherently, matching Production Blend |
| Guest/Member/Lead/Developer | Denied by default; explicit individual grant required |
| Inactive/anonymous | Denied regardless of stored flag |
| Read-only Guest with explicit label grant | May use this local presentation/print/export workflow; gains no formulation, business-data, Messaging or Blend write authority |
| Sample visibility | Existing operational-read/Sample authorization still required; label permission never grants access to a Sample |
| Existing users / Anthony | No automatic assignment or bulk grant. Any actual account assignment requires Chris's approval |

The proposed defaults and read-only exception intentionally mirror Production Blend; they are proposals, not new approved policy. No role bundle or Sample RLS policy changes are needed. This is Tier 3 authorization work once implementation is approved; the current increment is preparation only.

Concrete database draft: [proposed SQL](proposals/2026-10-13-sample-label-permission.sql). It is deliberately **outside** `supabase/migrations`, has not been applied anywhere, and is not ready for application without current signature/dependency/ACL verification. It adds one column, one capability branch, appends the field to current-user/Admin-list projections, and adds an atomic active-Admin-only v3 setter. Existing v1/v2 setters remain intact and preserve the new flag. V3 locks the target and can preserve the existing Blend grant when that field is omitted. There are no user grants, role grants, document tables, Sample data mutations or print services in the draft.

Implementation map after contract approval:

1. `src/lib/rbac.ts`: add the capability and exact display name. Add an optional false-defaulted account grant argument; recognize Admin/explicit label access before the generic read-only restriction. Leave existing capability outcomes unchanged.
2. `src/lib/auth.tsx`: append and strictly normalize `sampleLabelsGenerate`; pass it to account capability evaluation. Missing backend fields fail closed for non-Admin clients; authoritative capability checks below also fail closed until backend support exists.
3. `src/components/AdminSettingsPanel.tsx`: add independent invite and user-edit checkboxes labeled **Generate Color Plate Labels**, including the existing disabled/included-for-Admin convention. Keep the Blend checkbox independent. If the service projection lacks the new field, do not claim the permission can be saved; show an administrative service-version error.
4. `supabase/functions/admin-manage-users/index.ts`: validate the optional `sampleLabelsGenerate` field as a boolean. On update, use v3 only when the label field is supplied; otherwise retain existing v1/v2 routing and preserve the label grant. An omitted Blend field on a label-only update retains the locked current Blend flag. On invitation, persist the new field with false as its default. Preserve existing bearer authentication, active-Admin checks and error handling. Missing migration/RPC support must produce an error rather than silently omit the requested grant. No Edge deployment is authorized now.
5. `SampleWorkspace.tsx` and `ColorPlateLabelEditor.tsx`: require both existing Sample read/access authorization and `sample_labels.generate` for opening/reviewing the label, preparing output, Print and Download PDF. Recheck the authoritative existing `has_app_capability` RPC on opening and before Print/Download so a stale profile cannot authorize output after revocation. Preserve the synchronous popup opening needed by Chrome; leave it blank and close it on denial/check failure. Fail closed on RPC errors, close/clear transient label state on account change or denial, and never fall back to operational-read access. No new label-generation Edge Function is needed for this transient client-rendered increment.

Scope limit: this controls the supported TenOps label workflow. Because authorized Sample readers already possess the source text and this candidate renders locally, it is not a guarantee that a user cannot independently recreate or print that information. Do not represent the UI capability as a server-side data boundary equivalent to Blend's persisted generation endpoint. Stronger server-exclusive issuance/generation would be a separate contract; do not restrict Sample reading or add that architecture implicitly.

Required focused checks after implementation approval: role × grant × active/read-only matrix; independently grant/revoke each label/Blend flag; non-Admin setter denial; older-client preservation; invite defaults; malformed payload rejection; authoritative revocation and RPC-error denial at output; direct component/output-handler gating; unchanged Sample visibility, formulation and other capabilities. Apply no migration even in a test database under the present instruction. No calculation/PDF/layout rerun is warranted unless that code changes. Client authorization changes would justify targeted TypeScript/lint/build/browser checks then; none were repeated in this preparation pass.

## Portable physical-test candidate

Packet folder: `/private/tmp/tenops-dymo-print-test-packet/`. Portable archive: `/private/tmp/tenops-dymo-print-test-packet.zip` (17,346,941 bytes). Archive SHA-256: `6e037265161c5a20ca247d458005e1d96536d62206ff1c49fc1da512dc4c9dc1`; see [packet receipt](evidence/2026-10-13-label-print-packet.json).

The packet contains the **exact existing 248-file exported build**, one copied historical review fixture, a Node-only read-only launcher, the original 15 validation files, source/build/evidence hashes, and [the operator worksheet](2026-10-13-dymo-physical-print-test.md). It contains no hosted credentials, `.env` files, database, migrations or printer SDK. The fixture hides unrelated document-history links; no original Sample or evidence file was edited. The fixed test account is a synthetic read-only Guest, not Anthony's real account. The dedicated permission proposal is not activated in this preserved build.

New launcher source: `scripts/serve-color-plate-label-print-test.mjs`. It binds only to localhost, serves the preserved app and fixture, denies Sample writes, backend function actions and access changes, and sends no printer commands. It is a test data source, **not a local print bridge**. Anthony's setup needs a Node runtime (this launcher is checked here with Node 24.18.0); it needs no npm install, Docker, database reset, migration, application build or hosted access. The normal Chrome-to-OS-driver print path needs the DYMO printer software/driver, not a TenOps SDK service.

The packet has been prepared locally, not transferred, installed or run on Anthony's machine. This machine's `localhost` cannot serve his workstation's `localhost`. Transfer/unpack the packet on his machine and launch it there using the worksheet; no hosted deployment or public/LAN exposure has been performed. If port 3000 is occupied there, do not stop an unidentified process or silently choose another port: the preserved build's API endpoint is exactly `http://localhost:3000`.

Checks performed in this increment: preservation hashes; JavaScript syntax and targeted ESLint for the new launcher; HTTP-only smoke checks on internal port 4319 for static/fixture reads, fixed read-only Guest profile and denial of Sample/backend/access writes. Results: [new launcher HTTP evidence](evidence/2026-10-13-label-print-packet-http.json). These checks do not establish a new browser, DYMO, driver or physical-print result. The temporary internal-port HTTP test launcher was stopped. The existing localhost:3000 full review app remains running unchanged.

## Next Product boundary

Approve or revise the proposed permission contract before implementing that new authorization/schema contract. Separately record Anthony's physical print and settings-retention results. If the Chrome/DYMO path cannot retain correct settings, return the supported DYMO Connect Framework/local service dependency for Product approval before adoption. No new migration application, hosted grant, Edge deployment, push, deployment or Production release is authorized.
