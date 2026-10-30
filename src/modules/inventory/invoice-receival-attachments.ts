/** Private original evidence for caller-authorized invoice receivals.
 * No public URL, service key or business-data client is accepted. Metadata state
 * attestation is a separate fixed server-only RPC; it cannot create Inventory.
 */
import type {InvoiceReceivalCaller} from './invoice-receival-service';
import type {InvoiceSourceQuantity} from './invoice-quantity';
import type {LocalReceivalDraft} from '../tenbot/live-review';

export const INVOICE_RECEIVAL_SOURCE_BUCKET = 'invoice-receival-originals' as const;
export const INVOICE_RECEIVAL_SOURCE_MAX_BYTES = 12_000_000;
export type InvoiceReceivalSourceState = {
  version: 'invoice-receival-state.v1';
  originalSha256: string;
  visionSha256: string;
  rawLines: string[];
  sourceRows: {lineId: string; sourceText: string; sourceQuantity: InvoiceSourceQuantity | null}[];
  draft: LocalReceivalDraft | null;
  traceHash: string | null;
  document?: Record<string, unknown> | null;
};
export type InvoiceReceivalSource = {
  id: string;
  ownerId: string;
  filename: string;
  mediaType: 'application/pdf' | 'image/jpeg' | 'image/png';
  byteSize: number;
  sha256: string;
  storageBucket: typeof INVOICE_RECEIVAL_SOURCE_BUCKET;
  storagePath: string;
  state: 'uploading' | 'ready' | 'retained' | 'deleting' | 'deleted';
  createdAt: string;
  expiresAt: string;
  version: number;
  verifiedAt: string | null;
  retainedAt: string | null;
  retainedDraftId: string | null;
  evidenceSha256: string | null;
  agentState: InvoiceReceivalSourceState | null;
};
type Failure = {message?: string; code?: string; statusCode?: string} | null;
export type InvoiceReceivalStorageCaller = InvoiceReceivalCaller & {
  storage: {from(bucket: string): {
    upload(path: string, body: Blob, options: {contentType: string; upsert: false}): Promise<{data: unknown; error: Failure}>;
    download(path: string): Promise<{data: Blob | null; error: Failure}>;
    remove(paths: string[]): Promise<{data: unknown; error: Failure}>;
  }};
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = /^[a-f0-9]{64}$/;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
async function bounded<T>(operation: PromiseLike<T>, milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {return await Promise.race([Promise.resolve(operation),new Promise<never>((_,reject) => {timer=setTimeout(() => reject(Error('invoice_source_unavailable')),milliseconds);})]);}
  finally {if(timer)clearTimeout(timer);}
}
function id(value: string) {if (!uuid.test(value)) throw Error('invalid_invoice_source_identity');}
export function invoiceReceivalSourceResponse(value: unknown): InvoiceReceivalSource {
  if (!record(value) || typeof value.id !== 'string' || !uuid.test(value.id) || typeof value.ownerId !== 'string' || !uuid.test(value.ownerId)
    || typeof value.filename !== 'string' || !value.filename.length || value.filename.length > 255 || /[\u0000-\u001f\u007f]/.test(value.filename)
    || !['application/pdf','image/jpeg','image/png'].includes(String(value.mediaType)) || !Number.isSafeInteger(value.byteSize) || Number(value.byteSize) < 1 || Number(value.byteSize) > INVOICE_RECEIVAL_SOURCE_MAX_BYTES
    || typeof value.sha256 !== 'string' || !digest.test(value.sha256) || value.storageBucket !== INVOICE_RECEIVAL_SOURCE_BUCKET || value.storagePath !== `${value.ownerId}/${value.id}/original`
    || !['uploading','ready','retained','deleting','deleted'].includes(String(value.state)) || !timestamp(value.createdAt) || !timestamp(value.expiresAt) || Date.parse(value.expiresAt) <= Date.parse(value.createdAt)
    || !Number.isSafeInteger(value.version) || Number(value.version) < 0 || !(value.verifiedAt === null || timestamp(value.verifiedAt)) || !(value.retainedAt === null || timestamp(value.retainedAt))
    || !(value.retainedDraftId === null || typeof value.retainedDraftId === 'string' && uuid.test(value.retainedDraftId)) || !(value.evidenceSha256 === null || typeof value.evidenceSha256 === 'string' && digest.test(value.evidenceSha256))
    || !(value.agentState === null || record(value.agentState) && value.agentState.version === 'invoice-receival-state.v1' && value.agentState.originalSha256 === value.sha256 && typeof value.agentState.visionSha256 === 'string' && digest.test(value.agentState.visionSha256) && Array.isArray(value.agentState.rawLines) && Array.isArray(value.agentState.sourceRows))) throw Error('invalid_invoice_source_response');
  if (value.state === 'retained' && (!value.retainedDraftId || !value.retainedAt) || value.state !== 'retained' && (value.retainedDraftId !== null || value.retainedAt !== null)) throw Error('invalid_invoice_source_response');
  return value as InvoiceReceivalSource;
}
async function rpc(caller: InvoiceReceivalCaller, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  let result: Awaited<ReturnType<InvoiceReceivalCaller['rpc']>>;
  try {result = await bounded(caller.rpc(name,args));} catch {throw Error('invoice_source_unavailable');}
  if (result.error) throw Error(['42501','22023','P0002','23505'].includes(result.error.code ?? '') ? `invoice_source_rejected:${result.error.code}` : 'invoice_source_unavailable');
  return result.data;
}
export async function invoiceOriginalSha256(original: Blob): Promise<string> {
  if (!original.size || original.size > INVOICE_RECEIVAL_SOURCE_MAX_BYTES || !['application/pdf','image/jpeg','image/png'].includes(original.type)) throw Error('invalid_invoice_source_file');
  const bytes = await original.arrayBuffer(), prefix = new Uint8Array(bytes.slice(0,8));
  const valid = original.type === 'application/pdf' ? new TextDecoder().decode(prefix).startsWith('%PDF-') : original.type === 'image/jpeg' ? prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255 : [137,80,78,71,13,10,26,10].every((part,index) => prefix[index] === part);
  if (!valid) throw Error('invalid_invoice_source_signature');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(part => part.toString(16).padStart(2,'0')).join('');
}
export function createInvoiceReceivalAttachmentService(caller: InvoiceReceivalStorageCaller) {
  async function get(sourceId: string) {id(sourceId);return invoiceReceivalSourceResponse(await rpc(caller,'get_invoice_receival_source',{p_source_id:sourceId}));}
  async function download(sourceId: string) {
    const source = await get(sourceId);
    if (['deleting','deleted'].includes(source.state) || source.state !== 'retained' && Date.parse(source.expiresAt) <= Date.now()) throw Error('invoice_source_expired');
    const result = await bounded(caller.storage.from(INVOICE_RECEIVAL_SOURCE_BUCKET).download(source.storagePath));
    if (result.error || !result.data) throw Error('invoice_source_download_unavailable');
    // Fresh RLS applies to every download; no signed/public URL can outlive a
    // permission change. Verify actual bytes rather than trusting a preview.
    const blob = result.data;
    if (blob.size !== source.byteSize || blob.type !== source.mediaType || await invoiceOriginalSha256(blob) !== source.sha256) throw Error('invoice_source_integrity_failed');
    return {source, original: blob};
  }
  async function remove(sourceId: string, abandoned: boolean) {
    id(sourceId);const source = invoiceReceivalSourceResponse(await rpc(caller,'prepare_invoice_receival_source_removal',{p_source_id:sourceId,p_abandoned:abandoned}));
    if (source.state === 'deleted') return source;
    const removed = await bounded(caller.storage.from(INVOICE_RECEIVAL_SOURCE_BUCKET).remove([source.storagePath]));
    if (removed.error) {
      // A timed-out Storage deletion can still have completed. SQL retirement
      // verifies actual absence; no second object or Metadata-first delete.
      try {return invoiceReceivalSourceResponse(await rpc(caller,'finish_invoice_receival_source_removal',{p_source_id:sourceId}));} catch {throw Error('invoice_source_cleanup_incomplete');}
    }
    return invoiceReceivalSourceResponse(await rpc(caller,'finish_invoice_receival_source_removal',{p_source_id:sourceId}));
  }
  return {
    get,
    download,
    async forDraft(draftId: string) {id(draftId);return invoiceReceivalSourceResponse(await rpc(caller,'get_invoice_receival_source_for_draft',{p_draft_id:draftId}));},
    async upload(original: Blob, filename: string) {
      if (!filename || filename.length > 255 || /[\u0000-\u001f\u007f]/.test(filename)) throw Error('invalid_invoice_source_filename');
      const sha256 = await invoiceOriginalSha256(original);
      const source = invoiceReceivalSourceResponse(await rpc(caller,'begin_invoice_receival_source',{p_filename:filename,p_content_type:original.type,p_byte_size:original.size,p_sha256:sha256}));
      if (source.state === 'uploading') {
        const result = await bounded(caller.storage.from(INVOICE_RECEIVAL_SOURCE_BUCKET).upload(source.storagePath,original,{contentType:original.type,upsert:false}),45000);
        // An exact concurrent upload/retry may have won. Reconcile by reading
        // the one immutable object and hashing its real bytes; never upsert.
        if (result.error) await download(source.id);
      }
      return (await download(source.id)).source;
    },
    abandon: (sourceId: string) => remove(sourceId,true),
    async cleanupExpired() {
      const rows = await rpc(caller,'list_expired_invoice_receival_sources');
      if (!Array.isArray(rows) || rows.length > 20) throw Error('invalid_invoice_source_response');
      const sources = rows.map(invoiceReceivalSourceResponse), result: InvoiceReceivalSource[] = [];
      // Two per foreground request keeps resumed-draft cleanup bounded. A
      // separate reviewed maintenance invocation must handle inactive owners.
      for (const source of sources.slice(0,2)) result.push(await remove(source.id,false));
      return result;
    },
  };
}
/** Fixed metadata attestation adapter. Pass only a restricted server RPC
 * capability; never expose it to a model, HTTP body or browser client. */
export function createInvoiceReceivalSourceStateWriter(serverMetadata: InvoiceReceivalCaller) {
  return {async record(input: {actorId: string; sourceId: string; expectedVersion: number; verifiedSha256: string; state: InvoiceReceivalSourceState}) {
    id(input.actorId);id(input.sourceId);
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || !digest.test(input.verifiedSha256)) throw Error('invalid_invoice_source_state_identity');
    return invoiceReceivalSourceResponse(await rpc(serverMetadata,'record_invoice_receival_source_state',{p_actor:input.actorId,p_source_id:input.sourceId,p_expected_version:input.expectedVersion,p_verified_sha256:input.verifiedSha256,p_state:input.state}));
  }};
}

/** Maintenance integration only: fixed expired-source claim -> Storage DELETE ->
 * metadata acknowledgement. The injected capability must delete only from the
 * private invoice bucket; no source download or Inventory method is accepted.
 * Scheduling/activation requires separate pilot configuration approval. */
export async function cleanupExpiredInvoiceReceivalSources(serverMetadata: InvoiceReceivalCaller, deleteOriginal: (storagePath: string) => Promise<void>, limit = 20) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw Error('invalid_invoice_source_cleanup_limit');
  const claimed = await rpc(serverMetadata,'claim_expired_invoice_receival_sources',{p_limit:limit});
  if (!Array.isArray(claimed) || claimed.length > limit) throw Error('invalid_invoice_source_cleanup_response');
  const rows = claimed.map(value => {
    if (!record(value) || typeof value.id !== 'string' || !uuid.test(value.id) || value.storageBucket !== INVOICE_RECEIVAL_SOURCE_BUCKET || typeof value.storagePath !== 'string') throw Error('invalid_invoice_source_cleanup_response');
    const parts = value.storagePath.split('/');
    if (parts.length !== 3 || !uuid.test(parts[0]) || parts[1] !== value.id || parts[2] !== 'original') throw Error('invalid_invoice_source_cleanup_response');
    return {id:value.id,storagePath:value.storagePath};
  });
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw Error('invalid_invoice_source_cleanup_response');
  const removed: string[] = [];
  for (const row of rows) {
    try {await deleteOriginal(row.storagePath);} catch {throw Error('invoice_source_cleanup_incomplete');}
    await rpc(serverMetadata,'finish_expired_invoice_receival_source_removal',{p_source_id:row.id});
    removed.push(row.id);
  }
  return {removedSourceIds:removed};
}
