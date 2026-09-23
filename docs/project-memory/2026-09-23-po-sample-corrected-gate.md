# PO + Sample corrective gate — local replay passed

Date: September 23, 2026. Testing Level 3: persistence, receiving, authorization compatibility and fail-closed migration guards. No hosted writes/migrations, pushes, deployments or visible browser. Scope is the four failed-gate blockers; Sample application semantics are unchanged.

## Root causes and corrections

1. **Partial receipt state:** Production Pending Receivals permits pending/received/cancelled/cleared, not partially_received. The new receipt function now keeps `pending` until received quantity equals expected quantity. Progress is authoritative quantities plus the batch ledger. Inventory displays Received/Remaining from quantities, not a new lifecycle enum. No PO or Pending Receival status constraint/vocabulary is changed. Undo restores prior quantity/status; cancellation leaves received stock intact.
2. **Service compatibility:** existing projection/receive/undo bypass app-user capability checks only when `auth.role() = service_role`. Corrected entrypoints preserve that behavior. Ordinary projection still requires adjustInventory, receive requires receiveInventory, undo requires adjustInventory. The new ledger permits a null app-user FK only with explicit service-role attribution; it never invents a user. App-role entries still require the authenticated user. No role-capability data or existing public RPC privilege is broadened.
3. **Fail-closed guards:** migrations check the full captured definitions and attributes of both public/private projection functions, public receive/undo and private receive/undo implementations; owner, effective grants, security, language/definition, search_path and other attributes participate in the fingerprint. The replaced source index's full definition/flags/owner and the unchanged status constraint are checked too. MD5 is used as a deterministic equality fingerprint of catalog JSON, not authentication; only CRLF/LF transport normalization is permitted. Missing or changed objects abort inside the migration transaction before any feature DDL. Public wrapper language/attributes/ACLs are compared before/after in the replay and remain identical.
4. **Versions:** the three unapplied files now use distinct 14-digit timestamp prefixes, strictly ordered and checked against both repository filenames and the captured ledger. Parked Intake version 20260922 is distinct. No applied migration was renamed or edited. The two old failing PO SQL hashes are superseded. Sample SQL bytes are intentionally unchanged, so its content hash remains the same under its corrected unique filename.

## Corrected exact migrations

| Order | Filename | Version | SHA-256 |
| --- | --- | --- | --- |
| 1 | 20260923160000_sample_operational_profiles.sql | 20260923160000 | 0fce994d5086b37c36cda085c5623767c8688b71862336e1f4cf9840d6120d0e |
| 2 | 20260923160100_po_reservation_allocations.sql | 20260923160100 | c1b9b459d828c4693fc2a15142a6b9b5738cad9eb755994f4cdd992c9edcb5dd |
| 3 | 20260923160200_partial_pending_receipts.sql | 20260923160200 | ece9c0f4980340c45be5445cafdbb447b4e0a68ecb5bceeb52fbfba6f9a09944 |

The files replace these never-applied local identities: `20260922_002_sample_operational_profiles.sql`, `20260922_003_po_reservation_allocations.sql`, `20260922_004_partial_pending_receipts.sql`. Do not use the superseded filenames or the original PO hashes. Apply only a future explicitly approved exact list; do not bulk-push unrelated migrations.

## Focused replay evidence

Command:

```sh
node scripts/verify-po-reservation-allocations.mjs --capture-dir=/private/tmp/tenops-po-sample-production-gate-20260923
```

The verifier now requires the captured Production public schema, ledger and configuration; its former generic minimal schema was removed. Public schema SHA-256 is pinned to `e91deb23931cf7cfafc64c73ec77a03805b9afa137a94b1c597a0a8920b68746`. The full captured tables/functions/grants/triggers/constraints are restored in PostgreSQL 17.6. Minimal auth/JWT claim primitives are isolated locally; captured role capability configuration supplies actual operational permissions. No hosted business rows are copied.

Passed on the final corrected migration hashes:

- Unique migration versions and deterministic order; expected captured schema accepts all three migrations.
- Synthetic original-column digests unchanged across migration for role capabilities, historical PO/lines/issuance/document, existing Pending Receival/Inventory/transaction, Samples/blend rows/versions/issued snapshots, historical profiles/defaults. Only the additive source_allocation_key is excluded from original-column comparison.
- All **26 existing Sample function definitions** remain unchanged, including historical dispatch.
- PO zero/one/multiple allocation, explicit general-stock remainder, save/reopen, quantity cap and failed-save rollback, issuance intent capture, idempotent projection, mixed material/provenance and unchanged pricing checks.
- Allocated 8/24 remains pending; retry adds nothing; over-receipt fails; subsequent receipt completes; latest undo restores prior partial pending state; receive-all finishes the remainder.
- General-stock 8/24 → 12/24 → 24/24, retry/over-receipt guards, undo to 12/24 pending, short-receipt cancellation retaining stock.
- Existing service-role receive before migration, legacy undo after migration; new service projection, partial/full receipt, retry and undo with no app-user ID; explicit service ledger attribution.
- Ordinary Admin/Lead/Member permissions retained; Member cannot project/undo; Guest/inactive user denial; anon RPC EXECUTE denied; existing public wrapper metadata and ACLs exactly equal before/after.
- Changed stock blocks unsafe undo without altering the receipt. Reversed or changed-payload request IDs cannot silently replay. Concurrent identical receipts create one Inventory transaction.
- Ten drift cases (three public function bodies, private function attributes/search_path, grants, index predicate and status constraint) abort before replacement; new feature objects are absent after each failed transaction.
- Managed Sample Add/Rename/Reorder/Deactivate/Reactivate, revision checks, member/inactive denial, save/reopen/version/restore/issuance and captured-value preservation. Historical corrected V4/V3 assertions reuse captured functions; no Sample calculations were redesigned.
- TypeScript, targeted ESLint, whitespace checks and optimized Production build on the PO/Sample-only branch.
- One focused headless UI test: partial progress remains visible while status is pending; uncertain-result retry retains its request ID. No visible browser. Prior unaffected Sample/Catalog/PDF evidence is reused.

Runtime result: `/tmp/tenops-po-sample-corrected-replay/result.json`; synthetic digests: `/tmp/tenops-po-sample-corrected-replay/synthetic-before-after.txt`. Capture inputs remain at the read-only gate directory above. Disposable database containers are removed after runs. These are local replay results, not hosted acceptance or actual PDF/Storage generation.

## Product behavior preserved

Allocation quantities use the PO order unit and canonical Job-reserved stock model. There is no parallel reservation-demand model. Internal allocation snapshots do not change supplier PDF output. No historical assignment/reclassification/backfill occurs.

Sample profiles are unchanged: MTT is fully configured at 128 lb/CFT density, 2560 oz/CFT dry pool, 512 oz/CFT Filler, 480 fl oz/CFT Resin, 5:1; Sherwin uses the same density/dry/Filler and 512 fl oz/CFT Resin, 4:1. Key Resin and Terroxy have only 5:1, with all material rates unknown. Cement has unknown ratio and rates. Incomplete selection displays missing inputs and an authorized Configure path while leaving the valid Draft calculation untouched. Completion still requires explicit Apply. Manual override and corrected V4 dependency semantics remain unchanged.

## Frozen Git boundary and Intake

One ordinary branch, `feature/po-sample-generators`, starts directly from Production `5f3d6489343aa115f8d517c9def011ba27d15b67`. It carries only the PO/Sample implementation, focused verification and review evidence. The local freeze commit is reported in the final response/Git log; no special release infrastructure or worktree was created.

Normal dev remains the unchanged Intake checkpoint `181ab83cf6478d2cda98779295c64fe8560378d0`. Intake UI, its migration and TEST/demo files are absent from this branch; dev retains the entire recoverable implementation. Production/main and recorded origin refs stay at `5f3d6489343aa115f8d517c9def011ba27d15b67`. Nothing is pushed.

## Exact correction delta from the failed gate

Renamed unapplied migrations (the two PO files also corrected as described above):

- `supabase/migrations/20260922_002_sample_operational_profiles.sql` → `supabase/migrations/20260923160000_sample_operational_profiles.sql` (byte-identical).
- `supabase/migrations/20260922_003_po_reservation_allocations.sql` → `supabase/migrations/20260923160100_po_reservation_allocations.sql`.
- `supabase/migrations/20260922_004_partial_pending_receipts.sql` → `supabase/migrations/20260923160200_partial_pending_receipts.sql`.

Modified existing boundary paths:

- `src/app/inventory/page.tsx`: quantity-based partial progress label only.
- `tests/e2e/generator-allocations-profiles.spec.ts`: realistic pending status in the partial-receipt fixture.
- `scripts/verify-po-reservation-allocations.mjs`: captured-schema verifier replaces minimal schema bootstrap; drift/security/lifecycle/integrity assertions.
- `scripts/verify-sample-mass-balance-migration.mjs`: new Sample migration filename reference only in this corrective delta.
- `docs/project-memory/2026-09-22-po-allocations-sample-profiles.md`: migration names and superseding state reference.
- `docs/project-memory/2026-09-23-po-sample-production-gate.md`: mark historical failed gate superseded; preserve its original findings/hashes/baseline.

Added:

- `scripts/fixtures/po-reservation-lifecycle.sql`.
- `scripts/fixtures/po-receipt-compatibility.sql`.
- `docs/project-memory/2026-09-23-po-sample-corrected-gate.md` (this report).

All other prior PO/Sample implementation files remain byte-identical to the failed-gate boundary. No Intake or unrelated implementation file is changed.

## Remaining gate and authorization

No known implementation blocker remains from the four confirmed failures. This is not Production application authorization. The captured schema is a point-in-time baseline, so the next gate must read the current shared Production schema/ledger/definitions again, verify these guards and exact hashes, recapture protected counts/digests, and finish the coordinated cutover/recovery plan. Client-only rollback is not claimed safe for every workflow: old clients lack allocation management, and migrated receipt/issuance state persists. Preserve that state and prefer forward correction; any fallback should pause affected PO/Inventory/Sample writers until the compatible function/client pair is verified.

Chris's next action: authorize the **read-only final Production release gate for the exact local freeze SHA and three corrected hashes**, still excluding Intake. That gate should return the final write-pause, ordered migration/client release, bounded acceptance/cleanup and recovery sequence for separate execution approval. Do not apply/push/deploy from this corrective pass.
