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

## September 23 scoped Intake Planning acceptance

Chris explicitly authorized reconciling `181ab83c` onto `85708a5` locally, including the conservative Won + recorded deposit + existing createProductionJob conversion gate. This overrides the general lifecycle implementation hold only for the bounded Planning contract. Temporary `accessIntake` is Admin/Developer only; Lead/Member/Guest must be denied by route, navigation, RPC, table and file access. Production capabilities and independent document permissions remain unchanged. See [current reconciliation](2026-09-23-intake-planning-reconciliation.md). No hosted migration, demo insert, commit, push or deployment is authorized by this implementation request.


## HIGH PRIORITY backlog — Intake Planning — graphical contextual warnings

Chris requested this backlog item on 2026-09-24. **Not implemented or authorized for implementation in the current viewport-polish pass.**

Future warnings should be non-blocking, graphical and contextual to timeline rows/projected blocks. Initial deterministic candidates:

- Projected window in the past.
- Late-stage/Won opportunity missing a projected Production window (define late-stage against authoritative lifecycle fields).
- Significant overlap between projected Intake and committed Production.
- Significant clustering/overlap among projected opportunities.
- Lifecycle/conversion inconsistencies where deterministically detectable.

Product must define significance thresholds and presentation before implementation. Date overlap alone must not be represented as a capacity failure. Do not invent capacity percentages, overload scores, staffing predictions or automatic rescheduling without an authoritative TenOps capacity model. Preserve existing persistence, history, access and conversion semantics.


## Intake authorization decomposition — Product backlog

Approved Under Development rollout (2026-09-24): `viewIntake` grants active Admin, Developer, Lead, Member and Guest read/discovery access. Existing `accessIntake` remains Admin/Developer management authority. New viewers cannot mutate Bids, Updates, attachments, projected windows or conversions. Anonymous/inactive accounts remain denied. Conversion also requires existing Production Job-create/scheduling authority; destructive cleanup requires existing Admin authority.

Later decompose authorization deliberately: Intake read/view; management/edit; **financial visibility** (currently no field-level separation—deposit date and financial information in Notes inherit Bid read access); conversion; destructive actions. Do not infer new role grants from module visibility. Proposal/Sample access retains its separate existing authorization. A broader decomposition requires Product approval rather than implicit grants in UI work.

## Personal Intake TEST training — revised acceptance, September 24

Chris authorized an exception to the read-only viewer matrix for Patrick Soldow, Giovanni Coppola and Anthony Iorio: one personal TEST workflow per explicitly granted active user, including own Bid editing/files/Planning, Won+deposit conversion, and guarded own TEST cleanup. This does not grant normal Intake management or additional real Production authority. The eight Chris-owned reference demos are excluded. Explicit protected lineage, not names, controls authority. Chris subsequently authorized narrow Production authorization hardening after current hosted Jobs grants/policies exposed direct anonymous/authenticated mutations. No hosted application, commit, push or deployment is authorized. See [training implementation review](2026-09-24-intake-personal-training-review.md).


### Production authorization composition correction

Chris rejected the training migration's new normal-Job capability enforcement after the gate reproduced a Member Requested delivery regression. Preserve current Production normal-Job INSERT/UPDATE authorization and UI, without adding role grants. Existing Production editing authority also remains valid on TEST Jobs alongside explicitly scoped owner training APIs; TEST lineage/identity and owner/Admin-only cleanup stay protected. Anonymous direct Jobs denial and raw authenticated DELETE denial remain the separately approved exceptions. The unapplied migration was corrected and focused before/after compatibility checks pass; no hosted application/release is authorized.
