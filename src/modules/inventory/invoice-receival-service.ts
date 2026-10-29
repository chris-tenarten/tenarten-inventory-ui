/** Caller-scoped canonical invoice → pending Inventory service.
 * No database URL, credential, model output, SQL or privileged client is accepted
 * here. The caller is the requesting employee's authenticated Supabase client.
 * The unapplied database contract defaults execution OFF independently of this
 * host gate. Never use this adapter to certify authorization without real RLS tests.
 */
export const INVOICE_RECEIVAL_APPROVAL = 'CREATE_REVIEWED_PENDING_RECEIVALS' as const;
export type InvoiceReceivalDocument = {
  sha256: string;
  supplier: string;
  reference: string;
  documentDate: string | null;
};
export type InvoiceReceivalLine = {
  sourceLineId: string;
  catalogSource: 'standard' | 'specialty';
  catalogId: string;
  quantityExpected: string;
  unit: string;
  productionJobId: string | null;
};
export type InvoiceReceivalMetadata = { orderedBy: string; orderDate: string; location: string };
export type InvoiceReceivalProvenance = {
  model: string;
  sourceMediaType: string;
  extractionSha256: string;
  toolTraceSha256: string;
};
export type InvoiceReceivalSnapshotLine = InvoiceReceivalLine & {
  vendor: string;
  material: string;
  size: string;
  category: string;
  jobLabel: string | null;
  catalogSnapshot: Record<string, unknown>;
};
export type InvoiceReceivalDraft = {
  id: string;
  hash: string;
  ownerId: string;
  expiresAt: string;
  document: InvoiceReceivalDocument;
  metadata: InvoiceReceivalMetadata;
  lines: InvoiceReceivalSnapshotLine[];
  provenance: InvoiceReceivalProvenance;
};
export type InvoiceReceivalApproval = { id: string; draftId: string; hash: string; expiresAt: string };
export type InvoiceReceivalExecution = { draftId: string; hash: string; createdRecordIds: string[]; idempotent: boolean; executedAt: string };
export type InvoiceReceivalCaller = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = /^[0-9a-f]{64}$/;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function identity(id: string, hash: string) { if (!uuid.test(id) || !digest.test(hash)) throw Error('invalid_receival_draft_identity'); }

export function createInvoiceReceivalService(caller: InvoiceReceivalCaller, options: { executionEnabled: boolean }) {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await caller.rpc(name, args);
    if (error) {
      // Do not leak server details, hidden records, input documents or credentials.
      const known = ['42501', '22023', 'P0002', '23505'];
      throw Error(known.includes(error.code ?? '') ? `receival_service_rejected:${error.code}` : 'receival_service_unavailable');
    }
    if (!record(data)) throw Error('invalid_receival_service_response');
    return data;
  }
  return {
    async get(input: { draftId: string }): Promise<InvoiceReceivalDraft> {
      if (!uuid.test(input.draftId)) throw Error('invalid_receival_draft_identity');
      const result = await call('get_invoice_receival_draft', { p_draft_id: input.draftId });
      if (result.id !== input.draftId || typeof result.hash !== 'string' || typeof result.ownerId !== 'string' || typeof result.expiresAt !== 'string' || !Array.isArray(result.lines) || !record(result.document) || !record(result.metadata) || !record(result.provenance)) throw Error('invalid_receival_service_response');
      identity(result.id, result.hash);
      return result as InvoiceReceivalDraft;
    },
    async prepare(input: { document: InvoiceReceivalDocument; lines: InvoiceReceivalLine[]; metadata: InvoiceReceivalMetadata; provenance: InvoiceReceivalProvenance }): Promise<InvoiceReceivalDraft> {
      const result = await call('prepare_invoice_receival_draft', { p_document: input.document, p_lines: input.lines, p_metadata: input.metadata, p_provenance: input.provenance });
      if (typeof result.id !== 'string' || typeof result.hash !== 'string' || typeof result.ownerId !== 'string' || typeof result.expiresAt !== 'string' || !Array.isArray(result.lines) || !record(result.document) || !record(result.metadata) || !record(result.provenance)) throw Error('invalid_receival_service_response');
      identity(result.id, result.hash);
      return result as InvoiceReceivalDraft;
    },
    async approve(input: { draftId: string; hash: string; confirmation: typeof INVOICE_RECEIVAL_APPROVAL }): Promise<InvoiceReceivalApproval> {
      identity(input.draftId, input.hash);
      if (input.confirmation !== INVOICE_RECEIVAL_APPROVAL) throw Error('explicit_receival_approval_required');
      const result = await call('approve_invoice_receival_draft', { p_draft_id: input.draftId, p_expected_hash: input.hash, p_confirmation: input.confirmation });
      if (typeof result.id !== 'string' || !uuid.test(result.id) || result.draftId !== input.draftId || result.hash !== input.hash || typeof result.expiresAt !== 'string') throw Error('invalid_receival_service_response');
      return result as InvoiceReceivalApproval;
    },
    async execute(input: { draftId: string; hash: string; approvalId: string }): Promise<InvoiceReceivalExecution> {
      // Local integration gate is fail-closed; the database gate also must pass.
      if (options.executionEnabled !== true) throw Error('receival_execution_disabled_pending_database_validation');
      identity(input.draftId, input.hash);
      if (!uuid.test(input.approvalId)) throw Error('invalid_receival_approval_identity');
      const result = await call('execute_invoice_receival_draft', { p_draft_id: input.draftId, p_expected_hash: input.hash, p_approval_id: input.approvalId });
      if (result.draftId !== input.draftId || result.hash !== input.hash || !Array.isArray(result.createdRecordIds) || !result.createdRecordIds.length || result.createdRecordIds.some(id => typeof id !== 'string' || !uuid.test(id)) || typeof result.idempotent !== 'boolean' || typeof result.executedAt !== 'string') throw Error('invalid_receival_service_response');
      return result as InvoiceReceivalExecution;
    },
  };
}
