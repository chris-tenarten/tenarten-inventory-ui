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
