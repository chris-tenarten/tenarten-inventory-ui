# Sample generation technical diagnostics (local candidate)

Extends decimal-generation fix `265c98e4da30fd291c5515e6566be3ef04019cb4`; not released. No additional migration or hosted mutation.

## Contract

Expandable, copyable Technical Details for existing active Admin and Developer roles. No new role/capability or generation permission. Normal users retain concise errors. Backend technical metadata is omitted for other/inactive roles and role-lookup failure. Existing HTTP status/error-string contracts remain; renderer/Storage failures use safe public messages instead of exception/provider text.

Allowlisted fields: stable code, failure stage, validation field, expected contract, actual (unavailable when not exposed), source, correlation ID, explanation, and safe numeric observations. Observations distinguish selected profile/current draft/saved capture ratios, thickness and captured volume. Generation sends a document/source reference, not a separate ratio. Backend-resolved ratio is unavailable unless exposed; no value is inferred from a profile label. Backend-generated correlation IDs associate sanitized response metadata with existing console logs; client/RPC-only failures mark correlation unavailable. No raw payload/error/stack, credentials, tokens, paths or arbitrary message strings enter Technical Details or its clipboard value.

Anthony's case: valid selected/captured 5:1; `.75` persisted; SQL parser returned NULL volume and chip projections; issuance rejected preparation quantities before Edge rendering. Diagnostic code `SAMPLE_PREPARATION_INCOMPLETE`, stage `issue-snapshot`, field `preparation quantities`. This is distinct from `SAMPLE_RATIO_INVALID`. The decimal parser correction remains in the preceding local commit.

## Implementation boundary

Shared diagnostic builder/redactor and failure-only role check; shared UI disclosure; Sample failure integration; preservation of sanitized metadata through Edge error decoding; Production Blend error integration; failure stages in existing Sample and Blend handlers. No change to capture, PDF content, Storage object identity, success response, retry or issue paths. Old raw client diagnostic logging replaced with allowlisted logging. Role checks for metadata run only on failure.

## Focused evidence

- Deterministic diagnostics: preparation vs ratio, missing/unavailable values, numeric-only observations, hostile payload redaction, active Admin/Developer allowed, other/inactive roles denied, request/authorization/render/storage/delivery categories and correlation IDs.
- Actual Sample Edge callback with local HTTP and renderer-failure substitutes: render/upload/delivery errors classified, complete response omits injected secrets, member metadata omitted, existing document references retained. No hosted calls.
- Actual localhost browser: Admin and Developer expand/copy safe issuance diagnostics; member gets concise error without disclosure. Issuance failure injected at RPC boundary; does not create documents.
- Successful generation/retry integrity reuses the preceding focused decimal/PDF lifecycle evidence; follow-up local UI generation confirms success still works.
- TypeScript, targeted app/test lint and optimized build. Edge sources use the repository's existing lint exclusion; imported/exercised by focused callback/handler tests.

Review uses localhost:3013; standard branding permits normal-role testing without altering TenDev access rules. Material Readiness/port 3000 and earlier review worktrees are preserved.
