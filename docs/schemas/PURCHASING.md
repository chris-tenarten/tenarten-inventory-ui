# Purchasing Schema

Phase 1 establishes structured chip and aggregate Purchase Order drafts. The structured record is canonical; a future PDF is an artifact.

`purchase_orders` owns the optional primary `jobs.id` relationship; job number/name snapshots; vendor snapshots; Ship To and Authorized By snapshots; lifecycle; commercial totals; revision identity; dates; and attribution. `purchase_order_lines` is only stable shared line identity. `chip_purchase_order_line_details` owns chip-specific material, size, packaging, moisture, quantity, price, requested date, and canonical Production job identity.

`vendors` is the canonical office-managed company profile. `vendor_contacts` supports multiple active or inactive contacts and one active default contact per Vendor. `vendor_catalog_v2.vendor_id` links maintained catalog entries to that profile while retaining vendor-name snapshots for compatibility. PO drafts always preserve editable vendor, address, contact, and terms snapshots; later Vendor edits never rewrite historical POs.

Draft writes use `save_chip_purchase_order_draft_v2(jsonb,jsonb,text)`, which delegates the existing guarded line persistence and allocates one immutable Purchase Order number when an unnumbered draft is first saved. `purchase_order_number_sequences` is private allocator state; row-level upsert locking provides concurrency safety without runtime `MAX()+1`. Linked drafts use the last four digits of the snapshotted Job Number as their prefix, while stock drafts use `9999`. Existing numbers are preserved and historical Purchase Orders are never renumbered. `delete_purchase_order_draft` transactionally removes only saved drafts; cascading foreign keys remove their dependent draft lines and chip details.

Catalog prices are weak references only. Explicit catalog maintenance updates the current suggestion; changing a PO line price alone never updates the catalog. Historical suggestions use recent issued PO lines and never learn from drafts or cancelled records.

Migration `20260722_008_vendor_catalog_bulk_pricing.sql` preserves `vendor_catalog_v2.price` as the Individual Unit Price and adds optional `bulk_price`, `bulk_minimum_quantity`, and `bulk_minimum_uom`. A complete bulk threshold requires a positive quantity and unit. Threshold evaluation is unit-compatible and performs no automatic conversion. Existing single prices remain Individual prices unchanged.

Migration `20260723_002_vendor_catalog_truckload_pricing.sql` adds a third optional Truckload price and configurable minimum quantity/unit. The current operational default is 900 Bags when first creating a Truckload tier, but the stored threshold remains Vendor/item configurable. Applicable pricing uses the highest compatible qualified tier: Truckload, then Bulk, then Individual. This is selection precedence, not a purchasing preference. Bulk and Truckload thresholds may intentionally have no stored price and then display `Call for pricing`. No unit conversion is inferred.

Phase 1.1 removed line-level requested dates. Phase 1.3 restores the optional monetary fields visibly present on Tenarten's historical Purchase Order form through forward migration `20260722_004_purchasing_optional_charges.sql`: Discount %, calculated Discount Amount, Tax %, calculated Tax Amount, Freight, and Total. The RPC and client share the approved temporary order of operations: discount applies to Subtotal, tax applies after discount, and freight adds last.

Purchase Order charges describe the vendor-facing PO form and do not create a Vendor Invoice domain.

Migration `20260723_001_purchase_order_issuance.sql` adds `purchase_order_issuances`, one immutable issuance row per Purchase Order revision. The row stores deterministic header and ordered-line JSON snapshots plus a server-generated SHA-256 hash. `issue_purchase_order(uuid,text,timestamptz)` locks the draft, enforces a configured Vendor, issuing actor, a unique nonblank manual PO number, complete sequential lines, valid quantities and prices, recalculates all totals, checks the caller's `updated_at`, captures the snapshots, and changes the PO to Issued atomically.

Issuance is idempotent: retrying the same Purchase Order revision returns its existing issuance. Database triggers reject later changes to issued headers, lines, chip details, or issuance snapshots. Stock POs remain valid because `production_job_id` is optional.

Migration `20260723_004_purchase_order_pdf_documents.sql` adds one `purchase_order_documents` row per issuance with `pending`, `generating`, `generated`, and `failed` lifecycle states, deterministic private Storage identity, generation attempts, timestamps, and recoverable error detail. A future issuance snapshot captures the linked Job Customer before insertion and includes it in the server-generated hash. Historical snapshots are never enriched from current operational data.

The `generate-purchase-order-pdf` Edge Function claims generation through a service-role-only RPC, reads only immutable `order_snapshot` and `lines_snapshot`, renders a dedicated multi-page business document, and uploads once to the private `purchase-order-documents` bucket. Existing artifacts are reused. Downloads use temporary signed URLs and never regenerate the document.

The deployed function requires `TENOPS_LOGO_URL`, pointing to the public Tenarten logo asset used in permanent documents. Missing or unreadable branding fails generation visibly while leaving the Purchase Order Issued and retryable.

Purchase Order numbers remain immutable text from the issuance snapshot. PDF generation does not derive, normalize, increment, or reinterpret Job-linked, stock (`9999`), revision, or decimal-appended numbers. Allocation happens before issuance and the resulting text is reused by draft previews, immutable snapshots, permanent PDF generation, and downloads.

Migration `20260723_005_purchase_order_pdf_v2.sql` adds the explicit `classic` and `tenops` template choice, immutable template name/version metadata, and the draft-only template update boundary. Migration `20260723_006_purchase_order_number_allocation.sql` adds automatic number allocation.

Migration `20260723_008_purchase_order_pending_receivals.sql` adds nullable PO provenance to `pending_receivals`: immutable issuance ID, source line ID, source line number, and source PO number. A partial unique index on issuance and line ID protects retries and concurrent requests without affecting manually created rows. `create_pending_receivals_from_purchase_order(uuid,jsonb,text)` validates selected reviewed values against the immutable snapshot, requires a generated permanent document, and inserts the selection atomically. It never reads the live Vendor or Catalog to reconstruct issued facts.

The integration creates queue rows only. It does not implement full receiving-against-PO reconciliation, partial receipt tracking by PO line, automatic receiving, Inventory mutation, or Vendor Invoices.
