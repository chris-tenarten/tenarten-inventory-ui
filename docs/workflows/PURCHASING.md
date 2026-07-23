# Chip Purchase Orders

Phase 1 supports New Purchase Order, draft search/filtering, structured chip lines, deterministic line totals and subtotal, save, reopen, and edit.

Chip identity remains separate: material, chip size, package quantity, package measure, container, moisture condition, order quantity, and order unit. A line may reference `jobs.id` and display the current Production job identity.

The optional PO-level Production Job is a convenience default for the common single-job PO. Linking it snapshots Job Reference and Job Number, defaults a blank Date Requested from the job's requested delivery date, and assigns only currently unassigned lines. It does not overwrite deliberate dates or line assignments, so multi-job POs remain supported. Ship To, Payment Terms, and Authorized By are editable document snapshots rather than fields inferred from Production.

The chip template follows the supplied T&M and KCI chip POs: PO Date, PO Originated By, PO Number, vendor and contact, Job Reference, Job Number, Ship To, Payment Terms, Date Requested, item identity/description, quantity, unit price, line total, special conditions, subtotal, and authorization. The metal PO was reviewed only to identify category-specific differences and did not redefine the chip model.

An unnumbered draft receives its immutable Purchase Order number on its first successful save. Linked drafts use the final four digits of the snapshotted Production Job Number; stock drafts use `9999`. The database allocates a unique three-digit suffix through private locked sequence state. The UI displays the number read-only, and changing dates, Vendors, Jobs, lines, or templates never recalculates it. Existing and historical numbers remain untouched.

Catalog selection proposes identity and packaging defaults without locking fields. Catalog price is labeled potentially outdated and is never applied without an operator action. Changing material preserves a manually entered price for review. Historical pricing will prefer explainable recent issued matches; no average or fabricated history is used.

Selecting a Vendor ranks its catalog matches first without excluding other vendors, so job or header changes cannot empty otherwise valid results. Office users can create Vendors, maintain multiple contacts, deactivate either without damaging snapshots, explicitly update a selected specialty catalog price, or create a new `vendor_catalog_v2` chip item from a PO line. Freeform lines remain available.

Saved drafts have an explicitly confirmed Delete Saved Draft action. Deletion is transactional and limited to the draft plus its dependent draft lines; Vendors, Catalog entries, Production Jobs, attachments, and unrelated records are untouched.

Purchase Orders remain procurement requests, not Vendor Invoices. The historical Tenarten form includes optional Discount %, Sales Tax %, Freight, calculated amounts, and Total, so those vendor-facing values remain on the PO. Invoice number/date, credits, payment state, reconciliation, and unrequested vendor charges belong to future invoice processing. A pallet charge may be an intentionally ordered PO line when Anthony explicitly asks the vendor to supply it.

## Draft to Issued

A saved, automatically numbered Draft may be issued after confirmation. Issuance uses the Draft's `updated_at` as an optimistic-concurrency token; a changed Draft must be reloaded and reviewed. The database recalculates totals and atomically captures an immutable header snapshot, deterministic ordered-line snapshot, issuing actor, timestamp, revision, and snapshot hash.

Retrying the same revision returns the same issuance rather than producing a duplicate. Issued Purchase Orders reopen read-only, and ordinary header or line write paths are rejected by the database. Stock POs may issue without a Production Job.

After issuance succeeds, the editor requests permanent PDF generation. Issuance is never rolled back when document generation fails. The issued record exposes Pending, Generating, Generated, or Failed state; Failed generation retains its error and can be retried. Generated files are opened or downloaded from the original private Storage object.

The shared PDF renderer accepts one normalized document model. Draft preview passes the current unsaved editor snapshots directly and returns an ephemeral, non-cached PDF with a `DRAFT - NOT ISSUED` watermark. It creates no issuance, document row, Storage object, or workflow change. Permanent generation passes only immutable issuance snapshots. Current Vendor, Job, Customer, contacts, Catalog, and draft values are never queried to reconstruct a historical PDF. Snapshots created after the PDF migration include linked Customer; older snapshots without that field leave it blank rather than consulting the current Job.

Both Classic and TenOps templates use the same bounded document geometry and labels. Classic references the historical Excel form and uses its restrained teal treatment; TenOps uses the current navy treatment. The selected template and version are visible before issuance, previewable, copied into the immutable snapshot, and permanently associated with the generated artifact.

The exact issued PO number is rendered as text. Revision creation and appended-material versions remain deferred.

After the permanent document is generated, an operator may review eligible immutable snapshot lines and project selected lines into Pending Receivals. Material, size, category, quantity, unit, ETA, and location remain reviewable operational values. ETA starts blank because the PO requested date cannot reliably prove expected material arrival. Creation is explicit, transactional, and idempotent per issuance line; previously created lines remain visible and only remaining lines can be created. Manual Pending Receival creation and receiving remain independent.

Deferred: revision creation, attachments to Project Files, email, full receiving-against-PO reconciliation, partial receipt tracking by PO line, material readiness, approval workflows, Vendor Invoices, and non-chip PO categories.

## Shared editor and future actions

`PurchaseOrderEditor` is the single editor boundary. Future Forms and Production entry points must launch this same editor with an optional initial Production Job; they must not create separate PO implementations.

The Production Inspector now launches that editor through `/purchasing?jobId=<uuid>`. Purchasing loads the canonical Job by ID, prefills the editable draft relationship and blank line defaults, and gracefully falls back to an unlinked draft if the identifier is missing or invalid. URL display text is never trusted.

Specialty catalog items may define Individual, optional Bulk, and optional Truckload tiers with compatible minimum quantity/unit thresholds. The highest compatible qualified tier applies: Truckload, then Bulk, then Individual; this only resolves overlapping thresholds and does not encourage Truckload purchasing. The first-time Truckload editor suggests Anthony's current 900-Bag threshold, while preserving an editable Vendor/item-specific minimum. Bulk and Truckload prices may remain blank as `Call for pricing`. Incompatible units and incomplete thresholds fall through to the next compatible tier. Catalog changes require an explicit operator action and confirmation, and never rewrite saved Purchase Order snapshots.

Permanent PDF status, retry, original-download, and Pending Receival review controls are persistent actions on an issued Purchase Order. Upload to Project Files remains separate and deferred. Linked PO projections carry the canonical snapshot Job ID and immutable Job display context; stock POs create unreserved receivals. Success provides an explicit Pending Receivals navigation action.

Draft and issued output share `buildPurchaseOrderPdfModel` and the dedicated Edge Function renderer. React screen markup is not a business-document renderer. Pre-issuance output always carries a DRAFT watermark and remains ephemeral.
