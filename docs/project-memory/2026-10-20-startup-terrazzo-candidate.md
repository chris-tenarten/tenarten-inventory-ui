# Startup steel-to-terrazzo local candidate — 2026-10-20

Local candidate only, pending Chris / Product / Architecture visual acceptance.
Baseline: `01e5e839fdba0256023077cf1d85c2d4dd15212c` (verified dev HEAD).
Persistent worktree: `.worktrees/startup-terrazzo`.
Branch: `feature/startup-terrazzo`. No push, merge, deployment or hosted mutation.
Tier 2 / Testing Level 2: bounded presentation and interaction behavior; no auth,
schema, persistence, issuance, calculation or privacy contract changes.

## Source and asset assessment

`WelcomeHero.tsx` owns the existing 4,600 ms smoothstep gold-to-steel diagonal
reveal, area-based decorative percentage, 900 ms completed composition, per-user
sessionStorage launch claim, explicit login handoff, manual replay, and separate
`tenops:critical-app-ready` signal. The percentage describes animation coverage,
not database initialization. Original gold/steel files and opening geometry are
unchanged. ONLINE now additionally requires application readiness.

Reusable iTenify material exists in the read-only archive worktree
`/Users/chrisngo/source/worktrees/tenops/project-assets-archive-20261016/docs/design-previews/itenify-engine-v1/`:
`engine-motion.js`, `spark-paths.json`, and `assets/terrazzo-aligned.webp`.
This is a design integration reference, not an installed iTenify runtime. Its
controller dismisses on early readiness and has different skip/branding rules;
copying that controller would violate this request. Reused its bounded canvas
renderer, exact precomputed cut/particle paths, and three-plate choreography.
The archive and iTenify research/application sources were not modified.

The existing steel bitmap includes the Tenarten wordmark. The original crest
crop is exactly `(148,42,728,806)` in its `1024×1048` canvas. Pixel comparison
confirmed the archived crest and existing crop have identical alpha. The new
terrazzo WebP places the archived material at that exact offset with no resizing.
Its crest alpha also equals the original crop byte-for-byte. Embedded lettering
fades separately; moving plates never contain lettering. This avoids the size
jump and moving wordmark found and corrected during visual review.

## Implemented behavior and boundary

After the original opening/hold and actual app readiness, secondary elements
fade for 650 ms without collapsing their grid space. Only the crest remains;
it retains its established position, dimensions and proportions. The iTenify
cutting/sparks lead into crown/left/right plate retraction, fully clear by 3.5 s.
A 1.85-second terrazzo hold follows, then the entire overlay fades for 850 ms.
The application stays mounted throughout; the entrance never initializes data
or auth. No shared shell source changes were necessary: only its existing
WelcomeHero overlay changes behavior.

A small bottom-centered native button fades in after isolation. Desktop says
“Press Space to skip”; coarse-pointer devices say “Tap to skip”. Space, button
Enter/Space, and touch dismiss only the remaining decoration. There is no early
button or Escape close pathway, including explicit replay. Space ignores editable
controls and modified/repeated keypresses. Underlying sibling regions are inert
while covered; Tab stays within the skip target after it becomes available.
Prior inert/overflow/focus state is restored on dismissal. The overlay sits above
the app header and its whole surface fades, avoiding an opaque-background cut.

Reduced motion uses a static/minimal opening (450 ms), no sparks/plate movement,
no decorative hold, and a 180 ms entrance once ready. Image failures bypass the
new decoration while retaining readiness. Production's rendered error readiness
signal releases the overlay immediately when an existing main-region alert is
present, exposing the actual recovery UI instead of adding branding delay.

The existing sessionStorage launch claim and login/replay events remain intact.
No focus, visibility, reconnect, inactivity or auth-event replay listener was
introduced. The accepted continuing-session auth implementation is untouched.
Refresh/navigation keep the marker; a separate new tab is eligible. Tests retain
and compare the existing application-shell DOM node through skip and continuing
SIGNED_IN/TOKEN_REFRESHED events.

## Performance

No dependencies or lockfile changes. New WebP: 230,618 bytes (225.2 KiB).
Renderer + component + cut-path source: 13,490 bytes unminified. Canvas work is
bounded to the first two seconds of the new transformation, with 54 precomputed
particles and DPR capped at 2; cleanup clears surfaces/listeners. The remaining
hold stops React elapsed-state updates, while the existing animation clock waits
for the scheduled fade. New assets do not gate or trigger application requests.

Measured TenOps layout chunk against the existing 01e5e83 review export:
73,980 → 83,275 bytes raw; gzip 19,893 → 23,524 (+3,631 bytes). This is a local
bundle comparison, not a hosted performance benchmark. Eligible unskipped launches
intentionally add 6.0 s decoration after the accepted opening/hold, then retain
the existing 850 ms entrance. Readiness can take longer independently.

## Validation and evidence

Both isolated production-mode webpack exports passed (TenOps false; TenDev true
through the existing `CF_PAGES_URL=https://tendev.pages.dev` branding resolver).
No `.env.local` copied and only synthetic localhost API settings used. These
artifacts are review fixtures and are not deployment artifacts. Default Turbopack
could not resolve the shared node_modules symlink outside its worktree root;
webpack is the repository's established isolated-build alternative.

TypeScript, targeted ESLint, `git diff --check`, and the existing developer-branding
structural verifier passed. `scripts/verify-startup-animation-browser.mjs` passed
eight scenario groups against each actual branded exported app:

- Full opening, readiness gate, secondary/embedded-wordmark fade, stationary crest,
  sparks/plates, original four-second hold, gradual entrance and retained shell node.
- Disabled early Space; desktop Space skip, editable-space guard, Tab focus;
  continuing SIGNED_IN/rotated TOKEN_REFRESHED, simulated focus/visibility/online,
  same-tab refresh/module navigation without replay, and separate-tab eligibility.
- 320×568 touch viewport, correctly positioned “Tap to skip”, touch dismissal.
- Core Job reads delayed 8.5 s: no skip/entrance even after art reaches 100%.
- Reduced motion without decorative hold; failed image fallback.
- Failed initialization exposes its real error; denied auth never starts the hero.

No page exceptions or nonlocal requests occurred. Evidence and videos are in
[evidence/startup-animation](evidence/startup-animation/). Scenario receipts are
`TenOps-results.json` and `TenDev-results.json`. The full desktop Chrome capture
was checked as a temporal contact sheet, including gold→steel, isolation,
sparks/retraction, hold and continuous entrance. Headless screencast initially
omitted image layers despite correct screenshots; those full-sequence videos were
replaced with installed-Chrome recordings (TenOps headed; TenDev headless Chrome,
which preserves the image layers). Extra headed passes address that specific
evidence deficiency. The local fixture's empty unseen-activity RPC was corrected
to provide its exact count, removing a spurious startup-adjacent warning.

EM self-review of the final diff/evidence confirmed the exact base, narrow overlay
boundary, no auth/storage-key changes, no business-module edits, cleanup on asset
failure/unmount/resize, no early replay close path, preserved opening constants,
brand configuration reuse, bounded particles, and no application remount. No
unrelated historical verifiers or business mutation/document suites were run.

## Local Product review

- TenOps: <http://localhost:3355/__review/>
- TenDev: <http://localhost:3356/__review/>

Select “Play a fresh launch” to clear only this disposable tab's animation claim
and enter the actual application. Wait for the unskipped sequence; launch again
and press Space only when the instruction appears. Touch emulation shows the tap
instruction. Enable the system/browser reduced-motion preference and launch again
for the short alternative. After completion switch tabs and return, navigate, or
refresh: the introduction should stay dismissed. “Continue existing tab” keeps
the claim. Both origins serve synthetic local auth/data and forbid outbound API
connections; they are separate from any real account or hosted data.

Port exception: 3000 belongs to the active Manpower progressive-groups worktree
(PID 45277 when inspected). It was preserved. Ports 3355/3356 avoid disrupting that
workstream and provide isolated branding; no change to the existing server.

Restart from this worktree using:
`STARTUP_REVIEW_ROOT=out-tenops node scripts/start-startup-animation-review.mjs`
and
`STARTUP_REVIEW_PORT=3356 node scripts/start-startup-animation-review.mjs`.
TenOps export is `out-tenops`; TenDev export is `out` (local review assets only).
The source verifier uses installed Chrome and supports `STARTUP_REVIEW_ORIGIN` / `STARTUP_REVIEW_BRAND`,
`STARTUP_REVIEW_HEADED=true`, and focused `STARTUP_CHECK=full|visual|skip` runs.

Limitations: physical OS tab suspension, installed Home Screen sessions and native
mobile rendering still need manual acceptance. Automated focus/visibility and auth
events are simulations, not proof of physical OS recovery. The TenDev Chrome
recording has a gray strip at its bottom edge; screenshots and the live review
show the complete progress/skip region. Crest motion itself is captured. Existing launch-claim
semantics were preserved; no new inactivity or duplicated-tab session system was
added. Artwork is registered raster material, not a new authoritative vector or
physical terrazzo simulation. The fixture supports startup and selected existing
local workflows, not full business creation/PDF acceptance; those flows were not
changed or claimed as verified here. No hosted verification was performed.

Stop at Product / Architecture review. No release preparation is authorized.

## Product timing refinement

Chris accepted the visual candidate and requested a 40% shorter final hold.
Changed only `TERRAZZO_HOLD_MS` from 4,000 to 2,400 ms; original opening,
transformation, skip/readiness/session gates and 850 ms fade are unchanged.
Tier 1 / Testing Level 1 for this presentation-only delta. The full-sequence
verifier checked that fading began about 2.4 s after full reveal, with a
2.2–2.85 s tolerance using browser phase-change timestamps. Original eight-group receipts retain the earlier
four-second timing; new `*-full-results.json` receipts and full videos describe
the revised candidate. Both branded builds and focused full-sequence browser
checks passed, as did TypeScript, targeted ESLint and diff checks.

Chris then requested a final hold of 1.85 seconds. The current constant is
1,850 ms and the focused verifier checks 1.7–2.1 s using phase timestamps,
with a still-holding check at 1.2 s. This remains Tier 1 / Testing Level 1.
Current full-sequence recordings/receipts supersede the 2.4-second versions.
Both refreshed branded builds (including TypeScript) and full-sequence browser
checks passed. Targeted ESLint and diff checks passed. No other runtime changes.
