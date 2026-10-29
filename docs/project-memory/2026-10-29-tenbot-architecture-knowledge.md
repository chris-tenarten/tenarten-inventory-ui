# TenBot structured architecture knowledge — October 29, 2026

## Authorization and boundary

Chris accepts the read-only architecture review and authorizes a focused extension of the existing knowledge system, a local dev commit, and Product acceptance review. No push, deployment, schema migration, paid inference or new operational authority. The current explicit Product instruction governs; the separate Advisory thread is unavailable.

The original TenBot implementation thread remains focused on hosted Terra infrastructure and database validation. Chris relayed ownership of the knowledge generator, records, retrieval and related verifiers, with no concurrent knowledge edits reported. Shared dev was inspected at `d769ab3146bc8f85f282c3bbe738908223fa2532`; four unrelated dirty documentation files and existing untracked evidence/worktrees were preserved. Implementation/validation used `/private/tmp/tenops-tenbot-architecture-20261029/source` before integration onto dev. No review-server process was replaced.

Status: **implemented locally, pending Product acceptance**. Existing hosted Terra/database release holds remain separate. Source evidence does not establish fresh hosted behavior or employee execution permission.

## Extended existing contract

The existing 74 record IDs, permissions and workflow ownership remain authoritative. Fourteen existing records gain optional `architecture` facets: semantic entities/relationships/cardinality, classified facts, prerequisites, effects, approval requirements and limitations. Sixteen generated patches also include the shared Bid Preparation and Manpower refreshes.

Facts distinguish `schema-contract`, `product-convention` and `operational-rule`, and label verification as `repository-contract` or `released-source`. These labels describe evidence, not a current database attestation. `capabilityAvailability` distinguishes application availability from guidance-only or potentially registered reads.

Internal fields retain source revisions/blob/SHA digests, release receipts, dependency bindings, related record IDs, tool references and record digests. Employee/model results use one allowlisted projection; physical mappings, internal security details, raw source and maintenance evidence are excluded. The same projection and internal authority metadata participate in source-proof hashing, so changes to facts, effects, relationships, grants, release metadata or tool references invalidate retained guidance.

The initial connected set covers:

- Bid conversion to one canonical Production Job, with saved Won/deposit gate, independent scheduling permission and historical document preservation.
- Job/Manpower/Rework attribution, organizational reporting groups, temporary work identity and original/Rework labor distinctions.
- PO lines and allocations, explicit receival projection, partial receiving, guarded receipt reversal and on-hand Inventory.
- Job versus temporary-label reservations, eligible stock and separate reservation changes.
- Material Usage reporting versus the separate Inventory stock movement workflow.
- Proposal/Sample context, independent pre-Job documents and immutable issued history.
- Material assessment dependencies, unknown supply/unit evidence and the absence of reservation/order/delivery-promise effects.
- The lack of verified actual-output evidence: saved plans, Blend quantities and labor do not establish units produced.

No business lifecycle was changed. Existing grants are inherited from each patched record; concept facts do not expose a linked operation's restricted instructions.

## Retrieval and tool authority

`search_workflow_knowledge` searches the existing registry with token relevance across titles, terms, semantic entities and facts. It keeps two direct seeds and considers one hop of related dependencies, with eight edges per seed, no recursion, at most four returned sources and a 16 KB UTF-8 source budget. Direct candidate authorization is bounded to 24 candidates/four permitted matches; capability checks are memoized within one search and renewed on the next search.

Every related record independently passes existing status and full permission checks. Denied targets expose no titles, facts, nested metadata or tool references. Results remain explicitly incomplete and distinguish access limits from missing documentation. Selected-source grants are rechecked and retained as publication dependencies.

`capability_links` intersects reviewed references with actual registered read/prepare tools. It creates no tool definitions. Application services without adapters remain guidance-only; all links declare `execution: false`. Existing authenticated Job executors, strict discovery, caller JWT/RLS boundaries and final record freshness checks are unchanged. Static architecture is not current Job/Inventory evidence.

## Released guidance and provenance

The original generated module corpus and supplement retain runtime `bc628bdafea374f6a5fd446d7e924ff9d65918bf`. Shared patches pin Bid Preparation to `5e28d254b8d674ec64ce2ba347c83108366af936` and Manpower to `ae50e0fc55a7a6d9e454016c5d73a58e792aff79`. Both inference paths now use the same generated corrections; the hand-written optional-agent override is removed.

Bid guidance uses Overview → Bid Preparation. Manpower uses Reporting date, newest first, collapsed groups and complete-group/history coverage limits. No deployment is implied by this local knowledge update.

The Bid receipt is committed. The Manpower executed-release section was only in an unrelated dirty document. A narrowly captured, digest-bound copy is stored under `scripts/tenbot-knowledge/release-evidence/manpower-20261029.json`, explicitly labeled `captured-working-receipt`; it is not represented as a committed original or fresh hosted verification. The original receipt was neither modified nor staged.

## Incremental release synchronization

The existing generator accepts multiple scoped executed-release receipts rather than a hardcoded Intake heading. Each patch has a content digest and source/dependency pins. Release comparison checks each record against its own baseline and propagates affected relationships. Semantic dependencies and unclassified migration/authorization/tool-composition changes require review; interface-only changes are classified for deterministic extraction refresh. Generation never automatically advances a deployed pin to HEAD.

Commands:

```sh
npm run tenbot:knowledge
npm run verify:tenbot-knowledge
npm run tenbot:knowledge:review-release -- FULL_CANDIDATE_SHA
npm run tenbot:knowledge:review-release -- FULL_CANDIDATE_SHA --sync
```

The read-only release-review command can inspect a candidate from a dirty development checkout. Adding `--sync` invokes the release gate: the full SHA must equal HEAD, the source tree must be clean, and the exact deterministic artifact must already be committed. The release gate never rewrites source. Prepare reviewed deterministic content with `tenbot:knowledge` before committing the candidate. Semantic review holds exit nonzero. Updating business meaning, permissions, lifecycle, preconditions, approvals or effects requires a reviewed manifest/facet/source-boundary update. A successful old-pin reproducibility check cannot clear a release-impact hold.

`prebuild` runs automatic build synchronization. Full-history repository builds regenerate reviewed deterministic content only when bytes differ. Source archives/shallow builds verify packaged artifact and generation-input integrity without inventing Git or hosted proof. Candidate release metadata (`CF_PAGES_COMMIT_SHA` or `TENBOT_KNOWLEDGE_RELEASE_CANDIDATE`) requires full-history candidate impact review and fails closed on missing history or review holds. Manual release preparation must use the same candidate-aware gate; a local build is not release authorization.

The initial comparison with `d769ab3` reports legacy/candidate impacts against the older mixed corpus; these remain review holds rather than a broad knowledge audit or automatic acceptance. No existing hosted gate was cleared.

Future infrastructure-only changes can be acknowledged through the initially empty `scripts/tenbot-knowledge/infrastructure-reviews.json`. Each entry binds an exact path/blob to a committed accepted-infrastructure review section recording Chris's acceptance and an explicit declaration that business meaning, permission policy, lifecycle and effects are unchanged. This evidence is separate from executed business-release pins. It cannot acknowledge migrations, permission-source paths or dependencies bound to semantic records; new bytes require new review. No acknowledgment was added for this candidate.

## Validation

Tier 3, focused Testing Level 3 for knowledge/privacy/provenance and adjacent runtime/history contracts. No database contract, policy, migration or persisted business-record change requires new database execution in this delta. Offline doubles do not certify hosted JWT/RLS behavior or model reasoning quality.

Passed: generated reproducibility and packaged-artifact checks; 113 existing workflow examples; 13 focused architecture/generator groups; 35 session/history/privacy groups; 33 agent-runtime groups; 13 durable-history groups; 24 actual-Edge construction checks; targeted ESLint with Edge files explicitly included; TypeScript; `git diff --check`; Production Webpack build with safe localhost public fixture configuration. Archive tests cover missing Git, modified generation inputs, tampered executable artifact text and release metadata refusal. Independent source review resolved authorization fanout, candidate/source binding, archive compatibility, accepted-review parsing and shared authorization/service dependency coverage; no remaining scoped blockers.

These are offline synthetic contracts, not paid model inference, live database/JWT/RLS certification or a hosted behavior audit. Existing hosted database/release gates remain unchanged.

The existing hosted-browser verifier passed six actual-app groups at exact `http://localhost:3000`: desktop, mobile, status recovery, Material Usage on desktop/mobile and the novel assessment/reservation request. The candidate export and all Auth/data/provider transports were intercepted with synthetic fixtures; no request was forwarded to the running application backend or hosted services. Reload/blur/history hydration required no inference replay, and internal provenance was absent from the model/employee projection. Mobile rendering was visually inspected. Screenshots and raw receipts are under `/private/tmp/tenops-tenbot-architecture-20261029/browser`; the existing port-3000 process was left untouched. Chromium needed the normal sandbox escalation to launch; no security or application configuration changed.

The [sanitized validation receipt](evidence/2026-10-29-tenbot-architecture-knowledge.json) records scope, source hashes and outcomes. No task server was created; the isolated worktree/export and task-scoped scratch evidence are retained for review. No cleanup of unrelated worktrees, receipts or processes was attempted.

## Product acceptance

Review the optional contract, initial semantic coverage, bounded dependency retrieval, current guidance and release gates. The next boundary is Product acceptance. Push, hosted migration and deployment remain unauthorized.
