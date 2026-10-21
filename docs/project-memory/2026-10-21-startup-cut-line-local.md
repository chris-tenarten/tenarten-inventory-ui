# Startup cut-line local correction — October 21, 2026

Accepted correction on `fix/startup-cut-line`, based on canonical `73fe7a94cfeefa355aa8e912a9bcb524436b2442`. No push/deployment/hosted-data changes. Original review worktrees preserved.

User reported missing black trail behind the cutting spark. Renderer/history inspection and a local browser canvas probe confirmed an early horizontal-cut disappearance: crown cut ends at renderer868ms, is removed at1368ms (end+500), but steel separation begins at1630ms. The accepted0.6x mapping exposes approximately436.667ms of missing horizontal trail before separation. The renderer itself was unchanged by the slowdown; the same clock maps both sparks and cuts. This establishes the early-disappearance issue, not complete absence during every active frame.

Smallest correction removes only the per-path end+500 expiry. Completed black cuts now remain through the existing1630ms split boundary. Hot head, molten deposits, particles, mask, line width/color, plate movement and all clocks are unchanged. The global split cutoff remains in place. Accepted0.6x pre-split rate, original separation speed,888ms hold and850ms fade are untouched. Application auth/session/refocus, mobile navigation, Web Push, Contacts and all other code are unchanged.

Tier1 visual correction / Testing Level1. Local Production webpack build including TypeScript, targeted ESLint, diff check passed. Browser canvas pixels at(207,230) were transparent before and black RGBA(14,10,8,247) after at1369/1550/1630ms. Active800ms screenshot is byte-identical before/after. Corrected screenshot inspected, showing completed horizontal and vertical cuts. One full actual-export browser playback passed; hold899ms measured, no client exceptions or unexpected external traffic. Existing intercepted/disposable local fixtures reused, no hosted account or data mutation. The full-playback helper initially missed startup through the separate review proxy; it passed with its standard static-export fixture setup on internal port3376. No broad suites or new framework.

Review http://localhost:3000/__review/ uses the existing disposable local-only server, now serving corrected export. Replaced only confirmed obsolete preceding review process PID41691. Raw probes and screenshots under root`.tmp-cut-line/`; playback video under`.tmp-cut-line/evidence-tenops/`. Product accepted this correction and authorized commit/release after this local validation. Deployment state is recorded in the separate release receipt.

[Evidence](evidence/2026-10-21-startup-cut-line-local.json).
