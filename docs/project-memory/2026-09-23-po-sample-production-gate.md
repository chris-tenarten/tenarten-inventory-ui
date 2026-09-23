# PO + Sample Production gate — BLOCKED (historical)

Superseded by the [corrective replay report](2026-09-23-po-sample-corrected-gate.md). This report records the failed original hashes; do not apply the old PO migration files.

Date: September 23, 2026. Level 3 targeted hosted compatibility/disposable replay; no hosted migration or business-data mutation, push, release, or visible browser. The three supplied SQL files and original 27 implementation paths remain unchanged.

## Outcome and exact blockers

1. **Partial receipts fail against Production's actual constraint.** Captured `pending_receivals_status_check` permits only `pending`, `received`, `cancelled`, `cleared`. Migration 004 writes `partially_received` without changing that constraint. In disposable replay, a 24-unit Job portion receiving 8 units raised a check-constraint violation. The statement rolled back; this is a real installed-schema incompatibility, not a test-fixture mismatch.
2. **Existing service-role semantics are removed.** Captured projection, receive and undo public wrappers explicitly bypass app-user capability checks for `auth.role() = service_role`. New wrappers require an authenticated app-user capability unconditionally; the receipt ledger also requires a non-null app-user actor. A service-role EXECUTE grant alone does not preserve this behavior. Preserve existing trusted-service semantics or obtain an explicit policy decision before release. Ordinary role capability sets remain equivalent for projection today: both issuePurchaseOrder and adjustInventory belong to Admin/Lead. Receipt belongs to Admin/Lead/Member.
3. **Installed-definition guards are insufficient.** Migration 003 checks only that replacing an `ON CONFLICT` predicate substring changes the projection implementation; it does not compare the full expected function, ACL or index definition. The replacement/renamed public wrappers and migration 004 have no full-definition/attribute guards. They cannot be described as failing closed on arbitrary newer Production behavior. Guard exact expected objects before modifications and rerun drift-rejection tests.
4. **Migration version ambiguity.** All three filenames parse with the same leading CLI version `20260922`, also used by the parked Intake filename. No installed `20260922` ledger row currently exists, but these are not safe as three distinct automatic CLI migration versions. Establish distinct migration IDs/file naming in the reviewed correction, or an explicit separately reviewed ledger application method; never run an indiscriminate db push.

No release authorization is requested for the current failing boundary.

## Git separation plan (not executed)

Keep normal `dev` at Intake checkpoint `181ab83cf6478d2cda98779295c64fe8560378d0`. None of the 27 PO/Sample paths overlaps the 13 Intake checkpoint paths. After correcting and reviewing the gate failures, create one ordinary feature branch from Production `5f3d6489343aa115f8d517c9def011ba27d15b67`, carrying only the PO/Sample changes; commit those paths there. No reset, rewrite, stash, worktree or archive ref is required. Intake remains recoverable on unchanged dev; the feature branch's parent and diff exclude Intake UI, migration and fixtures. This is the simple branch plan explained before any Git operation. No clean release SHA is claimed because the current boundary failed the gate; no history-changing operation was performed.

Remote main/dev were verified read-only with git ls-remote: both `5f3d6489343aa115f8d517c9def011ba27d15b67`. Local main/origin refs match that recorded baseline; local dev remains the Intake checkpoint. Current implementation is not remotely released.

## Exact migrations and effects

| File | SHA-256 | Effects |
| --- | --- | --- |
| 20260922_002_sample_operational_profiles.sql | 0fce994d5086b37c36cda085c5623767c8688b71862336e1f4cf9840d6120d0e | New managed table, five conservative seeds, read policy, Admin/Developer revision-checked management RPCs. No existing Sample/profile snapshot rewrite. |
| 20260922_003_po_reservation_allocations.sql | 4a932dbcf227815bc1b99578a7d5ac807cdddb786df987b1d5af9671e6ed9279 | New line/Job allocation table and validated save wrapper; new-issuance enrichment; pending source key; replaces old unique index with legacy-partition plus allocation index; patches private projection conflict target; renames/wraps public projection; deferred quantity/identity reconciliation. |
| 20260922_004_partial_pending_receipts.sql | c363e969828e59b371807e8988f0da3b6b2a53898978f964648da30ac16fe5d0 | New receipt-batch ledger and explicit-quantity RPC; replaces receive-all public function and renames/wraps public undo. Existing internal implementations remain available under their prior private names. |

002 → 003 → 004 succeeds as DDL on the captured public schema. 003 precedes 004; 002 is independent. None requires or applies Intake 001. Existing migration files are untouched. No historical PO/Sample update/backfill is performed; pending rows gain additive metadata `source_allocation_key = legacy`. Therefore compare original columns for that table after migration, not blindly the complete new row JSON.

New tables use RLS with authenticated readOperationalData SELECT and no authenticated direct writes; RPCs check capabilities or active Admin/Developer. New definer functions pin search_path. Existing broad legacy Inventory policies are captured but not changed by this pass; no unrelated authorization remediation is included. Public/anon cannot execute the new business RPCs. Hosted service compatibility remains blocked as described above.

## Installed objects and evidence

Read-only schema export captured the entire public schema, including functions, ACLs, policies, constraints, triggers and indexes. SHA-256: `e91deb23931cf7cfafc64c73ec77a03805b9afa137a94b1c597a0a8920b68746`.

No existing object-name collision for the three new tables, source_allocation_key, or the two renamed base wrappers. Ledger contains only `20260724 / 001_guarded_test_purchase_order_purge` and `20260921 / 001_manpower_product_categories`; installed schema, not sparse ledger history, was authoritative.

Captured exact definitions include public projection/receive/undo wrappers and their three private implementations. Wrappers are postgres-owned SECURITY DEFINER, search_path pg_catalog/public, EXECUTE authenticated/service_role, no PUBLIC EXECUTE. Private implementations retain their captured ACLs and pinned search paths. The existing unique pending source index is btree(issuance_id,line_id), restricted to non-null source identities. Captured BEFORE INSERT PDF snapshot enrichment precedes the new zz allocation capture trigger; immutable update/delete guards are unchanged. The actual document initialization trigger creates pending document rows on issuance, and generated documents require generated_at; replay fixtures respected these actual constraints.

Capture directory: `/private/tmp/tenops-po-sample-production-gate-20260923/`. Key files: `public-schema.sql`, `ledger.json`, `function-hashes.json`, individual function SQL files, `index-and-trigger-definitions.txt`, `config-data.json`, `baseline.json`, `boundary-manifest.json`, `synthetic-integrity.txt`. These are evidence exports, not migration execution against hosted data. No private My Work/Inbox business content was read.

## Fresh Production data baseline

Each digest is SHA-256 of concatenated sorted per-row SHA-256 values of PostgreSQL `to_jsonb(row)::text`, calculated within one read-only repeatable-read transaction. Reports contain only counts/digests, no business row content. This is a gate-time baseline; recapture under an authorized write pause immediately before a future cutover.

| Table | Rows | SHA-256 |
| --- | ---: | --- |
| purchase_orders | 12 | 6888467ef4e8e74aa6068fe7030d5aa96c221ee44e64c6c539db99b6cdbd9d05 |
| purchase_order_lines | 61 | fd0f447fcae8d2d7c7157828c5fb02bcb31b0472c55a1fe8529c3414d3331385 |
| chip_purchase_order_line_details | 61 | 6f6294582a5f087db9a5303a91d9424cfbd061862aaec545551028aada97ff43 |
| purchase_order_issuances | 12 | bb3ae9b2972b944fd2d33c8f53cb31aca0d33dfa8a7f0ea88a881241d3c26422 |
| purchase_order_documents | 12 | af61b02cc04237d46093bfe1735faf316d1418ccf9e986c717245b0c9362330b |
| pending_receivals | 69 | 7c476ce5eec398d911780dff0b3350bbf2bd156ad55b2e22a6c4c64c1b11487d |
| inventory_items | 170 | 292dbde4009cd3091fcde7c05f39acb57c1de89576cec6c7039fec5be83834fb |
| inventory_transactions | 89 | 6f3885c13d84f87ece06db45256e6502dd87b81e33beb96498e8109f04f80c92 |
| samples | 1 | b21e2a4a4629933bd9edc39e1246391842ecfdac082769ca31c6cdcef30e806b |
| sample_blend_rows | 8 | 0ba1871e8940f81bbba9041754d9b7dcfc0836c12de9e264ee3b719581081bf4 |
| sample_working_versions | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| sample_issued_documents | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| sample_formulation_profiles | 10 | 591a22f2e05fa6f4ce6df8dec8ec6787db36f3b80ba309e3e942aaf9a3b5c6e0 |
| sample_formulation_defaults | 1 | cddd58c90e64b936318ad2fed89c5ce5edf9c1cd8842c19de35528296db63eb6 |

## Disposable runtime outcomes

Actual public schema restored into PostgreSQL 17.6, with minimal isolated auth primitives. Captured Production capability matrix (68 grants), 10 historical profiles and current default were loaded as configuration. No hosted business dataset was copied.

Passed:
- Exact migrations applied in order with actual Production tables, functions, constraints, ACLs and triggers.
- Synthetic historical PO issuance/document and Sample rows, Saved Version, issued Sample snapshot, historical profiles/defaults retained identical original-column digests across migrations.
- PO split save/reopen, quantity cap with transaction rollback, new issuance capture, split projection and repeat projection idempotency.
- Independent full quantity receipt, identical-request retry and guarded undo using actual installed undo implementation.
- Sample corrected V4 focused contract suite on captured functions, plus operational profile Add/Rename/Reorder/Deactivate/Reactivate, stale revision rejection, member/inactive denial, save/version/restore/issuance and captured-profile non-rewrite.
- Diff whitespace check. Prior client tests/build evidence is reused; no application source changed.

Failed: first partial receipt against the installed status constraint. The remaining partial receipt/over-receipt/concurrent retry/partial-undo lifecycle cannot be certified on the exact boundary. Prior simplified fixtures omitted this constraint and therefore did not reveal it. The initial captured-schema fixture adaptations (real capability rows, GENERATED ALWAYS default version, existing document initialization and generated_at constraint) were fixture corrections only; no Production definition was changed to force a pass.

Not claimed: hosted write smoke, full real PDF/Storage generation, full historical Production data migration (no hosted migration occurred), or drift-rejection runtime success. Synthetic test data is local only. No broad unrelated suites or visible browser were run.

## PO contract and recovery

Allocations are quantities of a line's existing order unit reserved for canonical Jobs, not a new demand ledger. Multiple Jobs and explicit general-stock remainder are supported. New immutable issuance snapshots retain intent internally; supplier PDF model is unchanged. Receiving should create existing Job-reserved Inventory lots and normal available remainder; cancellation retains already-received stock. Partial receiving is currently blocked by the constraint above.

Previous compatible client: `5f3d6489343aa115f8d517c9def011ba27d15b67`. A client-only rollback is NOT certified safe. Existing full-receive public signature works for normal authorized users in local replay, but the old client cannot manage allocations or partial receipt state, service-role behavior changes, and new receipt ledger/identity guards persist independently of client rollback. Old save paths also do not carry the new allocation UI semantics. Do not restore old receiver implementations blindly once new receipt batches exist.

Recovery sequence after a future authorized migration commit: pause PO save/issue/projection, Inventory receipt/undo/cancel and Sample save/profile-management writers (including background/service writers); preserve the accepted baseline and schema capture; diagnose; prefer a narrow forward correction preserving immutable snapshots, allocation portions and receipt ledger. Keep affected writes paused until corrected function/client compatibility is verified. If client fallback is necessary, explicitly disable unsupported allocation/partial workflows and verify the remaining old operations against the migrated schema first. Do not drop new tables/columns or erase receipt history as rollback. A tested recovery SQL/client combination remains a release prerequisite, not an assertion satisfied by this gate.

## Sample Product review

| Profile | Chip density lb/CFT | Dry pool oz/CFT | Filler oz/CFT | Resin fl oz/CFT | Ratio | Selection |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| MTT | 128 | 2560 | 512 | 480 | 5:1 | Fully configured; explicit application captures current revision/defaults. |
| Key Resin | Unknown | Unknown | Unknown | Unknown | 5:1 | Incomplete selection; missing-input warning and Configure path; current Draft calculations stay unchanged. |
| Terroxy | Unknown | Unknown | Unknown | Unknown | 5:1 | Same incomplete behavior; no borrowed rates. |
| Sherwin | 128 | 2560 | 512 | 512 | 4:1 | Fully configured; explicit application captures current revision/defaults. |
| Cement | Unknown | Unknown | Unknown | Unknown | ? | Explicitly incomplete; no fabricated ratio or quantity. |

Current V4 supports 4:1 or 5:1 managed ratio configuration. Other binder systems require a confirmed calculation contract. Incomplete profile configuration does not auto-apply; applying the completed profile is explicit. Existing manual ratio override provenance is preserved. Default new Draft chooses the first active complete managed profile; new Draft defaults fail clearly if none exists. Existing V1/V2/V3/legacy-V4/current-V4 dispatch functions and historical captured definitions are not replaced by 002. V4 Chip density, independent Filler and explicit Adjust Formulation semantics remain unchanged. No supplier-based exact product compatibility is inferred.

## Next authorization boundary

First correct the status constraint integration, explicit service-role compatibility, exact installed-definition guards and unique migration versioning; rerun only affected captured-schema lifecycle/security/recovery checks, then freeze a clean PO/Sample-only commit and revised hashes. This gate does not authorize silently changing the supplied SQL hashes.

Only after that corrected gate passes should Chris authorize: exact reviewed PO/Sample-only client SHA and exact migration hashes/unique IDs on shared Production project `vxdxjhazkqhpkwdqtobp`; coordinated write pause; ordered migrations and client deployment; bounded disposable acceptance and cleanup; fresh before/after original-column integrity checks; and final approved main promotion. Intake checkpoint, migration, UI and TEST dataset must remain excluded. No authorization to execute the current failing migration set is recommended.
