# Sample geometry and optional pour planning — local candidate

Authorized October 9, 2026. Base: `8255a1e7cb10d7ab9cc86a9024e4a1f38aed07d4`. Local implementation only; not release evidence.

## Product contract implemented

Finished dimensions/count remain independent from Working Pour; thickness remains shared. Finished area/CFT, Working Pour area/CFT and reference Batch volume/fraction update live. Reference volume is a calculation from captured chip weight/loading, not a measured finished-terrazzo yield claim. Existing chip, exact dry and practical dry quantities remain visible.

Working Pour units convert physical dimensions only on an explicit unit change. No load-time conversion or historical backfill occurs. Conversion keeps 15 significant digits in UI state; existing persistence precision is unchanged.

Optional suggestions are bounded uniform rectangular grids (up to 10,000 identical pieces), compact/row/column, with uniform rotation candidates and duplicate footprints removed. Compact prioritizes the shortest longest side, then area. Incomplete grids disclose unused positions. Edge allowance applies at each outer edge; separation applies between rows/columns. Both default to zero and remain temporary UI state. Apply changes only unsaved pour width/length in the selected units, retaining the existing shared thickness. No nesting, physical-fit or manufacturing allowance authority is claimed.

A nonblocking warning compares pour and finished volume. Sufficient volume never claims physical fit. Manual shop quantities now survive geometry/unit edits and Apply; the existing parent handler previously cleared them. Profile-change reset behavior remains unchanged. Captured at-volume instructions remain in the profile; existing exact fallback is retained and a review notice shows their original quantities/context.

Aggregate percentage inputs retain number semantics, min/max/step, string editing, precision and validation. Native spinner appearance is suppressed, decimal keyboard requested, and wheel interaction blurs the field to prevent native stepping. No redistribution occurs.

## Focused validation (Tier 2)

- `scripts/verify-sample-pour-planning.mts`: passed baseline, finished independence, thickness/pour changes, unit round trips, compact/row/column layouts, allowances, Apply, invalid layout inputs, manual preservation and nonmutating legacy reads.
- Baseline: finished/pour `0.03125 CFT`; reference `1.40625 CFT`; `1/45 Batch`; chips `64 oz`; exact dry `81.777778 oz`; shop dry `82 oz`.
- `scripts/verify-sample-pour-browser.mjs`: passed actual exported TenOps UI at disposable localhost. Percentage select-all/Backspace/Delete/replacement, temporary blank, immediate quantity update, wheel behavior and no redistribution; geometry edits, warning, unit conversion, suggestions/allowances/Apply; manual Filler `22 oz` preserved through geometry/unit/Apply; no implicit saves; saved fixture reopens unchanged (including stored `12.0000`); desktop/mobile no page overflow. Desktop/mobile screenshots visually inspected.
- TypeScript, targeted ESLint, webpack Production build and diff whitespace check passed. Test-only typing assertions were corrected before the successful final build. Browser event targeting was corrected for wheel/keyboard ordering; no additional application change was required.
- Existing formulation engine, shared PDF renderers, schema and historical records unchanged. No broad PDF, Production Blend, authorization or lifecycle suites rerun. No hosted checks. Save-time dimensional precision and cross-browser wheel behavior beyond Chromium were not newly qualified.

## Local review

Actual application: `http://localhost:3011/samples`.
Representative captured MTT: `http://localhost:3011/samples?open=0e1adb4f-9402-44ee-aff9-e82ab3b3b367`.
Disposable local PostgreSQL, separate from hosted data. Temporary review adapter/assets are ignored local artifacts, not release content. The adapter uses the current account-access read name; no application auth changes.

Port 3000 remains owned by the preserved Material Readiness worktree `/private/tmp/tenops-connected-navigation`, candidate `bae6d7bc95ba37782b25ae15ef581b84e4b3a915`. This is an explicit alternate-port exception, not a replacement of the manual-review convention.

No manufacturing assumption blocks these optional geometric suggestions. Actual margins, cutting feasibility and measured Batch yield still require shop authority; no values were invented for them.
