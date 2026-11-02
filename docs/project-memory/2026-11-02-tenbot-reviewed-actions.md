# TenBot reusable reviewed operations — local implementation

## Authority and boundary

Chris's November 2 **TenDev — Reusable Agentic Actions & Workspace Integration Contract** accepts the prior Terra conversational milestone and authorizes local backend implementation, isolated validation and a scoped local commit. The separate Advisory conversation is unavailable; the supplied Product contract is the authority. Tier 3 / Testing Level 3 applies to authorization and persistence. This record supplements the existing engineering handoff; its dirty concurrent Current State, execution-standard and index changes are preserved without staging them.

Base: root `dev` at `156a6eaad2f7a9f73791ca570c26a0458f046827`. Workspace `feature/tenbot-global-workspace-20261102` / `5cb71fb52ffe784715b9ae5d8bb95a14ac6df395` is a separate, untouched checkout. No frontend files, branding, message presentation, provider controls or legacy runtime are changed. Port 3000 is untouched. No push, deployment, shared migration application, hosted business mutation, write activation or paid inference is authorized or performed.

## Implementation and actual availability

- `tenbot-proposal-operations.ts`: caller-authorized customer/contact reads, nonpersistent new standalone Proposal preparation, and exact-snapshot PDF-preview mapping. Existing customer RPCs, Proposal defaults/calculations and `generate-proposal-pdf` preview are reused. No Job/Bid linkage, issuance, editing of existing Proposals, catalog-price-to-quote conversion or reserved document number.
- `tenbot-business-operations.ts`: independently callable private-original reading, material search, supplier/order/receival lookup and nonpersistent Pending Receival preparation. Reuses original integrity/download, caller catalog reader, catalog normalization, quantity/package validation and canonical invoice payloads. There is no mandatory invoice tool sequence. No new-material creation or duplicate override. Missing attestation, unmatched material, uncertain quantity, existing possible duplicate or unverified Job association blocks execution.
- `tenbot-reviewed-operations.ts`: assembles these tools into the **existing** `runTenbotAgent` registry/discovery protocol. A per-investigation, owner-scoped evidence handoff lets authorized document reads supply Proposal specifications; source resolution rechecks private-original access. Validated prepared payloads remain separate from model-visible tool data. Only a completed authorized run can publish a private review intent through the restricted trusted-server publisher; direct employee RPC calls cannot forge a card with different parameters. Employee revisions use the same strict preparation tool and fresh reads, then supersede the old review. One persistent action is reviewed per turn; read-only investigation can span domains.
- `tenbot-actions.ts`, `tenbot-action-auth.ts`, `tenbot-action-transport.ts`: typed review/status/receipt contract, trusted password verification and separate Workspace HTTP channel. No password or execution tool is in the model registry.
- `20261102120000_tenbot_reviewed_actions.sql`: **unapplied** local candidate for immutable, private review intents and action-specific password proofs. New tables are technical authorization/receipt state, not another conversation system. Proposal create+save is one canonical business transaction. Pending execution is explicitly blocked in the new card, password stamp and execution RPC; the database switch cannot be enabled. Review exposed a bypass through the existing legacy permit path, so that bridge and all new calls that stage approvals or mint permits were removed. A future bridge must enforce this action proof at the canonical commit point without changing employee permissions. Inventory receiving is outside scope.

These are local adapters and a guarded execution candidate, **not live employee operations**. Existing hosted ask/history remains read-only and unchanged. The new registry is available for coordinated host integration but is not injected into the deployed conversational constructor. Existing conversation IDs bind action reviews; no second message store was introduced. Persistent card listing/hydration and the frontend controls still require coordinated integration. Do not claim that Product can create a Proposal or Pending Receival through TenDev today from this commit alone.

Default source wiring reads existing employee-owned, integrity-checked originals and their already attested transcription. A fresh extractor can be injected, but no new image/PDF model inference was run. Arbitrary screenshots/specifications require the existing trusted document path and a reviewed metered extraction adapter; freeform employee text can already supply Proposal evidence. OCR quality and new-capability Terra judgment remain unverified.

## Workspace wire contract

All examples below are **illustrative**, not actual created records. Continue using the existing `ask`, `history`, `clear`, `conversationId` and ordinary message response contract. The new action transport uses the same authenticated TenBot Edge endpoint with `workspace: "tenbot.actions.v1"`. It accepts only `status`, `preview`, `cancel`, `confirm`. Do not put these requests or their responses into model context or conversation text.

Host publication returns a typed card (the model's raw function calls are never UI input):

```json
{
  "kind": "proposed_action",
  "contract": "tenbot.actions.v1",
  "reference": {
    "id": "c1c42c5b-28ed-4b54-a74b-1e5b90f17682",
    "revision": 1,
    "hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "expiresAt": "2026-11-02T23:00:00Z"
  },
  "operation": "proposal.save_draft",
  "review": {
    "title": "Save Proposal draft",
    "summary": "Review the proposed customer and material details before saving.",
    "consequences": ["Creates one new standalone draft.", "Does not issue a document or create a Job."],
    "fields": [{"path": "project_name", "label": "Project name", "value": "Example lobby", "editable": false}],
    "issues": [],
    "preview": {"kind": "proposal_pdf"}
  },
  "confirmation": {"kind": "account_password", "available": false}
}
```

`confirmation.available` is server-owned. Show the full reviewed fields, issues and consequences before requesting a password. A blocking issue or unavailable confirmation disables save. Fields are currently read-only: an employee requests a correction in conversation; the same preparation adapter validates the replacement, and publication supplies `supersedes` to atomically revoke the old card. `prepareRevision` is a backend integration method, **not** an exposed generic JSON mutation endpoint. Do not change values locally under an existing reference. Do not invent an inline editor or submit client-authored review summaries.

The Pending operation is `inventory.create_pending_receivals`. Its review contains each actual material identity, supplier, invoice reference, source/expected quantities and units, and explicit consequences that creation leaves received quantity zero and does not increase on-hand Inventory. It uses the same review reference shape, but confirmation is always unavailable in this candidate. No password is requested and no Pending rows can be created through this new path.

Preview request:

```json
{"workspace":"tenbot.actions.v1","action":"preview","reference":{"id":"c1c42c5b-28ed-4b54-a74b-1e5b90f17682","revision":1,"hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","expiresAt":"2026-11-02T23:00:00Z"}}
```

Response: authenticated `application/pdf`, `Cache-Control: no-store`, generated from the server's exact reviewed Proposal parameters through the existing PDF service. There is no client snapshot or arbitrary URL. An incomplete quantity or rate suppresses preview because the current renderer would otherwise display an unknown amount as zero. Incomplete drafts can still be saved as explicit drafts; unknown prices stay null.

Password confirmation request adds only `password` to the same reference:

```json
{"workspace":"tenbot.actions.v1","action":"confirm","reference":{"id":"c1c42c5b-28ed-4b54-a74b-1e5b90f17682","revision":1,"hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","expiresAt":"2026-11-02T23:00:00Z"},"password":"<employee enters their existing account password>"}
```

The trusted response has this shape:

```json
{
  "contract":"tenbot.actions.v1",
  "reference":{"id":"c1c42c5b-28ed-4b54-a74b-1e5b90f17682","revision":1,"hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","expiresAt":"2026-11-02T23:00:00Z"},
  "status":"completed",
  "receipt":{
    "contract":"tenbot.actions.v1","kind":"action_result",
    "reference":{"id":"c1c42c5b-28ed-4b54-a74b-1e5b90f17682","revision":1,"hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","expiresAt":"2026-11-02T23:00:00Z"},
    "operation":"proposal.save_draft","status":"completed","idempotent":false,
    "result":{"proposalId":"b473745a-7fb3-4001-819c-8502fcb999e4","status":"draft","url":"/proposals?open=b473745a-7fb3-4001-819c-8502fcb999e4"},
    "completedAt":"2026-11-02T22:46:00Z"
  },
  "session":{"access_token":"<private refreshed Auth session>","refresh_token":"<private refreshed Auth session>","expires_at":1793663160,"token_type":"bearer"},
  "recovery":{"kind":"refresh_action","reference":{"id":"c1c42c5b-28ed-4b54-a74b-1e5b90f17682","revision":1,"hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","expiresAt":"2026-11-02T23:00:00Z"}}
}
```

Workspace installs `session` through the existing Supabase Auth session mechanism, preserving same-owner conversation identity, then immediately discards the password and private response object. Never place password/tokens in conversation messages, analytics, local draft storage, logs, error monitoring or model requests. Auth session storage remains the existing Auth subsystem's responsibility. Responses after successful login can carry the new session even when execution is `failed` or `uncertain`; install it in those cases too. This avoids stranding an account under a single-session Auth policy. MFA/AAL2 is blocked rather than silently downgraded; existing MFA continuation must be integrated before enabling writes for those accounts.

`status` is read-only and returns `{contract,card,state,receipt}`. States are `prepared`, `authorized`, `completed`, `failed`, `revoked`, `expired`. `cancel` returns `{contract,kind:"action_cancelled",reference}`. Definite domain failures consume authorization; a correction needs a new review/password. For timeout/uncertainty, fetch `status`; never resubmit automatically, announce success, or create a replacement while outcome is unknown. Only durable committed receipts establish success. Generic errors are `{contract,kind:"action_error",error:{code,message}}` with employee-safe messages. Navigation must use actual receipt identities, not proposed IDs.

## Authorization and release gates

The password branch runs before provider construction. Supabase Auth verifies the existing account password through a fresh nonpersistent client; account identity derives from verified caller Auth, never caller email. The new same-owner Auth session is verified and handed to the trusted frontend; the password never reaches SQL or Terra. SQL binds owner, original and execution sessions, conversation, operation/parameters/review hash, revision, current permissions, policy version and finite expiry. Technical grants do not change employee roles or capabilities. Existing receival pilot/enrollment/permit and all canonical validation are unchanged; they do not authorize this new action path, which is blocked for Pending creation.

`TENBOT_REVIEWED_ACTIONS_ENABLED` defaults off and the new transport accepts only the TenDev origin. The new Proposal database control also defaults off; the Pending control is constrained false. Neither guard enables spending. Because Edge and database are shared, a future release requires explicit review of these shared surfaces; a TenDev Pages deploy alone does not isolate them. No `main` release or Production change is part of this candidate.

## Validation and limitations

Focused offline verifiers cover domain preparation, strict schemas, no-write reads, source/quantity/unknown-price handling, existing-runtime discovery/composition, password isolation and trusted transport boundaries. Scripted plans are not Terra reasoning or actual business persistence. The accepted November 2 six-case live read campaign is reused, not repeated.

Actual checks: Proposal verifier 19 groups; business operations verifier 16 groups; reviewed-action/Auth verifier 13 groups; integration verifier 8 groups. Full TypeScript, strict shared-module and Edge-entry TypeScript (local npm import mapping and minimal Deno type stub), targeted nonignored ESLint, diff whitespace and development-branding structural checks pass. An isolated Production webpack build exports all 25 pages; the initial Turbopack attempt rejected the scratch node_modules symlink, and initial scratch TypeScript failures were missing copied test/document-code dependencies. Those scratch setup issues were corrected without repository configuration changes. No browser smoke or live Auth claim is made.

[Machine-readable local evidence](evidence/2026-11-02-tenbot-reviewed-actions/local-validation.json) records the exact candidate's 56 focused groups against the committed runtime baseline, excluding the preserved unrelated dirty `after_tool` edit. The final isolated build passes; its temporary environment symlink was removed. No review server was started and port 3000 remains owned by the original PID 83974.

The existing local PostgreSQL fixture health check failed with `docker-unresponsive` at `daemon-info` after its 5-second deadline, including an approved sandbox escalation. No local PostgreSQL binaries are available. No Docker startup/repair or hosted fixture substitution was attempted. **Real migration application, transaction rollback, concurrent execution/replay, session revocation and actual created IDs/zero Inventory changes are not certified.** Static migration review and Auth doubles do not satisfy that gate. The migration must remain unapplied until isolated database validation and Product review.

No Mac screen access was used during this assignment. Reset of a prior computer-control session was aborted before dispatch, so release of that earlier capture context is unverified. No current browser verification is claimed.

The accepted prior receipt reports TenDev Pages `278165095eb000b69610f903424e951ce320acdb`, Production Pages `e71bd981a583e0a4e706f9953c6cc1fcc4d576e1`, and shared Edge v49/JWT ON from `da0da6e8599c52e56329b2cb827a3bcd7a5f667a`. These are the unchanged release baseline, **not freshly reverified hosted state**. This pass uses zero provider calls/tokens/cost, makes no funding or accounting changes, and leaves historical holds and existing operational-write settings untouched. Only the new local migration is added; no shared schema is applied.

Recommended next decision: review this local backend contract and its explicit Pending execution gap, then coordinate existing Workspace/host integration after the isolated transaction gate passes. Actual Pending creation still requires the narrowly scoped canonical commit guard and database proof; this is a material requirement, not an optional refinement. No additional framework or broad campaign is needed. A later separately authorized small paid test can exercise one new-capability document→catalog→Proposal/Pending preparation conversation under the existing $0.25 request ceiling; no such inference or spending is authorized here.
