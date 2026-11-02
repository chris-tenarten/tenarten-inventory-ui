# Qwen agent evaluation transport — November 1, 2026

**Implemented locally; live comparison blocked before inference.** Chris accepts `16ccb2fdac836f8a9b1cb57177e0af775d0e0840` experimentally and authorizes only the narrow evaluation-transport correction and small metered evaluation. Separate Advisory context is unavailable; the current explicit Product instruction governs. This receipt records the correction to the previous blocked evaluation; its historical findings remain unchanged.

## Implemented scope

The local pilot previously removed `input.agent`, while its Worker rejected that envelope. It could not carry tool discovery, model-selected plans or continuation evidence. The corrected adapter preserves the validated envelope and original-input usage measurement. The Worker admits only bounded registered read/discovery schemas, strict final output, 32 history items, 160 KB total input and 640 output tokens. Mixed modes, unknown fields/capabilities and malformed schemas remain rejected. Legacy guide/operational requests retain their 16 KB contract and unchanged authenticated health response. Actual execution/schema checks remain in the existing server-owned runtime.

`openPilotProvider()` uses the installed Wrangler 4.151.0 [`getPlatformProxy` Node API](https://developers.cloudflare.com/workers/wrangler/api/) with the existing remote AI binding, current OAuth session, no env-file loading or persistent binding state, and explicit disposal. It invokes the same validated Worker handler in-process. No unattended port 55594 bridge, new token, package, Worker deployment or paid-service activation is required. Setup is bounded at 30s, inference at 25s/caller deadline and disposal at 5s. An uncertain transport becomes unusable for subsequent dispatches; conservative allowance reservations remain charged when usage is unknown.

Existing Free-plan freshness, account telemetry/headroom, local atomic journal and canonical per-round PostgreSQL reservations remain mandatory. No limits or historical accounting were reset. The opt-in harness adds a conservative500-Neuron evaluation ceiling, signed synthetic employee authentication, exact source pins, caller-JWT business reads and service-credential fetch restrictions allowing only the two canonical metering RPCs. Private model/tool traces are separate from content-free diagnostics. It stops unless the first turn proves a real model-selected read.

## Actual live result

Chris confirmed Workers Free. The established preflight passed at `2026-11-02T03:31:35.271Z`; Qwen was listed, historical account telemetry reported106.2225399017334Neurons/17requests, with9893.777460098267 nominal Neurons remaining before conservative journal/headroom. Those are account observations, **not this evaluation's usage**.

The accepted application source was exported to a plain scratch archive, with only the reviewed evaluation files overlaid. No branch/worktree or dirty application-source substitution was used.

| Gate | Actual outcome |
| --- | --- |
| Existing isolated synthetic employee password sign-in / verified JWT | HTTP200 / HTTP200 |
| Current `readOperationalData` | Authorized |
| Existing caller-scoped catalog of Jobs and Production overview | Complete authorized reads; no seeding |
| Owned remote binding setup / disposal | Both completed |
| First canonical model-round reservation | **HTTP404**, `POST /rest/v1/rpc/tenbot_reserve_usage` |
| Runtime safe stop reason | **`request-budget-unavailable`** |
| Actual model calls / selected read calls / model tokens | **0 / 0 / 0** |
| Additional inference usage / charges | **0 Neurons / $0** |
| First attempt before stop | 7.450s; process exited after7.771s |
| Comparative accuracy, task latency, fallback performance | **Not measured** |

No inference authentication or autonomous model capability is claimed. A model catalog listing and successful binding setup do not prove a successful inference. No scripted answer replaced the blocked call. The reserve endpoint was not retried, and no alternate quota path bypassed it.

The historical isolated-fixture bootstrap manifest explicitly excludes **“Qwen meter legacy implementation; unused old overloads omitted.”** This supports the missing compatible quota contract as the likely cause of the404. The failed response body was not retained, so this pass does not assert a specific PostgREST error code or distinguish a missing function from signature/schema-cache exposure. The harness now retains bounded error codes and partial control/read traces for future attempts; that post-stop diagnostic improvement was typechecked/linted but not rerun live.

## Validation and next action

Tier2 focused infrastructure validation passed: **12 agent-transport groups, 10 provider/meter groups and81 existing binding/privacy cases**, targeted strict TypeScript, targeted ESLint and diff checks. These offline tests use scripted AI and synthetic isolated journals with network blocked; they are not live model results or new database-security proof. Existing70 focused/adjacent candidate groups and security evidence were reused. Application UI/source did not change; its previous build/browser evidence was reused, with no broad rebuild or QA campaign.

**Recommend completing the fixture prerequisite before TenDev staging.** Product must authorize a narrow, reviewed installation of the omitted canonical `tenbot_usage`/Free-pool dependencies in the existing isolated Free fixture, including the source contracts from `20261027140000_tenbot_measured_free_pool.sql` and its prerequisites. Required signatures are `tenbot_reserve_usage(uuid,text,numeric)` and `tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric)`, with existing service-only grants and unchanged atomic limits. Do not apply earlier whole migration files over existing feedback/history objects. Preserve all fixture history and accounting; no paid resource or Production change is needed. After that gate, rerun the same bounded harness while the owner Free confirmation remains current.

Production remains `e71bd981`; routing, budgets and all operational write gates are unchanged. No operational/profile/history records, permissions, migrations, enrollment, invoice uploads, pushes or deployments were changed; no Auth users were created or administratively edited. Only existing Auth session establishment and authorized reads were exercised; the quota attempt failed before a reservation or inference. Unrelated dirty application/test files remain preserved.

[Sanitized execution receipt and source hashes](evidence/2026-11-01-tenbot-qwen-evaluation-transport/results.json). Private scratch/evidence: `/private/tmp/tenops-tenbot-agent-evaluation-transport-20261101` and `/private/tmp/tenops-tenbot-qwen-tools-live-UF78qB`. No review server/port was started. Stop for Product review; live model-directed usefulness remains unproven.
