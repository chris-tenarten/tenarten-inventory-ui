# TenOps Project Memory

Project Memory preserves intent, current reality, business workflows and structure. Reuse these existing owners; this index is not another Product Canon or changelog.

## Start here

1. [AGENTS.md](../AGENTS.md): authority, approval and preservation boundaries.
2. [Project Manifest](project/PROJECT_MANIFEST.md): compact Product Canon, enduring direction and architecture.
3. [Current State](project-memory/CURRENT_STATE.md): dated canonical/deployed boundaries, active work, limitations and receipt links. Verify relevant facts before acting.
4. [Engineering Execution Standard](project/ENGINEERING_EXECUTION_STANDARD.md): compact advisory/implementation handoff, prompt → iterate → approve → release, proportionate checks and workspace closure.
5. Read only the relevant [workflow](workflows/), [schema](schemas/) and [architecture](architecture/) references, plus scoped decisions or release receipts linked from Current State.

[Blueprint](project-memory/BLUEPRINT.md) retains product rationale; [Learnings](project-memory/LEARNINGS.md) retains observations. Historical engineering suggestions there yield to AGENTS and the execution standard. [Open Questions](project-memory/OPEN_QUESTIONS.md) records unresolved decisions and dated exceptions; it is not a current release ledger or automatic authorization.

## Authority and continuity

Follow the separate Product-intent and implementation-evidence hierarchies in AGENTS. Chris's current decision and the canonical **TenOps — Advisory & Implementation** context govern intent; actual Git/source and narrowly verified hosted state establish implementation reality. A checked-in migration does not prove application, and accepted code does not prove deployment.

Record only the relevant approved decision, date/reference, scope and acceptance criteria for a handoff. Link supporting records instead of copying conversations or entire evidence bundles. If the advisory conversation is unavailable, identify that limit explicitly.

Update the manifest for enduring direction, Current State for material status changes, and the focused existing record for detailed evidence. Preserve original dates and supersession links. New documentation commits may legitimately be ahead of a deployed runtime; report both SHAs.

TenBot's local [knowledge/inference review](project-memory/2026-10-27-tenbot-candidate.md#knowledge-and-inference-refinement--october-27-2026) describes the release-pinned source export, shared free-only budget and actual model comparison. To update its server-only knowledge after a verified release, follow that record, then run `npm run tenbot:knowledge` and `npm run verify:tenbot-knowledge`.
