/** Caller-scoped canonical invoice → pending Inventory service.
 * No database URL, credential, model output, SQL or privileged client is accepted
 * here. The caller is the requesting employee's authenticated Supabase client.
 * Database execution defaults OFF independently of this host gate. Never use
 * this adapter to certify authorization without real caller-JWT/RLS tests.
 */
import type {PurchasingCatalogItemInput} from '../purchasing/types';
import type {InvoiceQuantityBasis, InvoiceSourceQuantity} from './invoice-quantity';
export const INVOICE_RECEIVAL_APPROVAL = 'CREATE_REVIEWED_PENDING_RECEIVALS' as const;
export type InvoiceReceivalDocument = {
  sha256: string;
  supplier: string;
  reference: string;
  documentDate: string | null;
};
export type InvoiceReceivalLine = {
  sourceLineId: string;
  catalogSource: 'standard' | 'specialty' | null;
  catalogId: string | null;
  quantityExpected: string;
  unit: string;
  productionJobId: string | null;
  sourceQuantity: InvoiceSourceQuantity;
  sourceText: string;
  newMaterial: InvoiceReceivalNewMaterial | null;
  duplicateAcknowledgement: string | null;
};
/** Proposed catalog fields carry no existing or invented catalog identity. */
export type InvoiceReceivalNewMaterial = Pick<PurchasingCatalogItemInput, 'itemName' | 'vendorSku' | 'materialType' | 'size' | 'unitSize' | 'unitSizeUom' | 'packaging' | 'priceUnit' | 'notes'> & {supplier: string; prepared: boolean};
export type InvoiceReceivalDuplicateReview = {
  fingerprint: string;
  canAcknowledge: boolean;
  acknowledged: boolean;
  matches: {recordId: string; source: 'database' | 'tenops'; supplier: string; status: string; materialName: string; size: string; quantityExpected: string; quantityReceived?: string; unit: string; documentReference: string | null; classification: 'possible' | 'confirmed'; recordFingerprint?: string; reason?: string}[];
  matchedCount?: number;
  hasMore?: boolean;
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
  catalogSnapshot: Record<string, unknown> | null;
  vendorSnapshot: Record<string, unknown> | null;
  quantityBasis: InvoiceQuantityBasis;
  duplicateReview: InvoiceReceivalDuplicateReview | null;
};
export type InvoiceReceivalDraft = {
  schemaVersion: 'invoice-receivals.v2';
  authorizationVersion: string;
  id: string;
  hash: string;
  ownerId: string;
  expiresAt: string;
  document: InvoiceReceivalDocument;
  metadata: InvoiceReceivalMetadata;
  lines: InvoiceReceivalSnapshotLine[];
  provenance: InvoiceReceivalProvenance;
  superseded?: boolean;
  revoked?: boolean;
  execution?: InvoiceReceivalExecution | null;
};
export type InvoiceReceivalApproval = { id: string; draftId: string; hash: string; expiresAt: string };
export type InvoiceReceivalRevocation = {draftId: string; hash: string; revoked: true};
export type InvoiceReceivalExecution = { draftId: string; hash: string; createdRecordIds: string[]; createdCatalogRecords: {sourceLineId: string; catalogSource: 'standard' | 'specialty'; catalogId: string}[]; idempotent: boolean; executedAt: string };
export type InvoiceReceivalCaller = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = /^[0-9a-f]{64}$/;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number, empty = false): value is string => typeof value === 'string' && value.length <= max && (empty || value.length > 0);
const timestamp = (value: unknown): value is string => text(value, 80) && Number.isFinite(Date.parse(value));
const sourceQuantity = (value: unknown): value is InvoiceSourceQuantity => record(value) && text(value.quantity, 30) && text(value.unit, 40);
function quantityBasis(value: unknown): value is InvoiceQuantityBasis {
  if (!record(value) || !['package_count','material_total','unknown'].includes(String(value.sourceKind)) || value.inventoryStockingUnit !== null || !['source_package_count','source_material_quantity','exact_catalog_package_conversion','unresolved'].includes(String(value.calculation)) || !Array.isArray(value.reasons) || value.reasons.length > 40 || value.reasons.some(reason => !text(reason, 100))) return false;
  return (value.packageCount === null || text(value.packageCount, 30)) && (value.receivalQuantity === null || text(value.receivalQuantity, 30)) && (value.receivalUnit === null || text(value.receivalUnit, 40)) && (value.totalMaterial === null || sourceQuantity(value.totalMaterial)) && (value.perPackage === null || record(value.perPackage) && text(value.perPackage.quantity, 30) && text(value.perPackage.unit, 40) && text(value.perPackage.container, 40));
}
function duplicateReview(value: unknown): value is InvoiceReceivalDuplicateReview | null {
  if (value === null) return true;
  if (!record(value) || typeof value.fingerprint !== 'string' || !digest.test(value.fingerprint) || typeof value.canAcknowledge !== 'boolean' || typeof value.acknowledged !== 'boolean' || !Array.isArray(value.matches) || value.matches.length > 80 || value.matchedCount !== undefined && (!Number.isSafeInteger(value.matchedCount) || Number(value.matchedCount) < value.matches.length) || value.hasMore !== undefined && typeof value.hasMore !== 'boolean') return false;
  return value.matches.every(match => record(match) && text(match.recordId, 160) && ['database','tenops'].includes(String(match.source)) && text(match.supplier, 240, true) && text(match.status, 80) && text(match.materialName, 240, true) && text(match.size, 240, true) && text(match.quantityExpected, 30) && (match.quantityReceived === undefined || text(match.quantityReceived, 30)) && text(match.unit, 40) && (match.documentReference === null || text(match.documentReference, 240)) && ['possible','confirmed'].includes(String(match.classification)) && (match.recordFingerprint === undefined || typeof match.recordFingerprint === 'string' && digest.test(match.recordFingerprint)) && (match.reason === undefined || text(match.reason, 1200)));
}
function newMaterial(value: unknown): value is InvoiceReceivalNewMaterial | null {
  if (value === null) return true;
  if (!record(value) || typeof value.prepared !== 'boolean') return false;
  return ['supplier','itemName','vendorSku','materialType','size','unitSize','unitSizeUom','packaging','priceUnit','notes'].every(key => text(value[key], key === 'notes' ? 1200 : 240, true));
}
function snapshotLine(value: unknown): value is InvoiceReceivalSnapshotLine {
  if (!record(value) || !text(value.sourceLineId, 160) || !text(value.quantityExpected, 30) || !text(value.unit, 40) || !(value.productionJobId === null || typeof value.productionJobId === 'string' && uuid.test(value.productionJobId)) || !sourceQuantity(value.sourceQuantity) || !text(value.sourceText, 4000) || !newMaterial(value.newMaterial) || !(value.duplicateAcknowledgement === null || typeof value.duplicateAcknowledgement === 'string' && digest.test(value.duplicateAcknowledgement)) || !quantityBasis(value.quantityBasis) || !duplicateReview(value.duplicateReview)) return false;
  const existing = ['standard','specialty'].includes(String(value.catalogSource)) && text(value.catalogId, 160) && value.newMaterial === null;
  const proposed = value.catalogSource === null && value.catalogId === null && value.newMaterial !== null;
  return (existing || proposed) && ['vendor','material','size','category'].every(key => text(value[key], 240, true)) && (value.jobLabel === null || text(value.jobLabel, 240)) && (value.catalogSnapshot === null || record(value.catalogSnapshot)) && (value.vendorSnapshot === null || record(value.vendorSnapshot));
}
function identity(id: string, hash: string) { if (!uuid.test(id) || !digest.test(hash)) throw Error('invalid_receival_draft_identity'); }
function executionResponse(result: Record<string, unknown>, expected: {draftId: string; hash: string}): InvoiceReceivalExecution {
  if (result.draftId !== expected.draftId || result.hash !== expected.hash || !Array.isArray(result.createdRecordIds) || !result.createdRecordIds.length || result.createdRecordIds.length > 80 || result.createdRecordIds.some(id => typeof id !== 'string' || !uuid.test(id)) || new Set(result.createdRecordIds).size !== result.createdRecordIds.length || !Array.isArray(result.createdCatalogRecords) || result.createdCatalogRecords.length > result.createdRecordIds.length || result.createdCatalogRecords.some(item => !record(item) || !text(item.sourceLineId, 160) || !['standard','specialty'].includes(String(item.catalogSource)) || typeof item.catalogId !== 'string' || !uuid.test(item.catalogId)) || new Set(result.createdCatalogRecords.map(item => item.sourceLineId)).size !== result.createdCatalogRecords.length || new Set(result.createdCatalogRecords.map(item => item.catalogId)).size !== result.createdCatalogRecords.length || typeof result.idempotent !== 'boolean' || !timestamp(result.executedAt)) throw Error('invalid_receival_service_response');
  return result as InvoiceReceivalExecution;
}
function draftResponse(result: Record<string, unknown>): InvoiceReceivalDraft {
  if (typeof result.id !== 'string' || typeof result.hash !== 'string') throw Error('invalid_receival_service_response');
  identity(result.id, result.hash);
  if (result.schemaVersion !== 'invoice-receivals.v2' || typeof result.authorizationVersion !== 'string' || !digest.test(result.authorizationVersion) || typeof result.ownerId !== 'string' || !uuid.test(result.ownerId) || !timestamp(result.expiresAt) || !record(result.document) || !record(result.metadata) || !record(result.provenance) || !Array.isArray(result.lines) || !result.lines.length || result.lines.length > 80 || !result.lines.every(snapshotLine) || new Set(result.lines.map(line => line.sourceLineId)).size !== result.lines.length || result.superseded !== undefined && typeof result.superseded !== 'boolean' || result.revoked !== undefined && typeof result.revoked !== 'boolean') throw Error('invalid_receival_service_response');
  const documentFields=result.document, metadata=result.metadata, provenance=result.provenance;
  if (typeof documentFields.sha256 !== 'string' || !digest.test(documentFields.sha256) || !text(documentFields.supplier, 240) || !text(documentFields.reference, 240) || !(documentFields.documentDate === null || text(documentFields.documentDate, 10) && /^\d{4}-\d{2}-\d{2}$/.test(documentFields.documentDate)) || !['orderedBy','orderDate','location'].every(key => text(metadata[key], 240)) || !text(provenance.model, 160) || !text(provenance.sourceMediaType, 120) || !['extractionSha256','toolTraceSha256'].every(key => typeof provenance[key] === 'string' && digest.test(provenance[key]))) throw Error('invalid_receival_service_response');
  if (result.execution !== undefined && result.execution !== null) {
    if (!record(result.execution)) throw Error('invalid_receival_service_response');
    executionResponse(result.execution, {draftId:result.id,hash:result.hash});
  }
  return result as InvoiceReceivalDraft;
}

export function createInvoiceReceivalService(caller: InvoiceReceivalCaller, options: { executionEnabled: boolean }) {
  async function call(name: string, args: Record<string, unknown>) {
    let response: Awaited<ReturnType<InvoiceReceivalCaller['rpc']>>;
    try { response = await caller.rpc(name, args); } catch { throw Error('receival_service_unavailable'); }
    const { data, error } = response;
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
      if (result.id !== input.draftId) throw Error('invalid_receival_service_response');
      return draftResponse(result);
    },
    async prepare(input: { document: InvoiceReceivalDocument; lines: InvoiceReceivalLine[]; metadata: InvoiceReceivalMetadata; provenance: InvoiceReceivalProvenance }): Promise<InvoiceReceivalDraft> {
      const result = await call('prepare_invoice_receival_draft', { p_document: input.document, p_lines: input.lines, p_metadata: input.metadata, p_provenance: input.provenance });
      return draftResponse(result);
    },
    async approve(input: { draftId: string; hash: string; confirmation: typeof INVOICE_RECEIVAL_APPROVAL }): Promise<InvoiceReceivalApproval> {
      identity(input.draftId, input.hash);
      if (input.confirmation !== INVOICE_RECEIVAL_APPROVAL) throw Error('explicit_receival_approval_required');
      const result = await call('approve_invoice_receival_draft', { p_draft_id: input.draftId, p_expected_hash: input.hash, p_confirmation: input.confirmation });
      if (typeof result.id !== 'string' || !uuid.test(result.id) || result.draftId !== input.draftId || result.hash !== input.hash || !timestamp(result.expiresAt)) throw Error('invalid_receival_service_response');
      return result as InvoiceReceivalApproval;
    },
    async revoke(input: {draftId: string; hash: string}): Promise<InvoiceReceivalRevocation> {
      identity(input.draftId, input.hash);
      const result = await call('revoke_invoice_receival_draft', {p_draft_id:input.draftId,p_expected_hash:input.hash});
      if (result.draftId !== input.draftId || result.hash !== input.hash || result.revoked !== true) throw Error('invalid_receival_service_response');
      return result as InvoiceReceivalRevocation;
    },
    async execute(input: { draftId: string; hash: string; approvalId: string }): Promise<InvoiceReceivalExecution> {
      // Local integration gate is fail-closed; the database gate also must pass.
      if (options.executionEnabled !== true) throw Error('receival_execution_disabled_pending_database_validation');
      identity(input.draftId, input.hash);
      if (!uuid.test(input.approvalId)) throw Error('invalid_receival_approval_identity');
      const result = await call('execute_invoice_receival_draft', { p_draft_id: input.draftId, p_expected_hash: input.hash, p_approval_id: input.approvalId });
      return executionResponse(result,input);
    },
  };
}
