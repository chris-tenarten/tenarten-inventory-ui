# Denton Facility task regroup — 2026-09-24

Denton Facility was a workaround Production Job Anthony Iorio used to group related My Work tasks before native Task Groups existed. Chris authorized moving its three completed tasks into a reusable native Task Group, clearing the temporary Job links, and reporting deletion readiness. The regrouping operation did not delete the Job.

Hosted project: `vxdxjhazkqhpkwdqtobp`. Job: `f236e7e0-b5f3-4a78-b561-f114d29969af`, `25-1015`, “Tenarten - Denton Facility”. Owner: `92edea19-e431-4493-9a1b-3c3ecf32aeae`.

Created Anthony's blue **Denton Facility** Task Group and assigned these existing completed tasks:

- `1b2bc2e8-9feb-4cec-96f8-684ea5325836`
- `041e29b0-b613-43ae-ab62-8d053cbf7892`
- `3038e2d9-40ca-4be2-a939-9096321da602`

Cleared `context_type` and `context_id` for those tasks. Group remains available for future assignments independently of the Job. No task content was printed or saved in this evidence.

Tier 3 / focused Testing Level 3 data-integrity verification: inspected live task triggers; executed one guarded transaction locking the expected Job, owner, and tasks; asserted exactly three completed personal tasks and no prior group memberships; compared all task fields before/after except the intentionally changed context fields and trigger-managed `updated_at`. All assertions passed. No schema or application changes.

Hosted readback at the time of regrouping confirmed the owner-scoped group listing exposed “Denton Facility” / blue and its membership listing exposed all three tasks. All three were completed with null Job context. At that time the Job was still present, had zero remaining task references, and its live deletion-blocker function returned `[]`; supplemental Sample and PO allocation counts were zero. No browser verification was performed; this was an existing-feature data correction.

Chris subsequently confirmed that he deleted the obsolete Denton workaround Job. This completion status is based on Chris's confirmation, not a new hosted verification. No further Denton Job-deletion action remains pending; the native Task Group provides the reusable grouping independently of the former Job.
