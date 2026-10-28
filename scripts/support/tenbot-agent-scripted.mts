import { emptyUsage, type AgentFinal, type AgentProvider, type AgentStep, type AgentStepRequest, type JsonValue } from '../../supabase/functions/_shared/tenbot-agent';

/** Explicit offline transport fixtures, not model reasoning or an application intent router.
 * The caller selects a demonstration; employee wording never selects a branch.
 * Provider instances belong to one run. No inferred tokens, inference latency or cost are fabricated.
 */
type Scenario = 'job-investigation' | 'invoice-preparation' | 'tool-recovery';
type Row = Record<string, JsonValue>;
type ToolOutput = { evidence_id?: string; tool?: string; data?: JsonValue; error?: string };
const row = (value: unknown): value is Row => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = (value: unknown): Row[] => Array.isArray(value) ? value.filter(row) : [];
const text = (value: unknown) => typeof value === 'string' ? value : '';
function results(request: AgentStepRequest, name: string): ToolOutput[] {
  return request.history.flatMap(item => {
    if (item.kind !== 'tool_result' || item.name !== name) return [];
    try { const parsed: unknown = JSON.parse(item.output); return row(parsed) ? [parsed as ToolOutput] : []; } catch { return []; }
  });
}
function last(request: AgentStepRequest, name: string): ToolOutput | undefined { return results(request, name).at(-1); }
function jobData(result?: ToolOutput): Row { return row(result?.data) && row(result.data.data) ? result.data.data : {}; }
function end(answer: string, observations: AgentFinal['observations'] = [], questions: string[] = [], recommendations: AgentFinal['recommendations'] = []): AgentStep {
  return { calls: [], continuation: [], usage: emptyUsage(), final: { answer, observations, inferences: [], recommendations, questions, completed_actions: [] } satisfies AgentFinal };
}
const jobNames = ['find_jobs', 'get_job_summary', 'get_job_planning', 'get_job_labor_summary', 'get_production_overview'];
const invoiceNames = ['read_invoice', 'search_catalog', 'check_receival_duplicates', 'prepare_pending_receivals'];
export function createScriptedTenbotAgentProvider(scenario: Scenario): AgentProvider {
  if (!['job-investigation', 'invoice-preparation', 'tool-recovery'].includes(scenario)) throw new Error('Invalid explicit scripted demonstration');
  let phase = 0; let callNumber = 0; let extracted: Row[] = []; let metadata: Row = {}; let freight: Row | undefined;
  const calls = (items: { name: string; args: Row }[]): AgentStep => ({ calls: items.map(item => ({ id: `scripted_${++callNumber}`, name: item.name, arguments: item.args })), continuation: [], usage: emptyUsage() });
  const invoke = (name: string, args: Row = {}) => calls([{ name, args }]);
  const unavailable = (question: string) => end('The scripted demonstration could not obtain all required evidence. No rows were created.', [], [question]);
  return { name: 'Local scripted transport (offline demonstration)', model: 'offline-scripted', async step(request) {
    const current = phase++;
    if (current === 0) return invoke('discover_capabilities', { names: scenario === 'invoice-preparation' ? invoiceNames : jobNames });
    if (scenario !== 'invoice-preparation') {
      const recovery = scenario === 'tool-recovery';
      if (current === 1 && recovery) return invoke('find_jobs', { query: 'TB-2801', include_archived: false, limit: 10, cursor: '', intentional_invalid_key: 'offline failure-recovery fixture' });
      if (current === (recovery ? 2 : 1)) return invoke('find_jobs', { query: 'TB-2801', include_archived: false, limit: 10, cursor: '' });
      const found = last(request, 'find_jobs'); const matches = list(jobData(found).jobs);
      if (!found?.evidence_id || matches.length !== 1 || !text(matches[0].job_id)) return unavailable('Which exact Job should I investigate? The authorized lookup did not identify one unambiguous Job.');
      if (current === (recovery ? 3 : 2)) {
        const jobId = text(matches[0].job_id);
        return calls([{ name: 'get_job_summary', args: { job_id: jobId } }, { name: 'get_job_planning', args: { job_id: jobId } }, { name: 'get_job_labor_summary', args: { job_id: jobId, start_date: '', end_date: '' } }]);
      }
      const summary = last(request, 'get_job_summary'), planning = last(request, 'get_job_planning'), labor = last(request, 'get_job_labor_summary');
      if (!summary?.evidence_id || !planning?.evidence_id || !labor?.evidence_id) return unavailable('Some authorized Job reads failed. Would you like to retry this Job or investigate a different one?');
      const summaryData = jobData(summary), laborData = jobData(labor), job = row(summaryData.job) ? summaryData.job : {}, effective = row(job.effective) ? job.effective : {};
      const reference = text(job.reference) || text(matches[0].reference) || 'The selected Job';
      const status = text(effective.status) || 'not established'; const materialStatus = text(job.material_status) || 'not established';
      const hours = typeof laborData.total_hours === 'number' ? String(laborData.total_hours) : 'not established';
      const period = row(laborData.period) ? `${text(laborData.period.start_date)} through ${text(laborData.period.end_date)}` : 'the returned reporting period';
      return end(`${reference}: recorded status ${status}; material status ${materialStatus}; recorded labor ${hours} hours for ${period}. Saved schedule and planning details were checked. These records do not establish a forecast or physical material sufficiency. No changes were made.`, [
        { text: `${reference} has recorded effective status ${status} and material status ${materialStatus}.`, evidence_ids: [summary.evidence_id] },
        { text: `Persisted planning/schedule data was returned for ${reference}.`, evidence_ids: [planning.evidence_id] },
        { text: `Recorded labor totals ${hours} hours for ${period}; remaining work is unknown.`, evidence_ids: [labor.evidence_id] },
      ], [], recovery ? [{ text: 'The intentionally malformed offline request was rejected; a schema-correct lookup then obtained these records.', evidence_ids: [found.evidence_id] }] : []);
    }

    if (current === 1) return invoke('read_invoice');
    const document = last(request, 'read_invoice'); const docData = row(document?.data) ? document.data : {};
    if (!document?.evidence_id || !Array.isArray(docData.sources)) return unavailable('The synthetic invoice attachment could not be read. Can you supply the document again?');
    if (current === 2) {
      // Gold extraction from this one explicitly selected, labeled synthetic fixture.
      // This deliberately simple parser is a transport double, never OCR or a new Inventory business engine.
      const sources = list(docData.sources); const id = text(docData.document_id);
      const source = (number: number) => sources.find(item => item.source_ref === `${id}:L${number}`);
      const supplier = source(2), reference = source(3); freight = source(10);
      if (!supplier || !reference || !freight) return unavailable('The selected synthetic fixture format changed. Review the attachment before preparing any lines.');
      metadata = { supplier: text(supplier.text).replace(/^Supplier:\s*/, ''), supplier_source_ref: supplier.source_ref, document_ref: text(reference.text).replace(/^Invoice:\s*/, ''), document_source_ref: reference.source_ref };
      extracted = [];
      for (let number = 5; number <= 9; number++) {
        const line = source(number); const parts = text(line?.text).split('|').map(item => item.trim()); const quantityUnit = parts[4]?.match(/^(\d+(?:\.\d+)?)\s+(\S+)$/);
        if (!line || parts.length !== 5 || !quantityUnit) return unavailable('The selected synthetic fixture line format changed. Which material lines and units should be used?');
        extracted.push({ source_ref: line.source_ref, description: parts[2], quantity: quantityUnit[1], unit: quantityUnit[2], size: parts[3] || null, vendor_sku: parts[1] || null });
      }
      return calls(extracted.slice(0, 4).map(args => ({ name: 'search_catalog', args })));
    }
    if (current === 3) return invoke('search_catalog', extracted[4]);
    const searches = results(request, 'search_catalog').filter(item => item.evidence_id && row(item.data));
    if (searches.length !== 5) return unavailable('A catalog search failed. Please review all five material lines before continuing.');
    if (current === 4) return invoke('check_receival_duplicates', metadata);
    const duplicate = last(request, 'check_receival_duplicates');
    if (!duplicate?.evidence_id) return unavailable('The potential-duplicate check failed. Retry that check before preparing any receivals.');
    if (current === 5) {
      const selections = extracted.map(item => {
        const search = searches.find(result => row(result.data) && result.data.source_ref === item.source_ref); const candidates = row(search?.data) ? list(search.data.candidates) : [];
        return { source_ref: item.source_ref, candidate_id: candidates.length ? candidates[0].candidate_id : null };
      });
      return invoke('prepare_pending_receivals', { selections, exclusions: [{ source_ref: freight!.source_ref, reason: 'freight' }] });
    }
    const prepared = last(request, 'prepare_pending_receivals'); const proposal = row(prepared?.data) ? prepared.data : {};
    if (!prepared?.evidence_id) return unavailable('Preparation failed. Review catalog matches and employee order details before retrying.');
    const ready = list(proposal.ready_lines), held = list(proposal.held_lines), excluded = list(proposal.excluded_lines), missing = Array.isArray(proposal.missing_employee_confirmations) ? proposal.missing_employee_confirmations.map(String) : [];
    const questions = missing.length ? [`Who ordered these materials, what was the order date, and which location should receive them? Missing confirmed fields: ${missing.join(', ')}.`] : [];
    if (held.length) questions.push('Please resolve the held duplicate, ambiguous catalog match and unmatched material before any future execution.');
    return end(`Prepared ${ready.length} review-only material drafts; held ${held.length} material lines; excluded ${excluded.length} freight line. ${missing.length ? 'Employee order details still need confirmation. ' : ''}Review the canonical quantities and reasons below. No rows were created; execution is unavailable.`, [
      { text: `The host prepared ${ready.length} draft lines and held ${held.length} lines from the supplied synthetic invoice.`, evidence_ids: [prepared.evidence_id] },
      { text: `Freight is excluded from Inventory receivals. Potential duplicates and ambiguous or unmatched materials remain held.`, evidence_ids: [prepared.evidence_id, duplicate.evidence_id] },
    ], questions, [{ text: 'Review the host-owned proposals against the attachment. Employee approval and a separately authorized execution capability would be required for future writes.', evidence_ids: [prepared.evidence_id] }]);
  } };
}
