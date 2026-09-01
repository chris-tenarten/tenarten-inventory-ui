# Open Questions

This file separates confirmed Product direction from unresolved semantics. Unresolved items are not implementation commitments.

## Pre-Production: confirmed direction

- The Pre-Production parent is a **Bid**; Tenarten operationally “wins a bid.”
- Proposal contains Estimate and the existing generic Proposal domain must be reused.
- One Bid entering Production maps 1:1 to one canonical `public.jobs` Production Job.
- Deposit receipt is the known practical Production gate.
- Bid Line Items describe commercial scope/piece types; they are not separate Production Jobs.
- Production may later contain multiple Work Orders/areas.
- Proposal and Sample documents may exist independently and acquire Bid/Job relationships later; issued history is not silently rewritten.
- Sample does not require a Production Job. A generic Sample Form Generator is planned.
- Vendor Catalog should support Sample chip-blend authoring with manual fallback.
- Color Plate format is `T[YY]-[###][letter]`; suffixes are neutral and do not automatically encode A→B supersession.
- Sample approval is explicit and date-based.

## Pre-Production: unresolved for Product Acceptance Contract

- What exact states, transitions, and terminal states make up the Bid lifecycle?
- What event creates a Bid, and which fields are required at each stage?
- How do Estimate, Proposal, Bid, Bid Line Items, and revisions relate and retain immutable issued history?
- Can one Bid contain multiple Proposals/Estimates, and which version becomes accepted commercial scope?
- What exactly counts as “deposit received,” who records it, and are exceptions or overrides allowed before Production creation?
- At the Production gate, which values are copied as snapshots, which remain linked, and how are conflicts/retries handled without duplicate Jobs or Job numbers?
- How are Bid Line Items mapped into later Work Orders/areas without becoming Jobs?
- What are the Sample lifecycle states, revision rules, approval/rejection semantics, and required approval evidence?
- How do standalone Samples later attach to a Bid or Job while preserving their original issued context?
- How are Color Plate base numbers and neutral suffixes allocated, validated, and associated across Sample revisions?
- Which Vendor Catalog fields feed chip-blend authoring, and how is manual fallback normalized without inventing catalog records?
- What visibility, edit, approval, deletion, and privacy/RBAC rules apply to Bids, commercial values, Estimates, Proposals, and Samples?
- What search, inbox/task, notification, audit, attachment, and document-generation behaviors belong in the first release boundary?

## Other unresolved operational questions

- Manpower: exact shop notebook workflow, commonly used process rows, and reference-management permissions.
- Material Usage: entry timing, required legacy-form fields, inventory expectations, and custom/unmatched mix handling.
- Daily Production: reporting cadence, meaningful throughput metrics, and live versus retrospective entry.
- Access control: final role definitions, financial-field visibility, reference-data administration, and historical-report editing.
