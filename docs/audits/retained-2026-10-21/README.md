# Retained October 19–20 advisory research

These are byte-preserved historical audit packages retained during the October 21 Source Control hygiene pass. They describe their recorded source revisions, limitations and Product-review status; they are not new application changes or current acceptance evidence.

- [Comprehensive audit](2026-10-19-comprehensive/REPORT.md)
- [Mobile workflow audit](2026-10-20-mobile/REPORT.md)
- [Timeline feasibility](2026-10-20-mobile-timeline/REPORT.md) and [visual-semantics refinement](2026-10-20-mobile-timeline/refinement/REPORT.md)
- [Original Timeline package](2026-10-20-mobile-timeline-handoff.zip) and [refinement package](2026-10-20-mobile-timeline-refinement-handoff.zip)

The archive contains 231 original files. Package-relative links, checksums, generated previews, screenshots and initial revisions remain intact. The original Timeline ZIP contains eleven historical versions that differ from the later loose package; the refinement ZIP has explicit consumers, so both are retained.

The nine later canonical prototype files remain unchanged at [the existing prototype](../2026-10-20-mobile-timeline/README.md). Archive paths isolate the earlier research versions rather than replacing that prototype or any application source.

## Reproduction boundaries

Static preview servers locate their bundled `dist/` relative to the archived script. Historical rebuild/verification scripts also contain original repository-relative imports and pinned revisions. To reproduce those runs, restore the relevant package at its original `docs/audits/<dated-directory>` path in an isolated checkout at the recorded revision. Do not treat an archived localhost link or passed receipt as a currently running server or fresh validation. No historical scripts were rewritten or run during retention.

The comprehensive and mobile handoff ZIP wrappers were excluded after all 14 and 65 member files respectively matched the retained loose packages and no consuming links were found. Their content can be repackaged from this directory, for example:

```text
python3 -m zipfile -c 2026-10-19-comprehensive-handoff.zip 2026-10-19-comprehensive
python3 -m zipfile -c 2026-10-20-mobile-handoff.zip 2026-10-20-mobile
```

This reproduces archive contents; container timestamps/compression are not asserted to reproduce identical ZIP bytes. Keep the retained Timeline ZIPs and package manifests unchanged.

## Source Control retention receipt

Baseline: `4f0228f`; local branch `docs/source-control-hygiene-20261021`. No canonical promotion or push is included. [The disposition manifest](MANIFEST.json) records all 267 original paths, hashes, retained destinations and the two ZIP member comparisons.

| Original disposition | Files |
| --- | ---: |
| Exact originals committed: 231 archived research files plus 32 release/evidence/history files | 263 |
| Exact private investigation original preserved; anonymized findings committed | 1 |
| Exact architecture duplicate already canonical; reused existing Git copy | 1 |
| Unreferenced comprehensive/mobile ZIP wrappers removed after all 79 members matched retained Git files | 2 |
| Total original files resolved | 267 |

Release/evidence/history retention commit: `ff651578a25f7f4fd1d2b327e2a011faf6a7c5bb`. Research retention commit: `527c5b53e4016620f7bbf24a816d6fc742aae22a`. The release group includes fourteen completed report/JSON pairs, the stopped mobile-navigation pair, stopped mobile preflight, housekeeping history and the anonymized attachment-investigation summary. [Current State](../../project-memory/CURRENT_STATE.md#receipt-retention-completed-october-21) indexes the retained records.

All 263 exact originals were checked against committed Git blobs before removing their old untracked copies. The duplicate architecture file also matched canonical Git. The attachment investigation's original identifiers and Storage/download paths remain only in the verified private archive under `.git/private-archives/2026-10-21-source-control-hygiene/`; the portable summary retains aggregate findings and provenance. That private original is unavailable in a fresh clone.

Only the two reproducible ZIP containers were discarded (2,691,378 bytes). Referenced generated previews/screenshots and distinct Timeline ZIP history were retained. Historical TSV trailing tabs and original claims were preserved without normalization. No blanket ignore or blanket clean was used. Root application source and every other worktree were preserved; the pre-existing nested `.worktrees/` Git entries remain separate from the resolved documentation files. VS Code showed zero pending changes after refresh; this receipt is completed in the same local hygiene branch.
