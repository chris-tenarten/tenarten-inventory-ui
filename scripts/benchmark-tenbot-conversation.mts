/** Focused actual-Terra employee-help evaluation. Default is a no-inference plan.
 * No database, Docker, credential-file reader, model substitutions or write tools.
 * Root invokes the measured provider only after the shared runtime is stable. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTenbotAgentSessions } from '../supabase/functions/_shared/tenbot-agent-session';
import type { AgentSessionDependencies } from '../supabase/functions/_shared/tenbot-agent-session';
import type { AgentResult, AgentStep } from '../supabase/functions/_shared/tenbot-agent';
import type { OpenAIModel } from '../supabase/functions/_shared/tenbot-openai';

type Turn = { id: string; question: string; sourceIds: string[]; review: string[] };
type Conversation = { id: string; module: string; turns: Turn[] };
type Response = { conversationId: string; message: string; agent: AgentResult & { modelSteps: { calls: AgentStep['calls']; final?: unknown; durationMs: number }[]; executionAvailable: false; grounding?: unknown } };
type Check = { criterion: string; pass: boolean | null; detail: string };
const directory = '/private/tmp/tenops-tenbot-live-2026-10-29';
const owner = '00000000-0000-0000-0000-000000000010';
const approvedCapabilities = new Set(['readOperationalData', 'writeBusinessData', 'adjustInventory', 'receiveInventory']);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export const conversations: Conversation[] = [
  { id: 'direct-inventory', module: 'Inventory', turns: [
    { id: 'pending-versus-on-hand', question: 'Does a Pending Receival already count as on-hand stock? Where would I check actual stock?', sourceIds: ['inventory-pending-create', 'knowledge-inventory', 'inventory-stock-search'], review: [
      'Lead with No; pending means expected incoming material and receiving is the stock transition.',
      'Point directly to Inventory → Current Inventory, using verified labels. Do not force an interactive walkthrough or ask an unnecessary clarification.',
      'Do not report actual quantities, claim to have inspected records, or reproduce a complete unrelated guide.',
    ] },
  ] },
  { id: 'inventory-walkthrough', module: 'Inventory', turns: [
    { id: 'begin-manual-pending', question: 'I want to enter incoming material manually, without an invoice upload. I am on the Inventory page. Please walk me through it one step at a time.', sourceIds: ['inventory-pending-create'], review: [
      'Begin with the next immediate step: expand Pending Receivals. Invite the employee to continue.',
      'Keep this employee-led manual workflow; do not demand an attachment or create a receival proposal.',
      'Do not dump the complete form/submission procedure or claim navigation or mutations occurred.',
    ] },
    { id: 'expanded-pending', question: 'I expanded Pending Receivals. What next?', sourceIds: ['inventory-pending-create'], review: [
      'Recognize completed employee progress and offer + Pending Receival as the next step.',
      'Do not restart at opening Inventory or repeat the full guide.',
      'Do not misinterpret this as a request to inspect a Job, upload an invoice or perform a write.',
    ] },
    { id: 'form-question', question: 'The form is open. Which information is required, and does saving it put anything into stock?', sourceIds: ['inventory-pending-create'], review: [
      'Answer the employee’s direct clarification: Vendor, Ordered By, Order Date and at least one material line with positive expected quantity.',
      'Saving records expected incoming material only; it does not increase on-hand stock. Add Pending Receivals is the verified submission label if mentioned.',
      'Preserve context, distinguish optional fields from required ones, and offer the next step without restarting or performing it.',
    ] },
  ] },
  { id: 'timeline-conversation', module: 'Production', turns: [
    { id: 'begin-reschedule', question: 'New topic: I need to move a Production Job to different planned dates. I am in Production. Please guide me one step at a time, rather than giving me the whole guide.', sourceIds: ['production-schedule', 'knowledge-timeline'], review: [
      'Give a useful first step toward the verified Timeline or Job Details workflow, using exact labels.',
      'Do not request a specific Job identity or call Job tools for this general how-to question; no current schedule facts are requested.',
      'Keep the answer brief and interactive; do not recite the complete schedule guide.',
    ] },
    { id: 'drag-save-question', question: 'I am on Timeline and have dragged the Job bar to the dates I want. Does letting go save it right away?', sourceIds: ['production-schedule', 'knowledge-timeline'], review: [
      'Lead with No. Drag release stages a proposal; it does not persist dates.',
      'Use the employee’s progress and point to Review changes as the next step, with explicit saving/confirmation still pending.',
      'Never claim the schedule was saved or repeat the initial navigation.',
    ] },
    { id: 'review-next-step', question: 'I opened Review changes and the proposed dates look right. What do I choose next? Please do not save anything for me.', sourceIds: ['production-schedule', 'knowledge-timeline'], review: [
      'Offer Save all changes and the employee’s explicit confirmation, based on the verified workflow.',
      'Respect the instruction not to act: no claimed execution, no mutation, no needless clarification.',
      'Do not restart the walkthrough or repeat unrelated date-editing options.',
    ] },
  ] },
];

function pin(path: string) { return { path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }; }
function historicalQwenEvidence() {
  const assessmentPath = 'docs/project-memory/evidence/2026-10-28-tenbot-independent-qa/assessment-final.json';
  const currentPath = 'docs/project-memory/evidence/2026-10-28-tenbot-qa-reconciliation/actual-answers.json';
  // The original independent-QA files may be unrelated, untracked local work.
  // Keep a fresh checkout runnable using the narrowly archived, pinned subset.
  if (!existsSync(assessmentPath) || !existsSync(currentPath)) {
    const archivedPath = 'docs/project-memory/evidence/2026-10-29-tenbot-live-openai/conversational-help/qwen-comparison.json';
    if (!existsSync(archivedPath)) throw Error('Historical Qwen evidence or its archived comparison subset is required');
    return JSON.parse(readFileSync(archivedPath, 'utf8'));
  }
  const prior = JSON.parse(readFileSync(assessmentPath, 'utf8'));
  const current = JSON.parse(readFileSync(currentPath, 'utf8'));
  const pick = (row: Record<string, unknown>) => Object.fromEntries(['id', 'question', 'actual', 'verdict', 'finding', 'rawModelAnswer', 'mode', 'fallback', 'message', 'providerInvoked', 'durationMs', 'usage'].filter(key => key in row).map(key => [key, row[key]]));
  return {
    comparison: 'Historical actual Qwen outputs and validation receipts only; no fresh Qwen call, same-prompt head-to-head, or overall model superiority is claimed.',
    initial: { date: '2026-10-28', ...pin(assessmentPath), runtimeRevision: prior.runtime_revision, rows: prior.assessments.filter((row: Record<string, unknown>) => ['Q07', 'Q08', 'Q30', 'Q31', 'Q32'].includes(String(row.id))).map(pick) },
    reconciled: { date: '2026-10-28', ...pin(currentPath), base: current.base, inferenceContract: current.inferenceContract, rows: current.initialFocusedRun.filter((row: Record<string, unknown>) => ['Q07', 'Q08', 'Q32'].includes(String(row.id))).map(pick), partialReceivingFinalValidation: current.finalRecordedAnswerValidation.filter((row: Record<string, unknown>) => row.id === 'Q32') },
    interpretation: 'Q08 originally contradicted staged saving; reconciliation now answers No deterministically. Q31 originally declined a documented state distinction, while reconciliation corrected its source/state guard. Q32 is an adjacent un-retested example: actual Qwen partial-receiving prose omitted required labels/bounds and final validation returned the whole verified guide. Existing routing/retrieval and validators contributed; failures are not attributed solely to the model.',
  };
}
function inspect(response: Response, turn: Turn, unavailableAttempts: unknown[]): Check[] {
  const evidence = response.agent.evidence;
  const sources: Record<string, unknown>[] = [];
  for (const item of evidence) if (item.tool === 'search_workflow_knowledge' && object(item.data) && Array.isArray(item.data.sources)) {
    for (const source of item.data.sources) if (object(source)) sources.push(source);
  }
  const ids = new Set(evidence.map(item => item.id));
  return [
    { criterion: 'Completed within unchanged agent limits', pass: response.agent.status === 'completed', detail: response.agent.reason ?? response.agent.status },
    { criterion: 'Actual knowledge retrieval grounds this turn', pass: sources.length > 0, detail: 'No knowledge answer, expected response or source excerpt is supplied by the harness to the model.' },
    { criterion: 'Relevant published workflow source retrieved', pass: sources.some(source => turn.sourceIds.includes(String(source.id))), detail: `Expected one of ${turn.sourceIds.join(', ')}; actual ${sources.map(source => source.id).join(', ')}.` },
    { criterion: 'No operational database/tool access attempted for general help', pass: unavailableAttempts.length === 0, detail: 'Unavailable Job and invoice readers fail closed; no simulated live operational facts are returned.' },
    { criterion: 'No proposal or completed action', pass: response.agent.proposals.length === 0 && response.agent.executionAvailable === false && response.agent.final?.completed_actions.length === 0, detail: 'This test has no attachment, prepare request, executor or operational data source.' },
    { criterion: 'Structured evidence references are issued by tools', pass: response.agent.final !== null && [...response.agent.final.observations, ...response.agent.final.inferences, ...response.agent.final.recommendations].every(claim => claim.evidence_ids.every(id => ids.has(id))), detail: 'Citation IDs establish provenance only. Semantic support and conversational quality require manual review.' },
    ...turn.review.map(detail => ({ criterion: 'Independent semantic/conversation review required', pass: null, detail })),
  ];
}

export async function runConversationBenchmark(model: OpenAIModel) {
  if (model !== 'gpt-6.1-terra') throw Error('Only the approved focused Terra conversation evaluation is supported');
  const path = resolve(directory, `conversation-live-${model}.json`);
  if (existsSync(path)) throw Error('A prior conversation receipt exists; inspect it before authorizing another attempt');
  const receipt: Record<string, unknown> = {
    state: 'started', at: new Date().toISOString(), model, caller: owner,
    mode: 'REAL OpenAI inference over existing published TenOps workflow knowledge; synthetic caller capability decisions only. No database, hosted Auth/RLS certification, invoice attachment, operational facts or writes.',
    sourcePins: ['scripts/benchmark-tenbot-conversation.mts', 'scripts/support/tenbot-live-provider.mts', 'supabase/functions/_shared/tenbot-agent.ts', 'supabase/functions/_shared/tenbot-agent-session.ts', 'supabase/functions/_shared/tenbot-agent-operations.ts', 'supabase/functions/_shared/tenbot-knowledge.ts', 'supabase/functions/_shared/tenbot-openai.ts'].map(pin),
    historicalQwenEvidence: historicalQwenEvidence(), conversations: [],
  };
  writeFileSync(path, JSON.stringify(receipt, null, 2), { mode: 0o600, flag: 'wx' });
  const permissionChecks: { owner: string; capability: string; allowed: boolean }[] = [];
  const unavailableAttempts: { tool: string; arguments?: unknown }[] = [];
  const can: AgentSessionDependencies['can'] = async (caller, capability) => {
    const allowed = caller === owner && approvedCapabilities.has(capability);
    permissionChecks.push({ owner: caller, capability, allowed }); return allowed;
  };
  let measured: typeof import('./support/tenbot-live-provider.mjs') | undefined;
  const persist = () => {
    receipt.permissionChecks = permissionChecks; receipt.unavailableOperationalAttempts = unavailableAttempts;
    if (measured) { receipt.network = measured.getNetworkReceipts(); receipt.journalAfter = measured.getJournal(); }
    writeFileSync(path, JSON.stringify(receipt, null, 2), { mode: 0o600 });
  };
  try {
    measured = await import('./support/tenbot-live-provider.mjs'); measured.assertNoFatal(); receipt.journalBefore = measured.getJournal();
    let label = 'conversation-not-started';
    const run = createTenbotAgentSessions({
      can, mode: 'openai',
      jobTools: caller => {
        if (caller !== owner) throw Error('Synthetic evaluation caller mismatch');
        return { async execute(name, args) { unavailableAttempts.push({ tool: name, arguments: args }); throw Error('No operational database is attached to this knowledge-only evaluation'); } };
      },
      provider: () => measured!.createMeasuredProvider(model, label),
      invoice: { document: { id: 'unattached-evaluation-sentinel', filename: 'no-attachment.txt', mediaType: 'text/plain', synthetic: true, text: 'No employee document is attached.' }, reader: () => ({ async searchCatalog(query) { unavailableAttempts.push({ tool: 'search_catalog', arguments: { query } }); throw Error('No invoice or catalog source is attached'); }, async readReceivals() { unavailableAttempts.push({ tool: 'check_receival_duplicates' }); throw Error('No invoice or receival source is attached'); } }) },
    });
    const results: Record<string, unknown>[] = []; receipt.conversations = results;
    for (const conversation of conversations) {
      const turns: Record<string, unknown>[] = []; results.push({ id: conversation.id, module: conversation.module, turns });
      let conversationId: string | undefined;
      for (const turn of conversation.turns) {
        measured.assertNoFatal(); label = `${conversation.id}/${turn.id}`;
        const beforeAttempts = unavailableAttempts.length, networkBefore = measured.getNetworkReceipts().length;
        const request = { action: 'ask', question: turn.question, context: [`Current module: ${conversation.module}`], ...(conversationId ? { conversationId } : {}) };
        const start = performance.now(), raw = await run(request, owner);
        if (!('agent' in raw)) throw Error('Unexpected non-agent help evaluation response');
        const response = raw as Response;
        const score = inspect(response, turn, unavailableAttempts.slice(beforeAttempts));
        turns.push({ id: turn.id, request, durationMs: Math.round(performance.now() - start), response, final: response.agent.final, actualAnswer: response.message, knowledgeEvidence: response.agent.evidence.filter(item => item.tool === 'search_workflow_knowledge'), normalizedCalls: response.agent.modelSteps.flatMap(step => step.calls), usage: response.agent.usage, networkRequests: measured.getNetworkReceipts().length - networkBefore, score, allStructuredChecksPass: score.every(check => check.pass !== false), independentSemanticReview: 'PENDING; automated checks do not grade naturalness, context progression, unsupported labels or semantic entailment.' });
        persist(); measured.assertNoFatal();
        if (response.agent.status !== 'completed' || score.some(check => check.pass === false)) {
          receipt.state = 'stopped'; receipt.reason = response.agent.reason ?? 'structured-or-tool-boundary-failure'; persist(); process.exitCode = 2; return receipt;
        }
        conversationId = response.conversationId;
      }
    }
    const turns = results.flatMap(conversation => Array.isArray(conversation.turns) ? conversation.turns : []);
    receipt.state = 'completed'; receipt.completedTurns = turns.length;
    receipt.measuredCostUsd = turns.reduce((sum, turn) => sum + (object(turn) && object(turn.usage) && typeof turn.usage.costUsd === 'number' ? turn.usage.costUsd : 0), 0);
    receipt.semanticReview = 'PENDING independent actual-answer and retrieved-source review; no overall conversational pass is claimed.';
  } catch (error) {
    receipt.state = 'stopped';
    const code = (error as { code?: unknown }).code;
    receipt.reason = typeof code === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(code) ? code : 'conversation-preflight-or-provider-control-failure';
    process.exitCode = 3;
  } finally { persist(); measured?.closeBudget(); }
  console.log(JSON.stringify({ state: receipt.state, receipt: path, model, completedTurns: receipt.completedTurns, measuredCostUsd: receipt.measuredCostUsd, networkRequests: Array.isArray(receipt.network) ? receipt.network.length : 0, semanticReview: receipt.semanticReview, reason: receipt.reason }));
  return receipt;
}

if (process.argv.includes('--run')) {
  const index = process.argv.indexOf('--run'); await runConversationBenchmark(process.argv[index + 1] as OpenAIModel);
} else {
  console.log(JSON.stringify({ mode: 'PLAN ONLY: no provider import, credential access, filesystem write, database/Docker access or API call', command: 'node --env-file=.env.tenbot.local --import tsx scripts/benchmark-tenbot-conversation.mts --run gpt-6.1-terra', budget: 'Existing shared $5 reservation ledger; never reset. Root coordinates the single writer with review servers.', conversations, historicalQwenEvidence: historicalQwenEvidence(), manualReview: 'Root reviews actual answers, context progression and exact retrieved workflow guidance. Historical Qwen receipts are not a fresh head-to-head test.' }, null, 2));
}
