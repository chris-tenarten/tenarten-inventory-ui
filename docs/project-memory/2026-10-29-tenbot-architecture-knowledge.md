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

## Focused Product acceptance evaluation — October 29, 2026

Chris's **TENBOT — FOCUSED KNOWLEDGE ACCEPTANCE** accepts `b11b7574b72dd7ae3186477df075dbca267dc8f7` as the local implementation candidate and authorizes only focused before/after evaluation, then Product acceptance review. This supersedes the earlier pending-implementation-acceptance status above. No further architecture implementation, push or deployment is authorized. The separate Advisory thread remains unavailable; the current explicit Product decision governs.

Tier 2 read-only acceptance evaluation, reusing the existing focused Tier 3 implementation evidence and exact candidate source hashes. Compared parent `d769ab3146bc8f85f282c3bbe738908223fa2532` and accepted `b11b757` with 14 identical existing cross-module queries. Exported only the five baseline knowledge/retrieval files into task-scoped scratch; did not alter either implementation. Existing `verify-tenbot.mts --architecture-only` passes all 13 groups, and `verify:tenbot-knowledge` passes reproducibility. No application rebuild/browser rerun was needed for this evaluation-only delta; the candidate's prior exact-source build/browser receipts remain applicable.

| Area | Before → after selection / evidence |
|---|---|
| PO chain | Previously omitted allocation and actual-receipt guides; now returns projection, allocation and receipt sources together, including projection ≠ on-hand stock and actual received quantity only. |
| Material Usage | Specific report guide moves from fourth to first; explicitly no automatic stock decrement. |
| Assessment/reservations | The novel shortage/order/delivery request previously missed both guides; now retrieves assessment and reservation evidence at ranks two/three, preserving own/other/general/incoming stock and unknown/no-mutation limits. |
| Job/Rework labor | Specific labor guide moves from third to first, with same-Job attribution, separate original/Rework labor and actual registered read links. |
| Bid/Production and documents | Conversion and Won/deposit evidence remain selected; direct Sample relationships are added. Document-history query now leads with the specific Proposal issuance/history guide, alongside independent Sample context and historical-snapshot safeguards. |

Fifteen focused semantic-coverage assertions pass, including the dedicated Bid/document-history case beyond the existing architecture suite. All returned records pass their own full grants across 140 before/after permission-profile runs. Forty-two registry variants (actual five Job reads, actual summary-only subset, empty registry) expose only registered read references; every capability link has `execution: false`. Scope evidence confirms no SQL, shell, private-message retrieval or execution. Static evaluation invokes no live read or inference.

Current shared Bid Preparation and Manpower records agree with agent records across all five corrected IDs. The parent agent already had current hand-written overrides; the measured gain here is shared consistency and provenance, not a new improvement to already-current agent prose. Runtime ID patches replace historical base wording before retrieval.

Two nonblocking ranking gaps remain. The existing reservation/supply query drops the dedicated reservation procedure from four results even though assessment remains first and correctly distinguishes stock eligibility. The existing actual-output query puts an unrelated My Work completion guide first; the explicit unverified-output/no-inferred-production limitation remains third. Four-source/16 KB/one-hop bounds disclose incomplete retrieval and may require a narrower follow-up. No corrective architecture change was made under this evaluation request.

Fresh read-only release-impact analysis still returns `review-required`: 31 semantic records plus 14 dependents (45 affected), 31 unclassified sensitive paths and zero acknowledgments. It exits 1 and leaves the artifact unchanged. These holds were not waived by local candidate acceptance. Independent read-only review recommends the knowledge content as suitable to accompany the next TenBot release **after** its candidate-aware semantic/source-review holds are resolved; this is not release clearance or hosted/model-quality certification.

See the [focused acceptance evidence](evidence/2026-10-29-tenbot-knowledge-acceptance.json). Raw synthetic comparison and scratch harness remain under `/private/tmp/tenops-tenbot-architecture-20261029/acceptance`. Only this receipt, its sanitized evidence and scoped memory notes changed; no application source, migration, hosted configuration, inference call, server process, commit, push or deployment. Unrelated dirty work is preserved. Stop for Product acceptance of the evaluation findings and remaining ranking limits.

## Accepted record source review — October 29, 2026

Chris accepts `b11b7574b72dd7ae3186477df075dbca267dc8f7`'s structured knowledge implementation and focused retrieval improvements, and authorizes evidence-supported release-hold classification and local dev commits in **TENBOT — RESOLVE KNOWLEDGE RELEASE HOLDS**. This engineering source review implements that scope; the resulting resolution returns for Product acceptance. Separate Advisory unavailable; the current explicit Product decision governs.

Business meaning, permission policy, lifecycle and effects are unchanged. This declaration applies to the existing employee claims/grants in the record-specific comparisons below. It does not declare entire changed files semantically identical, accept new hosted/invoice/provider lifecycles or approve unapplied migrations. Current Bid Preparation/Manpower patches continue to win over historical records. No uncertain new business or permission semantics are accepted.

Tier 3 focused classification/provenance review; reuse the exact candidate's completed implementation and acceptance verification. The original 45 affected records comprise 31 direct semantic records (38 exact source bindings) and 14 dependencies. All 31 existing direct claims and their grants remain supported, and all 14 dependent records retain their existing meaning. No employee prose, relationship, permission, executable tool or lifecycle is changed by this resolution. Two accepted nonblocking ranking gaps remain unchanged.

The existing generator gains record-specific no-claim-impact comparisons and already-executed source classifications. Each comparison binds its committed receipt/source tree, original and reviewed source bytes, full effective record/grant/tool/provenance digest and any newly extracted helper bytes. Future changes restore the hold. No deployed source pin advances. Review metadata stays maintenance-only. Generated knowledge is classified as deterministic only when its nominated committed bytes exactly equal regeneration; every independent source/input hold still applies. This avoids a circular snapshot self-acknowledgment.

Reviewed path decisions:

| Source | Classification and semantic decision |
|---|---|
| `src/app/client-layout-shell.tsx` | **interface-only**: Only a blank line changed; referenced module navigation and grants are unchanged. |
| `src/app/inventory/page.tsx` | **internal-only**: Existing manual receival mapping and required validation extracted unchanged; receipt, stock movement, reservations, search and permission checks unchanged. New local invoice operations are not represented as released. |
| `docs/project/PROJECT_MANIFEST.md` | **documentation-no-claim-impact**: Referenced Inventory/Manpower/Intake paragraphs are identical. Added paid-provider policy concerns separate held runtime; the Inventory-era Bid Preparation placement change is already represented by released scoped patches. |
| `src/modules/pre-production/BidWorkspace.tsx` | **released-presentation-no-claim-impact**: Tools moved into Overview Bid Preparation in executed 5e28d254; patched current guides already describe this. Referenced Bid creation, Updates/Files and material-assessment limitations and grants are unchanged. |
| `docs/project-memory/CURRENT_STATE.md` | **documentation-no-claim-impact**: Only dated status/receipt additions; selected Proposal/Transmittal and private My Work/Inbox facts are identical. Historical statuses do not override the later executed-release sections. |
| `src/modules/production/jobs.ts` | **internal-only**: Existing effective Rework overlay extracted with unchanged status/dates; added original-lifecycle fields support existing reads without new business actions. |
| `src/modules/production/readiness.ts` | **internal-only**: Reexports identical planning-completeness helper and labels; material status remains separate. |
| `src/modules/manpower/ManpowerWorkspace.tsx` | **released-presentation-no-claim-impact**: Reporting-date default and loaded-group sorts already refreshed at ae50e0fc. Existing Job filters, saving, attribution and grants are unchanged. |
| `src/modules/manpower/product-reporting.ts` | **internal-only**: Same separate AM/PM rounding to integer hundredths extracted to shared labor helper. |
| `src/modules/production/rework.ts` | **internal-only**: Reexports identical terminal states and active-cycle predicate. |
| `src/modules/production/components/MonthlySnapshot.tsx` | **internal-only**: Reuses identical active/terminal status arrays; no archive, reporting-period or calculation change. |
| `src/modules/my-work/InboxDialog.tsx` | **released-assistant-composition-no-claim-impact**: Added assistant rendering/composer and mobile layout. Ordinary employee group/DM/reply/attachment/draft/edit actions, participation rules and historical privacy claims remain unchanged; no independent private-content retrieval. |

The source comparison for CURRENT_STATE includes only the scoped acceptance/source-review notes committed with this receipt; unrelated dirty status notes remain outside the commit. Identical selected documentation paragraphs were checked explicitly. The manifest's provider-accounting update is genuine separate candidate behavior, but does not change these referenced Inventory/Manpower/Intake claims. Bid/Manpower presentation changes are executed released behavior, not new business gates. Inventory's extracted manual mapper is local source equivalence, not fresh deployment or invoice-execution evidence.

Exact record/source/digest decisions (the metadata binds this receipt's commit as its reviewed source tree):

| Record ID | Source | Original blob | Reviewed blob | Effective content/authority SHA-256 |
|---|---|---|---|---|
| `dm` | `src/modules/my-work/InboxDialog.tsx` | `1e2fe3d86211d6819f0b38170e305ee4142764bf` | `48930cbf14eaa994a7b794c54cb618f02bcf7d26` | `bc307fd6417f038fcff168d590a4ad46b7107ea36665e67a71fc5a6d55c16910` |
| `group` | `src/modules/my-work/InboxDialog.tsx` | `1e2fe3d86211d6819f0b38170e305ee4142764bf` | `48930cbf14eaa994a7b794c54cb618f02bcf7d26` | `6e87c76817da022ca9355b2d1596ae9548df742613d915c75db6b4e88e293e9b` |
| `inventory-activity` | `src/app/client-layout-shell.tsx` | `08e52e6de00c69e6607feb25c934a421bbb45974` | `b6c799e95b190432f9866a0cd868873fb8afc19e` | `40628496c5ba32a1eea471262593f20502117e2629e604af970dd5168be60436` |
| `inventory-pending-create` | `src/app/inventory/page.tsx` | `d7f7b77a202883eabb445dde88f6f6b481cc434b` | `081d40a120cd8ce4bbc6be884f282cf0c27ce377` | `240867443b00f8f12d50578963ff6337c5a38701c9d5833f7ea0f2a384c70a00` |
| `inventory-pending-receive` | `src/app/inventory/page.tsx` | `d7f7b77a202883eabb445dde88f6f6b481cc434b` | `081d40a120cd8ce4bbc6be884f282cf0c27ce377` | `53015734080f00d2a16f67984ef72f44b1de3a4695be5bfd831f423704e1257f` |
| `inventory-stock-movement` | `src/app/inventory/page.tsx` | `d7f7b77a202883eabb445dde88f6f6b481cc434b` | `081d40a120cd8ce4bbc6be884f282cf0c27ce377` | `2b74456d88bd763a77940da9ff284938b21aa4288bd834465677bae46dfc1f36` |
| `inventory-stock-reservation` | `src/app/inventory/page.tsx` | `d7f7b77a202883eabb445dde88f6f6b481cc434b` | `081d40a120cd8ce4bbc6be884f282cf0c27ce377` | `1d52c259c505a87b45313a6fcd635126f64e40c375a6dcd906fb8f4b9893fdd0` |
| `inventory-stock-search` | `src/app/inventory/page.tsx` | `d7f7b77a202883eabb445dde88f6f6b481cc434b` | `081d40a120cd8ce4bbc6be884f282cf0c27ce377` | `44a865f03fe5a8de7fb098f235ecb62650d7d20e1cd621308bb7e010353f4c8a` |
| `inventory-stock-search` | `src/app/client-layout-shell.tsx` | `08e52e6de00c69e6607feb25c934a421bbb45974` | `b6c799e95b190432f9866a0cd868873fb8afc19e` | `44a865f03fe5a8de7fb098f235ecb62650d7d20e1cd621308bb7e010353f4c8a` |
| `knowledge-intake` | `docs/project/PROJECT_MANIFEST.md` | `f975660c040ddb8dfc7c971d5d8ebd9f4e286248` | `6a9d628b69c4d63efe54eaeb7e856ccaee514ce1` | `6eebc3395a57b2b125424104a692d384e305f72b3508c9202f6fa0883eaa2c75` |
| `knowledge-inventory` | `docs/project/PROJECT_MANIFEST.md` | `f60d776dca6f9fbf40888b6cb55b5a5dc4fbd9a3` | `6a9d628b69c4d63efe54eaeb7e856ccaee514ce1` | `1d68e7c9b69b386149818664f131bd700265aeb999d81501f503d713636dc5cb` |
| `knowledge-inventory` | `src/app/inventory/page.tsx` | `d7f7b77a202883eabb445dde88f6f6b481cc434b` | `081d40a120cd8ce4bbc6be884f282cf0c27ce377` | `1d68e7c9b69b386149818664f131bd700265aeb999d81501f503d713636dc5cb` |
| `knowledge-manpower` | `docs/project/PROJECT_MANIFEST.md` | `f975660c040ddb8dfc7c971d5d8ebd9f4e286248` | `6a9d628b69c4d63efe54eaeb7e856ccaee514ce1` | `6d557cf15630455f3739be6975e8ac8b35052deeda56bb44f0688afc6bb83389` |
| `knowledge-material-assessment` | `src/modules/pre-production/BidWorkspace.tsx` | `5a4db36d21a9ca6b89a6b686a91befcf214be6c4` | `bcf614293603004d6e83fbfc782bbdc766cf46f5` | `711a09a3950fee7bcfc9248e691ed44799a4eca55e1e30e02972b0d95bdac768` |
| `knowledge-messaging` | `docs/project-memory/CURRENT_STATE.md` | `16c76dcdcef40237489c3daf027512b63f65e9b6` | `1d91b7de380c2d149c58aacaaf37d86ddd9de5ee` | `868e7190ae61c7e32e9963edf4669636cddd31a1cdb9a670af98713e8eb33a9c` |
| `knowledge-production` | `src/modules/production/jobs.ts` | `9db7ef3fa0aced661100bf292fccb8462a6b4113` | `0622319deb9f21e486a25511f6d98378f49987f0` | `15c097dff11ee0cdb20b012788135361a2df622852a4a8f6939b32f91da866f8` |
| `knowledge-production` | `src/modules/production/readiness.ts` | `4b7ca6addfa9c1a18505c7a20a6dbad996c89cc4` | `669ae55ad57d6908d370c80cf88d02596192d8ae` | `15c097dff11ee0cdb20b012788135361a2df622852a4a8f6939b32f91da866f8` |
| `knowledge-proposals` | `docs/project-memory/CURRENT_STATE.md` | `16c76dcdcef40237489c3daf027512b63f65e9b6` | `1d91b7de380c2d149c58aacaaf37d86ddd9de5ee` | `64bc5848f3e589dea04a8aab52b77794bfba2379db835c1e8731746d262bb792` |
| `manpower-job-filter` | `src/modules/manpower/ManpowerWorkspace.tsx` | `c5d64c5429b5f9d0c0411d433a8e3bdf788537ed` | `9161b007d24a8d6ba6cf972b636a05bddac9c604` | `1287c0fb1b17e84a4df57887b7b1570dc460849bb4593330f25583afe26b430f` |
| `manpower-job-filter` | `src/app/client-layout-shell.tsx` | `08e52e6de00c69e6607feb25c934a421bbb45974` | `b6c799e95b190432f9866a0cd868873fb8afc19e` | `1287c0fb1b17e84a4df57887b7b1570dc460849bb4593330f25583afe26b430f` |
| `manpower-record-labor` | `src/modules/manpower/ManpowerWorkspace.tsx` | `c5d64c5429b5f9d0c0411d433a8e3bdf788537ed` | `9161b007d24a8d6ba6cf972b636a05bddac9c604` | `60bbb13fa7e82f1e0fbcbdb33420276866307834954eb37f5954dbd4b437baa8` |
| `manpower-record-labor` | `src/modules/manpower/product-reporting.ts` | `3f0f326c8fdc9622368fdc7d43441620faf48adc` | `6e1c8e1dc5faa6f2ddd70b0f829213a1d89512df` | `60bbb13fa7e82f1e0fbcbdb33420276866307834954eb37f5954dbd4b437baa8` |
| `material-lead` | `src/modules/pre-production/BidWorkspace.tsx` | `5a4db36d21a9ca6b89a6b686a91befcf214be6c4` | `bcf614293603004d6e83fbfc782bbdc766cf46f5` | `80483da0f04efda329d35f1b24ae82ceecf47e89a7823f11b6e62466e2c3aadb` |
| `message-attachments` | `src/modules/my-work/InboxDialog.tsx` | `1e2fe3d86211d6819f0b38170e305ee4142764bf` | `48930cbf14eaa994a7b794c54cb618f02bcf7d26` | `a6855e912e9f78b26d9305924519b1c0cf53f27dd4459f7694d551a0bd454282` |
| `message-reply` | `src/modules/my-work/InboxDialog.tsx` | `1e2fe3d86211d6819f0b38170e305ee4142764bf` | `48930cbf14eaa994a7b794c54cb618f02bcf7d26` | `065244fc9a7c4116d49cc1b1d89b058d01632ebc41fbfff3cb2c31433eae01c7` |
| `production-create-job` | `src/modules/production/jobs.ts` | `9db7ef3fa0aced661100bf292fccb8462a6b4113` | `0622319deb9f21e486a25511f6d98378f49987f0` | `5f1f6f2f5539a17bacd8d2c488ac6c9a87ee4517d9957e85d015d3d1e53ac334` |
| `production-files` | `src/modules/production/jobs.ts` | `9db7ef3fa0aced661100bf292fccb8462a6b4113` | `0622319deb9f21e486a25511f6d98378f49987f0` | `970d1eaf2c7aff7405a5c5b1f8a480cd5a7211aab878ba31adb72f59e2db4a9b` |
| `production-rework-create` | `src/modules/production/rework.ts` | `fb52a37c850a83d1a726697b0a38f397cf45e7b9` | `03bb7afec7d28e45d515540d265d5c42efa49fef` | `51f7f06429e436454c467fc3ac4e5f8f7185ec8c592a0042ea544aa7ad6808a8` |
| `production-rework-status` | `src/modules/production/jobs.ts` | `9db7ef3fa0aced661100bf292fccb8462a6b4113` | `0622319deb9f21e486a25511f6d98378f49987f0` | `1241dd4b127390ccffd8e3a27da8fc9915eef99bdcbcf9ad3ce3a6d60e4d1b08` |
| `share-job` | `src/modules/my-work/InboxDialog.tsx` | `1e2fe3d86211d6819f0b38170e305ee4142764bf` | `48930cbf14eaa994a7b794c54cb618f02bcf7d26` | `fc4df7a747c85087a62ad91cf7b8e7988ed857a445366406ea9704549dde436b` |
| `workflow-intake-activity` | `src/modules/pre-production/BidWorkspace.tsx` | `5a4db36d21a9ca6b89a6b686a91befcf214be6c4` | `bcf614293603004d6e83fbfc782bbdc766cf46f5` | `5c97e8780799027ed513bcbd06d9563f08b29c6aec77734345cfde7db7a978ae` |
| `workflow-intake-bid` | `src/app/client-layout-shell.tsx` | `08e52e6de00c69e6607feb25c934a421bbb45974` | `b6c799e95b190432f9866a0cd868873fb8afc19e` | `8c83d76ba135c143b4afe613e9c7aa72f10997692cb350a9571e20fbef2dc5f7` |
| `workflow-intake-bid` | `src/modules/pre-production/BidWorkspace.tsx` | `5a4db36d21a9ca6b89a6b686a91befcf214be6c4` | `bcf614293603004d6e83fbfc782bbdc766cf46f5` | `8c83d76ba135c143b4afe613e9c7aa72f10997692cb350a9571e20fbef2dc5f7` |
| `workflow-job-archive` | `src/modules/production/components/MonthlySnapshot.tsx` | `7e63b670be0fd694060e7b2d9a3ca87f8003d422` | `dcd2631990dfc1b5093c2cba73411d45e67b9746` | `2da50786e6d7bb5e2f085ab58e864b6f0270a88351c45909306559353e6c7af2` |
| `workflow-job-archive` | `src/modules/production/jobs.ts` | `9db7ef3fa0aced661100bf292fccb8462a6b4113` | `0622319deb9f21e486a25511f6d98378f49987f0` | `2da50786e6d7bb5e2f085ab58e864b6f0270a88351c45909306559353e6c7af2` |
| `workflow-message-drafts` | `src/modules/my-work/InboxDialog.tsx` | `1e2fe3d86211d6819f0b38170e305ee4142764bf` | `48930cbf14eaa994a7b794c54cb618f02bcf7d26` | `2dfa7d12fe043f2e664cfb790afe5e42f079aece85a86c3d9e1649367db51cae` |
| `workflow-message-edit` | `src/modules/my-work/InboxDialog.tsx` | `1e2fe3d86211d6819f0b38170e305ee4142764bf` | `48930cbf14eaa994a7b794c54cb618f02bcf7d26` | `7dcffd764fbb864982286711333092b30d6f73fccb0c195797a8bc1a60791628` |
| `workflow-monthly-snapshot` | `src/modules/production/components/MonthlySnapshot.tsx` | `7e63b670be0fd694060e7b2d9a3ca87f8003d422` | `dcd2631990dfc1b5093c2cba73411d45e67b9746` | `6a55318c26ae3d63aa2110333afc0a71346fe0a53c761a071c6c70765c7f1fef` |

Additional source dependencies, checked at the same exact bytes in the receipt/source tree and every nominated future candidate:

| Path | Blob |
|---|---|
| `src/modules/inventory/pending-receival-contract.ts` | `51fd2c3668dda59facb07d00612ce09eb24c9b27` |
| `src/modules/manpower/group-presentation.ts` | `52b23bba2a4a31d71f2c29318d3dfa6f3fd41da5` |
| `src/modules/manpower/progressive-history.ts` | `b0a4e31f9221aa9ffe6e387b3ecddfbd1d92061d` |
| `supabase/functions/_shared/labor-hours.mjs` | `594074c854e1e5055d282d5df2a945de294a059b` |
| `supabase/functions/_shared/production-job-facts.mjs` | `35bd389baa4795d2ed030a8938808d40f7597742` |

The 14 dependency-only records were reviewed for unchanged claims, permissions and effects: `knowledge-blend`, `production-schedule`, `proposal-create`, `proposal-issue-revise`, `sample-bid`, `sample-save`, `sample-work-order`, `workflow-intake-convert`, `workflow-manpower-history`, `workflow-material-usage`, `workflow-po-allocations`, `workflow-po-draft`, `workflow-po-issue`, `workflow-po-receivals`.

## Accepted infrastructure review — October 29, 2026

Chris accepts `b11b7574b72dd7ae3186477df075dbca267dc8f7`'s structured knowledge implementation and focused retrieval improvements, and authorizes the evidence-supported maintenance classification resolution described above. This is not push, deployment or new operational authority.

Business meaning, permission policy, lifecycle and effects are unchanged. The exact paths below are internal extraction/retrieval maintenance, static registry projection, a narrowly injected local-review callback or byte-identical already-released infrastructure. Existing actual caller-authenticated tools, full permission conjunctions and employee-safe projections remain authoritative. The generator's new review handling records exact evidence and retains genuine semantic holds; it does not approve uncertain changes.

| Path | Exact reviewed blob | Decision |
|---|---|---|
| `scripts/generate-tenbot-knowledge.mjs` | `b3f76af6014524a9fa7abdc351e15058ee13e39f` | Accepted knowledge/generator maintenance; no operational or permission-policy expansion. |
| `scripts/tenbot-knowledge/architecture.mjs` | `f87090d98ff61914fb99844513246f37b2865b97` | Accepted knowledge/generator maintenance; no operational or permission-policy expansion. |
| `scripts/tenbot-knowledge/manifest.mjs` | `f9695bb04977b26f72f8da35f291a9dffc258ba9` | Accepted knowledge/generator maintenance; no operational or permission-policy expansion. |
| `scripts/tenbot-knowledge/release-sync.mjs` | `14d42bc8a657c107af68200c8ab7f272b7ac2230` | Accepted knowledge/generator maintenance; no operational or permission-policy expansion. |
| `supabase/functions/_shared/tenbot-core.ts` | `eaa9f9c108c10a72801602c1c87ca19bc84d5973` | Byte-identical to the latest executed ae50e0fc source; historical drift from the old bc628bd baseline. |
| `supabase/functions/_shared/tenbot-job-routing.ts` | `4bfd5f350e783118bb1d3bc043c242e920d74464` | Byte-identical to the latest executed ae50e0fc source; historical drift from the old bc628bd baseline. |
| `supabase/functions/_shared/tenbot-job-session.ts` | `7a3b25454b1d0790cbd05f234e02c7e540920de4` | Byte-identical to the latest executed ae50e0fc source; historical drift from the old bc628bd baseline. |
| `supabase/functions/_shared/tenbot-job-tools.ts` | `d7ae05f56ff991dc0c267a5d2f96a7d8bd96b1d6` | Byte-identical to the latest executed ae50e0fc source; historical drift from the old bc628bd baseline. |
| `supabase/functions/_shared/tenbot-models.ts` | `286c1971e1c7f527c0cdf398c55eff628aeee8f9` | Byte-identical to the latest executed ae50e0fc source; historical drift from the old bc628bd baseline. |
| `supabase/functions/_shared/tenbot-privacy.ts` | `bdd4ec1ddeb90994f5ad6a24cf09c1713c519066` | Byte-identical to the latest executed ae50e0fc source; historical drift from the old bc628bd baseline. |
| `supabase/functions/_shared/tenbot-workflow-supplement.ts` | `66c8b1f7186923b9ccf5a973b5ee03a2bd323f60` | Byte-identical to the latest executed ae50e0fc source; historical drift from the old bc628bd baseline. |
| `supabase/functions/_shared/tenbot-agent-knowledge.ts` | `d0baddb6724515063567da43370437c886e60a84` | Accepted knowledge/generator maintenance; no operational or permission-policy expansion. |
| `supabase/functions/_shared/tenbot-knowledge.ts` | `16a59ae220abcab962fc971597aa864b46b2ae70` | Accepted knowledge/generator maintenance; no operational or permission-policy expansion. |
| `supabase/functions/_shared/tenbot-handler.ts` | `c9e0d8c80ad936c7e62b046fba991c8bb3580eac` | Explicitly injected local-review callback; hosted default construction unchanged. |

## Historical release evidence and remaining holds — October 29, 2026

The four October 27 migrations are substantive historical schema/permission/accounting behavior, never infrastructure-only. The original committed [executed October 27 release](2026-10-27-tenbot-candidate.md#executed-tenbot-release--october-27-2026), at receipt revision `dfdef9d172c5e158a27b815b76f5294afd6c91ad`, affirmatively records all four committed atomically and released to TenDev then TenOps at runtime `6cb6cf7962ccbaa2f403e9dca3a8b2582af0599c`. Their source blobs still match that runtime and latest released source. The [October 28 executed postcheck](2026-10-28-tenbot-qa-reconciliation.md#executed-approved-release--october-28-2026) confirms unchanged hosted checksums and explicitly prohibits repeating them. This uses retained executed evidence, not a fresh hosted attestation. Early local-candidate comments do not override later dated receipts.

| Already-executed migration | Unchanged blob |
|---|---|
| `supabase/migrations/20261027120000_tenbot_feedback_usage.sql` | `f9998e6752f5d028aa2f46fa33f93a79464b0e05` |
| `supabase/migrations/20261027130000_tenbot_shared_usage_pool.sql` | `d890020047817ec0a83524a32487f7ccf1f49196` |
| `supabase/migrations/20261027140000_tenbot_measured_free_pool.sql` | `a62a2c1c2b43b3a3319a5c24b6df88c633134a26` |
| `supabase/migrations/20261027150000_tenbot_private_conversations.sql` | `bcfd783848f2f29db99e4ee0399c457f3e5383d7` |

The remaining twelve paths are explicitly classified as substantive local candidate behavior and are **not acknowledged or accepted by this knowledge review**. Nine introduce assistant orchestration/discovery, dialogue publication/persistence, explicit invoice input preparation, paid-provider accounting/dispatch or hosted routing/allowlist behavior. The three October 29 migrations introduce approval/execution, paid-budget and durable-history contracts. Existing isolated database evidence belongs to the implementation thread; it is not shared Production application or activation evidence. The invoice write migration remains excluded from the read-only release. An eventual selective release must review its exact new source boundary; dev must not be promoted wholesale.

| Remaining held path | Candidate blob |
|---|---|
| `supabase/functions/_shared/tenbot-agent-history-store.ts` | `a0888e92a05ec479571b7c93ee5486429685cbd4` |
| `supabase/functions/_shared/tenbot-agent-operations.ts` | `961b4390f0ffae119450098392e39e31bcd12d95` |
| `supabase/functions/_shared/tenbot-agent-session.ts` | `c521fad047d387b226568f33a9213e9f4e564d3a` |
| `supabase/functions/_shared/tenbot-agent.ts` | `5ce93bcce182097707c3ec60b5cabd44c5f2a62d` |
| `supabase/functions/_shared/tenbot-hosted.ts` | `4a06c93430e86f3bfda7a02f50111c17a7800c49` |
| `supabase/functions/_shared/tenbot-invoice.ts` | `856446f68e057f068dc04ffb2cb7f3fd3912b9ed` |
| `supabase/functions/_shared/tenbot-openai-metering.ts` | `4f538fe0b23c7fdbb7a0edc6f8fa14429b18090e` |
| `supabase/functions/_shared/tenbot-openai.ts` | `b3fc2b383be2115d0214fee33cb2bd2ddc74fd34` |
| `supabase/functions/tenbot/index.ts` | `4328303531ec6423633ceed9a49806ea5d32d477` |
| `supabase/migrations/20261029210000_invoice_pending_receival_approval.sql` | `b2ac2c70af9eb8711578f40e57039f3d606be3d9` |
| `supabase/migrations/20261029220000_tenbot_openai_metering.sql` | `da6395122e043bf1069109b815f4fda124e7e87d` |
| `supabase/migrations/20261029221000_tenbot_agent_history.sql` | `031415b57d7ddf2af760ab2760d401c86c94ff36` |

Of the original 31 unclassified paths, review supports 14 exact infrastructure classifications, four already-executed historical classifications and one exact deterministic generated artifact; twelve legitimate semantic/runtime/database paths remain held. No sensitive or unauthorized employee-facing content was found in the scoped projection review; raw source, physical mappings, private records and internal security evidence remain excluded. Hosted registry availability stays the existing five Job reads plus scope/knowledge discovery; explicit local invoice preparation is not a hosted capability or an operational write.

The knowledge content is source-reviewed for inclusion, subject to validation of this resolution. The complete dev candidate remains **review-required**, not release-cleared, because the twelve separate runtime/migration paths remain. No retrieval overhaul, paid inference, database call, hosted mutation, migration application, push or deployment. Supporting [source-review evidence](evidence/2026-10-29-tenbot-knowledge-source-review.json) records the 45-record/31-path dispositions. Validation results are appended below after the exact evidence/metadata is committed and checked.
