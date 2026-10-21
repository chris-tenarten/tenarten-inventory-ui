# Reused evidence and provenance

These files predate the audit. Summaries below are historical evidence, not fresh browser, database or release verification. Hashes identify the local inputs inspected. No operational records, credentials or environment files are included.

| Input | SHA-256 |
|---|---|
| `docs/project-memory/2026-10-14-database-retrieval-candidate.md` | `0295f39a116f3d5d11158e470cfc3f179053082bb3955c1d0e081e5b0fc7b02f` |
| `docs/project-memory/2026-09-24-manpower-anonymous-hardening.md` | `a386172a7ae4d38443305b7c711f0c32189f75ed550fa453cdcb597f54793858` |
| `docs/project-memory/2026-10-19-auth-tab-refocus-release.md` | `0eff8eb618527f86f79c95fc42c347513d40e18cd75c298cabae2fe78907f091` |
| `docs/project-memory/2026-10-19-samples-loading-loop-dual-release.md` | `61f0543b0013a36796efb88213b0438cde7434d41ea1c995f841de3e5e973296` |
| `docs/project-memory/evidence/2026-10-19-auth-tab-refocus-release.json` | `bad8027d0d6e751a5d067ea82db028a88bf813ba950b598326432f8b09b3dabc` |
| `docs/project-memory/evidence/2026-10-19-samples-loading-loop-dual-release.json` | `2823c98f9bb3a877b960baacd603a95485954fac028ec37bd311cee33ca38144` |

## October 14 retrieval fixture

Fixed synthetic dataset: 12,001 labor entries; 1,201 entries in selected 30-day period; 40 Jobs (20 nonarchived); 1,201 material reports. Actual loaders used a fixed 20 ms fetch delay; single samples exclude actual SQL, Auth, rendering and real transport.

| Path | Before requests / rows / JSON bytes / ms | After requests / rows / JSON bytes / ms |
|---|---|---|
| Selected-report prerequisite | 25 / 12,001 / 8,630,544 / 813 | 5 / 1,203 / 845,147 / 100 |
| Production labor/material | 26 / 13,001 / 1,577,151 / 652 | 6 / 2,402 / 295,452 / 97 |

The old material baseline was capped; the improved result includes complete matching materials. Total labor transfer across period plus complete editor history was 9,475,691 bytes versus 8,630,544 before. This is a readiness optimization already integrated by commit 1d34f18, not a new proposed patch.

Historical empty-Inbox trace: two conversation-summary and two recipient RPCs; no selected thread page. Historical privileged HEAD samples bypassed user RLS; EXPLAIN failed 406/PGRST107. No production speed or query-plan conclusion follows.

## October 19 release receipt

SHA da21615ad6f06727e4f18a75c65331a7266d2404. Separate TenDev/TenOps exports. Receipt records 32 assets per target checked and simulated continuing SIGNED_IN adding one profile request without restoration replay; auth/data requests intercepted. Physical tab-switch acceptance is reported in release notes. None of those scenarios was rerun by this audit. Fresh root HTML hashes are recorded separately in repository-facts.json.

## September 24 security evidence

Historical hosted discovery reported anonymous Manpower reads; disposable replay validated narrow hardening and authenticated-role equivalence. Migrations now exist in Git. Current hosted effective privileges were not inspected during this audit; neither continued exposure nor closure is asserted.
