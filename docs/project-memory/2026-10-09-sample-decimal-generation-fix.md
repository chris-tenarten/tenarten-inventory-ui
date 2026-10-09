# Sample Work Order decimal-input generation defect

Local correction based on released `d473ca88a5f71eda1029d9a6ab43930b242d48cf`. Not released; no hosted writes.

## Confirmed cause

Narrow read-only inspection of T26-901-A found a valid Key Resin 5:1 captured profile and matching top-level `resinParts=5`, `hardenerParts=1`. Thickness was stored as `.75`. The SQL `sample_nonnegative_numeric` helper accepted `0.75` but returned NULL for `.75`, although the UI accepts both. Save persisted the authored thickness but computed NULL production volume, working fraction, chip target and aggregate quantities. Issuance correctly refused incomplete shop preparation quantities before creating a document. Error translation used `includes('ratio')`, which also matches `preparation`, incorrectly blaming the ratio.

Thickness magnitude is not the defect: spelling `.75` versus `0.75` is. Other Sample numeric inputs using the same helper share this spelling inconsistency. Profile selection, valid ratio normalization, Batch authority and the PDF renderer do not require correction. Generation first validates locally, saves, then calls `issue_sample_form`; the failure precedes the Edge PDF request.

## Narrow boundary

- Forward-only local migration `20261009120000_sample_decimal_input_parsing.sql`: accept ordinary nonnegative decimal spellings (leading decimal, trailing decimal and surrounding whitespace); preserve NULL for blank, negative, malformed and nonfinite values. No data updates, ACL change, profile backfill or historical recapture.
- Error translator: explicit incomplete-preparation guidance; match the word `ratio`, not substrings in preparation/generation/operation. Keep actual ratio validation.
- Focused database/PDF regression verifier.

Migration SHA-256: `84fc36028d33e9a5847e7c2264d837e219225bcdf04785fcdf96618c94e5dc94`.

## Verification

Focused Tier 3/data-contract checks: disposable SQL reproduction before patch; repeated failed issuance creates zero documents; Key Resin and Sherwin save/reopen/issue at `0.375`, `.75`, `0.75`; invalid captured binder relationship rejected; previous issued record unchanged; retry rendering same capture does not add documents; both representative PDFs rendered and visually inspected. Existing historical ratio-normalization verifier covers fixed-scale and equivalent supported 4:1/5:1 values, manual provenance and legacy PDF display. Actual localhost UI selected both profiles, changed thickness to `.75`, saved, reloaded, and generated Sample Work Orders. TypeScript, targeted ESLint, diff check and optimized webpack build pass.

Representative Key .75: 128 oz chips, 35.555556 oz Filler, 28.444444/5.688889 fl oz binder. Sherwin .75: 128 oz chips, 42.666667 oz Filler, 32/8 fl oz binder. Existing calculations and renderer semantics retained.

## Production recovery and review

No Production repair performed. The migration itself will not recalculate existing saved rows. After eventual approved release/application, explicit Save Changes (also performed by Generate) recomputes the current draft through existing normalization. Existing issued captures remain unchanged. No direct record patch is needed for the observed valid profile/ratio.

Manual review uses the actual app at localhost:3013 with disposable PostgreSQL. Port 3000 remains owned by the preserved Material Readiness worktree; 3011 remains the earlier geometry review. Local fixture data is not included in the candidate.
