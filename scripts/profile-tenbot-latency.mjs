// Offline receipt analysis only. Never imports a provider, reads credentials,
// contacts a service, or changes the preserved inference budget.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const evidence = resolve('docs/project-memory/evidence/2026-10-29-tenbot-live-openai/docker-independent');
const filenames = ['synthetic-live-invoice-gpt-6.1-sol.json', 'synthetic-live-invoice-gpt-6.1-terra.json', 'browser-report.json'];
const sources = [
  'scripts/support/tenbot-live-provider.mts',
  'supabase/functions/_shared/tenbot-agent.ts',
  'supabase/functions/_shared/tenbot-openai.ts',
];
const sum = (rows, field) => rows.reduce((value, row) => value + row[field], 0);
const rounded = value => Math.round(value * 10000) / 10000;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function readReceipt(name) {
  const bytes = readFileSync(resolve(evidence, name));
  return { value: JSON.parse(bytes), pin: { path: resolve(evidence, name), sha256: hash(bytes) } };
}
function profileTurn(model, label, wallMs, agent) {
  if (agent.status !== 'completed') throw Error('Only completed, recorded turns are comparable');
  const models = agent.trace.filter(row => row.event === 'model');
  const tools = agent.trace.filter(row => row.event === 'tool');
  if (!models.length || models.some(row => row.outcome !== 'received')) throw Error('Missing successful provider timing');
  const providerWallMs = sum(models, 'durationMs');
  const simulatedToolWallMs = sum(tools, 'durationMs');
  const usage = agent.usage;
  return {
    model, label, turnWallMs: wallMs, agentWallMs: agent.durationMs,
    inferenceCalls: models.length, toolCalls: tools.length,
    toolSequence: tools.map(row => row.name),
    providerWallMs,
    providerShareOfAgentPercent: rounded(providerWallMs / agent.durationMs * 100),
    simulatedToolWallMs,
    runtimeResidualMs: agent.durationMs - providerWallMs - simulatedToolWallMs,
    lastStructuredAnswerRequestMs: models.at(-1).durationMs,
    lastStructuredAnswerOutputTokens: models.at(-1).usage.outputTokens,
    cadenceFloorBeforeLastRequestMs: (models.length - 1) * 2500,
    inputTokensAcrossCalls: usage.inputTokens,
    cachedInputTokensAcrossCalls: usage.cachedInputTokens,
    cachedInputPercent: rounded(usage.cachedInputTokens / usage.inputTokens * 100),
    outputTokensAcrossCalls: usage.outputTokens,
    measuredCostUsd: usage.costUsd,
  };
}
const pins = [], turns = [];
let pdfExtraction;
for (const name of filenames) {
  const { value, pin } = readReceipt(name); pins.push(pin);
  if (Array.isArray(value.turns)) {
    for (const turn of value.turns) turns.push(profileTurn(value.model, turn.label, turn.durationMs, turn.response.agent));
  } else {
    const ask = value.responses.find(row => row.action === 'ask' && row.body?.agent);
    if (!ask) throw Error('Missing actual PDF agent receipt');
    turns.push(profileTurn(value.serverModel, 'unfamiliar-raster-pdf', ask.body.agent.durationMs, ask.body.agent));
    const image = value.network.receipts.filter(row => row.attachment);
    if (image.length !== 1) throw Error('Expected one recorded PDF-rendered image inference');
    pdfExtraction = { model: image[0].model, providerWallMs: image[0].durationMs, usage: image[0].usage, imageSha256: image[0].attachment.sha256 };
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  mode: 'Offline analysis of prior real OpenAI calls with simulated database/tool results. No new inference or service requests.',
  pins,
  sourcePins: sources.map(path => ({ path, sha256: hash(readFileSync(path)) })),
  turns, pdfExtraction,
  interpretation: {
    dominantMeasuredComponent: 'Serial provider.step wall time exceeds 99.9% of each recorded agent turn; simulated tool execution totals only 6–23 ms. These are not live database latency measurements.',
    cadence: 'The local measured-provider wrapper enforces at least 2500 ms between request starts. Ten serial inference calls impose at least 22500 ms before the last request can start. It does not add 2500 ms to every call.',
    timingLimit: 'Provider wall time includes reservation, request construction/serialization, explicit pacing, transport, OpenAI processing/output, body reading/parsing and local accounting. Existing receipts have no fetch-sent/first-byte/body-finished/pacing timers; exact API/server versus pacing time cannot be recovered.',
    output: 'Final structured answers use 347–700 output tokens and take 5768–11141 ms measured inside provider.step. This observation does not isolate output-token generation from other provider latency.',
    context: 'The whole instructions/tool schemas/history are serialized again on each request (store:false; no response-id chain). Context grows from about 1.3k to 6.5–7.1k input tokens per call, totaling 43k–46k per turn; 81.8–88.5% are recorded cache hits. Prompt caching reduces billed input cost, not serial round trips.',
    concurrency: 'parallel_tool_calls:false and the runtime await each call. Five independent invoice-line catalog searches therefore took five inference rounds. This is a general runtime setting, not a measured database query bottleneck.',
  },
  focusedRecommendations: [
    'Add non-secret timing counters for pacingMs, requestSentAt, responseHeadersAt and bodyFinishedAt before asserting a precise OpenAI server latency or optimization gain.',
    'A narrowly scoped batch catalog-search capability for multiple invoice lines could reduce serial model round trips while preserving per-line server validation, caller-scoped queries and bounded result sizes; validate before adoption.',
    'Treat reducing the experimental 2500 ms pacing as a separate, rate-limit-aware change. Preserve the cumulative reservation ledger, fail-closed API failures and bounded calls; do not advertise an unmeasured speedup.',
    'Do not broaden optimization work or change models based on this five-turn sample.',
  ],
  callsMadeByProfiler: 0,
};
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output')) throw Error('Usage: node scripts/profile-tenbot-latency.mjs [--output FILE]');
const serialized = JSON.stringify(report, null, 2) + '\n';
if (args.length) writeFileSync(args[1], serialized, { flag: 'wx', mode: 0o600 });
else process.stdout.write(serialized);
