# Failure-only Web Push RPC diagnostics — local candidate

Product authorized local implementation and commit only. No deployment, hosted configuration, SQL, cohort or Cron changes. Risk Tier 3; focused Level 3 privacy/failure-path verification. The intermittent pilot failure cause remains unproven; this adds evidence for future failures rather than changing recovery.

## Contract

`send-web-push/diagnostics.mjs` emits one structured `web_push_rpc_failed` console error per failing RPC, including failures handled by the existing per-delivery retry path. Successful calls emit nothing. Fields are fixed and allowlisted:

- Environment, RPC name and stage (initial prepare distinguished from post-encryption recheck).
- Monotonic elapsed milliseconds, actual HTTP status if headers arrived, SQLSTATE/PostgREST code if supplied, allowlisted transport error class, and abort reason `timeout`, `aborted` or `none` from the actual fetch signal. HTTP/SQL fields are null when unavailable. HTTP 200 with an aborted response body remains distinguishable.
- Signed wake run UUID and delivery UUID where available; deployment/execution IDs from platform environment variables, format checked and null when unavailable.

No RPC arguments, lease tokens, account IDs, subscription keys/endpoints, credentials, request/response bodies, messages, error messages/details/hints/stacks or arbitrary abort reasons are logged. Invalid correlation fields are null. Logger errors are swallowed and the pre-existing generic RPC failure propagates.

Each invocation constructs its own nonpersistent, nonrefreshing service-role client and diagnostic adapter. Its sequential RPCs retain isolated timing/signal state; overlapping worker invocations cannot share run/delivery context. No extra database or provider requests are introduced.

The four-second fetch timeout is still created at each actual RPC fetch; redirect rejection, five-second provider timeout, 45-second batch deadline, generic worker HTTP responses, retry delays, lease recovery and provider outcomes are unchanged. Authentication, preview preferences, revocation, cohort enforcement and kill switches are untouched. Production remains the existing approved two-account rollout.

## Focused validation

- Existing `scripts/verify-web-push-worker.mjs`: **18 groups passed**, zero real push requests. Four added groups exercise real installed Supabase SDK error handling with synthetic fetches: HTTP/SQL redaction, timeout/abort/network/body timeout, concurrent invocation IDs and broken logging sinks, and failure at every RPC stage preserving status/retry behavior. The verifier asserts the default timeout is still 4,000 ms.
- Existing payload, endpoint/redirect registry, provider status/retry mappings, signed wake/replay, disabled worker, unavailable source and device-disable-during-encryption groups passed again within that focused verifier.
- Targeted ESLint, Node syntax and `git diff --check` passed. Historical Stage B evidence is preserved; `WEB_PUSH_EVIDENCE_DIR` directs new results to [diagnostic evidence](evidence/web-push-worker-diagnostics/worker.json).
- Cached Supabase Edge runtime v1.74.3 booted the Production entry point locally with `--network none`, no secrets, and returned HTTP 503 `{"status":"disabled"}`. The temporary check container was stopped.
- Targeted Node TypeScript check reports exactly the same two baseline errors: missing Node declaration resolution for Deno's `npm:web-push@3.6.7` import and DOM `BodyInit` incompatibility with the existing `Uint8Array` annotation. No new candidate errors; this is not a clean Deno type-check claim. No frontend build, physical-device retest or database battery was necessary for this logging-only delta.

## Release boundary

Not deployed or pushed. No notifications sent; no hosted reads/mutations were needed. Deployment requires separate authorization. After deployment, inspect failure-only records alongside existing worker HTTP/scheduled invocation records; do not infer the historical cause or alter deadlines/retries from this local validation. No alerting service, new scheduling or retention configuration is introduced.
