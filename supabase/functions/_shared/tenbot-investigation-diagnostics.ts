/** Content-free investigation telemetry. Never pass a trace, exception, tool
 * arguments/results, document identity, or model context to a logging sink. */
const stages = new Set(['authorization', 'extraction', 'source-persistence', 'model', 'tool', 'stop', 'investigation', 'draft', 'draft-persistence']);
const outcomes = new Set(['ok', 'error', 'stopped']);
const tools = new Set([
  'discover_capabilities', 'describe_assistant_scope', 'search_workflow_knowledge',
  'find_jobs', 'get_job_summary', 'get_job_planning', 'get_job_labor_summary', 'get_production_overview', 'get_labor_analytics', 'get_job_activity',
  'read_invoice', 'search_catalog', 'check_receival_duplicates', 'prepare_pending_receivals',
  'read_supplied_document', 'search_material_catalog', 'find_receivals', 'find_suppliers', 'get_order',
  'search_customers', 'get_customer', 'search_contacts', 'get_contact', 'prepare_proposal_draft',
]);
const toolReasons = new Set([
  'tool-failed', 'invalid-arguments', 'unknown-capability', 'capability-not-discovered', 'invalid-tool-result',
  'invalid_invoice_argument', 'invoice_read_incomplete', 'invalid_invoice_catalog_identities', 'invalid_invoice_quantity',
  'synthetic_invoice_required', 'invoice_session_not_authorized', 'read_invoice_first', 'invalid_invoice_evidence',
  'unsupported_invoice_extraction', 'non_material_invoice_line', 'unsupported_invoice_quantity_unit',
  'invoice_metadata_or_materials_missing', 'unsupported_invoice_metadata', 'current_duplicate_check_required',
  'all_extracted_lines_must_be_reviewed', 'invalid_invoice_selection', 'catalog_candidate_not_in_session', 'invalid_invoice_exclusion',
  'proposal_invalid_schema', 'proposal_invalid_identity', 'proposal_source_ref_unavailable',
  'proposal_value_not_literal_source', 'proposal_invalid_decimal', 'proposal_quote_rate_unproven',
]);
const reasons = new Set([
  ...toolReasons, 'conversation-claim-invalid','conversation-load-invalid','conversation-state-invalid','conversation-context-extended','conversation-commit-started','conversation-commit-rejected','conversation-commit-completed','conversation-storage-unavailable', 'operation-ok','operation-incomplete','operation-unavailable','operation-invalid-request','operation-not-authorized','identity-resolved','identity-ambiguous','identity-unresolved','identity-incomplete','read-final-unjustified-clarification', 'ok', 'received', 'completed', 'runtime-error', 'authorization-denied', 'invalid-usage', 'cost-limit',
  'context-limit', 'invalid-input', 'invalid-context', 'invalid-limits', 'invalid-registry', 'deadline',
  'invalid-provider-step', 'invalid-final', 'unknown-evidence', 'missing-workflow-evidence', 'empty-provider-step',
  'read-final-question', 'read-final-missing-evidence', 'read-final-non-fact-claim', 'read-final-workflow-wording',
  'read-final-workflow-permission', 'read-final-empty-answer', 'read-final-too-long','read-final-narrative',
  'call-limit', 'invalid-call', 'result-limit', 'round-limit', 'error-limit',
  'model-not-allowed', 'invalid-output-budget', 'oversized-response', 'empty-response', 'provider-timeout',
  'incomplete-provider-response', 'invalid-provider-response', 'incomplete-function-call', 'invalid-function-call',
  'invalid-function-arguments', 'invalid-provider-message', 'provider-refusal-or-invalid-content',
  'unapproved-provider-output', 'mixed-provider-output', 'invalid-structured-output', 'invalid-provider-configuration',
  'invalid-provider-timeout', 'invalid-original-attachment', 'spending-not-authorized', 'provider-not-configured',
  'provider-cancelled', 'oversized-request', 'invalid-original-input', 'document-token-count-unavailable',
  'invalid-document-token-count', 'request-budget-unavailable', 'invalid-budget-reservation', 'invalid-provider-json',
  'unexpected-provider-metadata', 'provider-http-error', 'missing-provider-usage', 'provider-transport-error', 'provider-error',
  'canary-original-unverified', 'invoice-accounting-unavailable', 'canary-access-unavailable',
  'extraction-failed', 'source-persistence-failed', 'investigation-failed', 'invalid-agent-result', 'no-draft-proposal', 'draft-invalid', 'draft-persistence-failed',
]);
export type InvestigationDiagnostic = {
  stage: 'authorization' | 'extraction' | 'source-persistence' | 'model' | 'tool' | 'stop' | 'investigation' | 'draft' | 'draft-persistence';
  tool: string | null;
  outcome: 'ok' | 'error' | 'stopped';
  durationMs: number;
  reasonCode: string;
};
export type InvestigationDiagnosticSink = (event: InvestigationDiagnostic) => void;

/** Typed server failure only. Unknown text is never retained as a reason. */
export class AgentToolError extends Error {
  readonly code: string;
  constructor(code: string) {
    const safeCode = toolReasons.has(code) ? code : 'tool-failed';
    super(safeCode); this.name = 'AgentToolError'; this.code = safeCode;
  }
}
/** A fresh projection is required even at the hosted sink; never spread input. */
export function safeInvestigationDiagnostic(event: InvestigationDiagnostic): InvestigationDiagnostic {
  return {
    stage: stages.has(event.stage) ? event.stage : 'stop',
    tool: event.tool === null ? null : tools.has(event.tool) ? event.tool : 'unknown-tool',
    outcome: outcomes.has(event.outcome) ? event.outcome : 'error',
    durationMs: Number.isFinite(event.durationMs) ? Math.max(0, Math.min(90000, Math.round(event.durationMs))) : 0,
    reasonCode: reasons.has(event.reasonCode) ? event.reasonCode : 'runtime-error',
  };
}
/** Telemetry must never affect authorization, accounting, or agent outcomes. */
export function emitInvestigationDiagnostic(sink: InvestigationDiagnosticSink | undefined, event: InvestigationDiagnostic): void {
  if (!sink) return;
  try { Promise.resolve(sink(safeInvestigationDiagnostic(event))).catch(() => {}); } catch { /* diagnostic delivery is best-effort */ }
}

/** Private verification error envelope only. The caller still owns auth/status
 * and its ordinary employee error message. No exception or provider body enters
 * this projection; a malformed correlation value is discarded. */
export function safeVerificationFailureDiagnostics(requestId:unknown,events:unknown):{requestId:string|null;diagnostics:InvestigationDiagnostic[]}{
 const id=typeof requestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)?requestId:null;
 const diagnostics=Array.isArray(events)?events.slice(-128).flatMap(event=>event&&typeof event==='object'&&!Array.isArray(event)?[safeInvestigationDiagnostic(event as InvestigationDiagnostic)]:[]):[];
 return {requestId:id,diagnostics};
}
