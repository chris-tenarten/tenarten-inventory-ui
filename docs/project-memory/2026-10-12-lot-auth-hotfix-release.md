# LoT authentication hotfix — released 2026-10-12

Chris explicitly approved a LoT-only Production release after the read-only investigation. Tier 3 / focused Testing Level 3 authentication and capture-boundary validation. Hotfix complete. Subsequent explicitly authorized signed-in Production Preview smoke passed using Chris's manually authenticated session; Production issuance remains untested and was not authorized for that smoke.

## Exact boundary and deployed identity

- Source commit: `c8602494897f05e813c117ccd47a678083cdd98f` (existing commit, no new commit or push).
- Project: `vxdxjhazkqhpkwdqtobp`.
- Component: `generate-job-transmittal-pdf`, ACTIVE **v13**, previously v12.
- Deployed bundle SHA-256: `40ea701e98e43a935292e92db20cbfcba12ae019c928cbdd78f1b3a133e9c39c`.
- `verify_jwt: true`, unchanged.

The isolated candidate was copied from freshly downloaded Production source. Its only source delta is `_shared/rbac.ts`: `global: { headers: { authorization } }` becomes `global: { headers: { Authorization: authorization } }`, plus two explanatory comments. All candidate function files match their contents at c860249. Deployment explicitly named only the LoT function and used server-side bundling. Downloaded v13 source is byte-identical to the validated candidate. No permissions, render code, branding, snapshot/capture behavior or other function source changed.

## Root cause and focused gates

The old lowercase global header and SDK `auth.getUser(token)` uppercase header were combined into a comma-separated bearer value. Using the exact SDK version 2.101.1, the pre-release source rejects a disposable valid user before capability evaluation; the correction preserves one header and permits the same user.

- `verify-transmittal-auth-boundary.mjs` against freshly downloaded v12: PASS defect reproduction and corrected valid/invalid/expired/missing/capability tests.
- `verify-edge-capability-auth.mjs`: PASS.
- `verify-transmittal-edge-hotfix.mjs` against isolated candidate and downloaded v13: PASS actual handler, real SDK/PDF renderer, mocked upstream HTTP. Draft Preview returns PDF; saved Preview checks generated state; Generate renders/uploads/completes; missing/invalid/expired/insufficient-capability callers are denied before service access. Storage failure/retry retains one fixture capture; retry after success reuses the PDF with one successful upload. Existing `previewOperationalDocuments` and `issueTransmittal` checks remain unchanged.
- `verify-job-transmittal-linkage-semantics.mjs`: PASS.
- Targeted ESLint and `git diff --check`: PASS. No frontend build/redeployment needed or performed.

These are focused authentication and handler gates, not a fresh database issuance/concurrency replay or browser issuance test. The schema, issuance RPC, frontend issuance/retry control and claim contract are unchanged. Prior PDF overflow gate passed; prior legacy `verify-job-transmittals.mjs` failed on its stale raw `<input>` source assertion and was not weakened or treated as a pass.

## Hosted post-release evidence

[Sanitized before/after evidence](evidence/2026-10-12-lot-auth-hotfix.json) records function inventories and aggregate capture metadata hashes, without credentials, signed URLs, row contents or upstream error bodies.

Production missing/invalid-token probes returned **401** independently for `draft-preview`, `preview` and `generate`, before and after deployment. Read-only metadata checks before and after probes and release found **3 captures**, unchanged, with SHA-256 `17fc6b61ef1bd86090948dd4d1d574955248539428f4e0a7a34a1df283aed3be`. Selected fields include IDs, numbers, snapshot/document hashes, document status, storage location and issuance timestamp; snapshot/PDF bytes were not re-downloaded. No capture creation, claim or upload was performed against Production. One sandboxed metadata-check attempt failed; its approved rerun completed successfully.

At release time, no valid existing hosted user session was available. Local valid-user success and exact deployed-source equality passed. The subsequently authorized Preview smoke is recorded below; Production Generate remains untested. All **7 other Edge Functions** have identical before/after inventory entries. Frontend, TenOps branding, permissions, migrations and Material Readiness were untouched. No hosted business-data writes, migrations, frontend builds, Git commits or pushes were performed.

## Authorized authenticated Production Preview smoke — PASS

Chris explicitly authorized manual browser sign-in and Preview only, with no document capture creation. Browser automation tab integration was unavailable, but native Chrome UI control was supported. A separate Incognito window was opened at the Production login screen; Chris entered and submitted credentials manually. No password, token, cookie or session credential was requested, extracted or inspected.

Using the visibly signed-in Chris Ngo / Admin account at `https://tenops.pages.dev/transmittals`, selected Job `26-0826` (Logan Airport A-B Connector) and opened Job-linked LoT. Initial History was **0** and provisional number **0826-003**. Clicked **Preview PDF** only, without editing form fields. The browser visibly displayed a one-page Letter of Transmittal PDF with **DRAFT PREVIEW** watermark, Tenarten Terrazzo logo and branding, and the selected Job context. No authentication error appeared.

Closed the PDF viewer, checked history, then closed and reopened the LoT form to trigger a fresh history/number load. History remained **0**, displaying “No Letters of Transmittal have been generated for this Job.” Provisional number remained **0826-003**. No Generate/Retry, download, issue confirmation or unrelated record edit was performed. This is direct authenticated Production browser evidence for draft Preview, not issuance or permanent Storage delivery. The Incognito window remains signed in at the empty LoT History view for Chris's control.

## Anthony's manual smoke

1. In the existing signed-in Production session, try **Preview PDF**; confirm a draft PDF opens without reserving a number or adding history.
2. Inspect history first. If a capture already exists, use **Retry** on that record. Otherwise use **Generate & Download** once when ready to issue the intended document.
3. Confirm the permanent PDF downloads and exactly one intended history entry exists. If any failure remains, preserve the draft/capture and report the action, timestamp and exact message; do not issue a replacement number repeatedly.

No additional release work is authorized or needed for this hotfix.
