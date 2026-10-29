import type {PurchasingCatalogItemInput} from '../purchasing/types';

export type LocalCatalogChoice = { id: string; materialName: string; size: string; unit: string; supplier?: string; packageLabel?: string };
export type LocalJobChoice = { id: string; label: string };
export type LocalDemoStatus = { mode: 'synthetic-live' | 'offline-scripted' | 'openai' | 'authenticated-receivals'; simulation: boolean; canPrepare?: boolean; executionEnabled?: boolean; blockedReason?: string; catalog: LocalCatalogChoice[]; jobs: LocalJobChoice[]; maxAttachmentBytes: number; mediaTypes: string[] };
export type LocalOrderDetails = { orderedBy: string; orderDate: string; location: string };
export type LocalDraftRow = { lineId: string; sourceText: string; materialId: string | null; materialName: string | null; size: string | null; quantity: string; unit: string; jobId: string | null; excluded: boolean; reasons: string[] };
export type LocalReceivalDraft = { id: string; revision: number; hash: string; status: 'review_required' | 'approved_simulated' | 'created'; simulation: boolean; attachmentId: string; orderDetails: LocalOrderDetails; missingFields: string[]; canApprove: boolean; rows: LocalDraftRow[]; durableDraftId?: string; durableHash?: string; executionEnabled?: boolean; blockReason?: string };
export type LocalRowEdit = Pick<LocalDraftRow, 'lineId' | 'materialId' | 'quantity' | 'unit' | 'jobId' | 'excluded'>;
export type LocalAttachment = { attachmentId: string; filename: string; mediaType: string; expiresAt?: string; simulation: boolean };
export type LocalApproval = { draft: LocalReceivalDraft; receivals: Record<string, unknown>[]; createdCount: number; simulation: boolean; idempotent: boolean };
/** Local proposal only. This is deliberately outside the receival RPC payload. */
export type ProposedCatalogMaterial = Pick<PurchasingCatalogItemInput, 'itemName' | 'vendorSku' | 'materialType' | 'size' | 'unitSize' | 'unitSizeUom' | 'packaging' | 'priceUnit' | 'notes'> & {supplier: string; prepared: boolean};
export type ReceivalLineValidation = {
  state: 'Ready' | 'Needs catalog match' | 'Invalid quantity/unit' | 'Excluded' | 'Needs review';
  fields: Partial<Record<'materialId' | 'quantity' | 'unit' | 'jobId', string>>;
  holds: string[]; changed: boolean;
};
// Advisory display validation follows the existing invoice unit aliases; the
// caller-authorized server remains responsible for accepting every line.
export function receivalUnit(value: string): string {
  const key = value.trim().toLowerCase().replace(/\.$/, '');
  const groups: [string, string[]][] = [['Bag', ['bag', 'bags']], ['Pail', ['pail', 'pails']], ['Box', ['box', 'boxes']], ['Bucket', ['bucket', 'buckets']], ['Drum', ['drum', 'drums']], ['Case', ['case', 'cases']], ['Tote', ['tote', 'totes']], ['Kit', ['kit', 'kits']], ['Each', ['ea', 'each']], ['LB', ['lb', 'lbs', 'pound', 'pounds']], ['KG', ['kg', 'kilogram', 'kilograms']], ['GAL', ['gal', 'gallon', 'gallons']], ['L', ['l', 'liter', 'liters']], ['OZ', ['oz', 'ounce', 'ounces']]];
  return groups.find(([, aliases]) => aliases.includes(key))?.[0] || '';
}
export function receivalLineValidation(source: LocalDraftRow, row: LocalRowEdit, status: LocalDemoStatus): ReceivalLineValidation {
  const changed = JSON.stringify({ materialId: source.materialId, quantity: source.quantity, unit: source.unit, jobId: source.jobId, excluded: source.excluded }) !== JSON.stringify({ materialId: row.materialId, quantity: row.quantity, unit: row.unit, jobId: row.jobId, excluded: row.excluded });
  if (row.excluded) return { state: 'Excluded', fields: {}, holds: [], changed };
  const fields: ReceivalLineValidation['fields'] = {}, choice = status.catalog.find(item => item.id === row.materialId);
  if (!choice) fields.materialId = 'Choose an existing catalog material or prepare a new catalog request. A proposal alone cannot be received.';
  const quantityPattern = status.simulation ? /^\d+(?:\.\d+)?$/ : /^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/;
  if (!quantityPattern.test(row.quantity) || !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0) fields.quantity = status.simulation ? 'Expected quantity must be a positive decimal number.' : 'Use a positive quantity with at most 9 whole digits and 6 decimal places.';
  if (!receivalUnit(row.unit)) fields.unit = 'Enter a supported receival unit.';
  else if (choice && (!receivalUnit(choice.unit) || (status.simulation ? row.unit.trim().toLowerCase() !== choice.unit.trim().toLowerCase() : receivalUnit(row.unit) !== receivalUnit(choice.unit)))) fields.unit = choice.unit ? `Use ${choice.unit} for this catalog offer; package conversion must be reviewed.` : 'This catalog offer has no supported receival unit. Choose another offer.';
  if (row.jobId && !status.jobs.some(job => job.id === row.jobId)) fields.jobId = 'Choose an authorized Job from the current list, or General stock.';
  const holds: string[] = [];
  const labels: Record<string, string> = {
    potential_duplicate: 'Potential duplicate receival. Server review is required before approval.',
    duplicate_draft_line: 'Duplicate material/Job line. Change or exclude it, then save for server review.',
    duplicate_invoice_material_line: 'Repeated invoice material. Server review is required before approval.',
    supplier_mismatch: 'Catalog supplier differs from the invoice supplier. Server review is required.',
    invoice_catalog_material_conflict: 'Invoice description conflicts with the catalog material. Server review is required.',
    invoice_catalog_package_conflict: 'Invoice packaging conflicts with the catalog offer. Server review is required.',
    missing_invoice_material_size: 'Invoice material size is missing. Server review is required.',
    incompatible_unit_or_package: 'Invoice quantity/package conversion needs server review.',
    non_exact_package_conversion: 'Invoice quantity is not an exact package conversion. Server review is required.',
    invalid_catalog_package: 'Catalog package details need server review.',
    non_material_line: 'This is a freight or other non-material line; exclude it from receivals.',
  };
  for (const reason of source.reasons) {
    if (['invalid_quantity', 'incompatible_unit', 'unknown_job'].includes(reason)) continue;
    if (['unmatched_material', 'ambiguous_catalog_match'].includes(reason)) {
      if (choice && row.materialId === source.materialId) holds.push('Confirm the exact catalog offer, then save for server review.');
      continue;
    }
    if (reason === 'missing_material_size' && choice?.size) continue;
    if (reason === 'unknown_catalog_receival_unit') { if (!choice || receivalUnit(choice.unit)) continue; }
    holds.push(labels[reason] || `Server review required: ${reason.replaceAll('_', ' ')}.`);
  }
  return { state: fields.materialId ? 'Needs catalog match' : fields.quantity || fields.unit ? 'Invalid quantity/unit' : fields.jobId || holds.length ? 'Needs review' : 'Ready', fields, holds: [...new Set(holds)], changed };
}
export function receivalOrderIssues(details: LocalOrderDetails): Partial<Record<keyof LocalOrderDetails, string>> {
  const issues: Partial<Record<keyof LocalOrderDetails, string>> = {};
  if (!details.orderedBy.trim()) issues.orderedBy = 'Ordered by is required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(details.orderDate) || !Number.isFinite(Date.parse(details.orderDate)) || new Date(details.orderDate).toISOString().slice(0, 10) !== details.orderDate) issues.orderDate = 'Choose a valid order date.';
  if (!details.location.trim()) issues.location = 'Destination location is required.';
  return issues;
}

export const RECEIVAL_EXECUTION_BLOCKED = 'Real execution is disabled until database-backed release gates pass.';
export function receivalExecutionBlock(draft: LocalReceivalDraft, status: LocalDemoStatus): string | null {
  if (draft.simulation) return status.simulation ? null : 'The draft does not match the authenticated receivals mode. Reload before continuing.';
  if (status.simulation || status.executionEnabled !== true || draft.executionEnabled !== true) return draft.blockReason || status.blockedReason || RECEIVAL_EXECUTION_BLOCKED;
  if (!draft.durableDraftId || !draft.durableHash) return 'Save this exact draft for durable server review before approval.';
  return null;
}
/** Entry into the local candidate is explicit. Production and other origins keep
 * their existing provider path; a real JWT is verified by the local server. */
export function localAgentExperimentRequested(origin: string, search: string, authenticated: boolean): boolean {
  return authenticated && origin === 'http://localhost:3000' && new URLSearchParams(search).get('tenbotExperiment') === '1';
}
export function localReceivalCandidateRequested(origin: string, search: string, authenticated: boolean): boolean {
  return localAgentExperimentRequested(origin, search, authenticated) && new URLSearchParams(search).get('tenbotReceivals') === '1';
}

export const editableRows = (draft: LocalReceivalDraft): LocalRowEdit[] => draft.rows.map(({ lineId, materialId, quantity, unit, jobId, excluded }) => ({ lineId, materialId, quantity, unit, jobId, excluded }));
export function reviewChanged(draft: LocalReceivalDraft, edits: LocalRowEdit[], details: LocalOrderDetails) {
  return JSON.stringify(editableRows(draft)) !== JSON.stringify(edits) || JSON.stringify(draft.orderDetails) !== JSON.stringify(details);
}
export function approvalForCurrentReview(draft: LocalReceivalDraft, edits: LocalRowEdit[], details: LocalOrderDetails, checked: boolean, busy: boolean) {
  const executionReady = draft.simulation || draft.executionEnabled === true && Boolean(draft.durableDraftId && draft.durableHash);
  return executionReady && draft.status === 'review_required' && draft.canApprove && Boolean(draft.hash) && Number.isSafeInteger(draft.revision) && draft.revision > 0 && checked && !busy && !reviewChanged(draft, edits, details);
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The image could not be read.')); reader.onerror = () => reject(new Error('The image could not be read.')); reader.readAsDataURL(blob); });
}
type PreparedAttachment = { filename: string; originalFilename: string; mediaType: 'image/png' | 'image/jpeg'; dataBase64: string; preview: string; resized: boolean; renderedPdf: boolean };
export function singlePdfPageScale(pages: number, width: number, height: number) {
  if (pages !== 1) throw new Error('This demo accepts one-page PDFs. Export the invoice page as a separate PDF and try again.');
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('The PDF page size is invalid.');
  return 1024 / Math.max(width, height);
}
async function compressCanvas(source: HTMLCanvasElement | ImageBitmap, filename: string, maximumBytes: number): Promise<PreparedAttachment> {
  for (const longest of [1024, 896, 768, 640, 512]) {
    const ratio = Math.min(1, longest / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.floor(source.width * ratio)); canvas.height = Math.max(1, Math.floor(source.height * ratio));
    const drawing = canvas.getContext('2d'); if (!drawing) throw new Error('Image preparation is unavailable in this browser.');
    drawing.fillStyle = '#ffffff'; drawing.fillRect(0, 0, canvas.width, canvas.height); drawing.drawImage(source, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.76, 0.64, 0.52]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= maximumBytes) {
        const preview = await dataUrl(blob);
        return { filename, originalFilename: filename, mediaType: 'image/jpeg', dataBase64: preview.split(',')[1], preview, resized: true, renderedPdf: false };
      }
    }
  }
  throw new Error('This image cannot fit the local demo limit clearly. Crop it to the invoice and try again.');
}
/** Uses the same bundled worker strategy as existing historical-file and
 * Production PDF readers. Rendering uses no text extraction or offline OCR. */
async function preparePdfPage(file: File, maximumBytes: number): Promise<PreparedAttachment> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true, enableXfa: false, stopAtErrors: true });
  const timeout = setTimeout(() => { void task.destroy(); }, 20000);
  try {
    const pdf = await task.promise;
    if (pdf.numPages !== 1) throw new Error('This demo accepts one-page PDFs. Export the invoice page as a separate PDF and try again.');
    const page = await pdf.getPage(1), original = page.getViewport({ scale: 1 });
    if (![original.width, original.height].every(value => Number.isFinite(value) && value > 0)) throw new Error('The PDF page size is invalid.');
    const viewport = page.getViewport({ scale: singlePdfPageScale(pdf.numPages, original.width, original.height) });
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.min(1024, Math.floor(viewport.width))); canvas.height = Math.max(1, Math.min(1024, Math.floor(viewport.height)));
    const drawing = canvas.getContext('2d'); if (!drawing) throw new Error('PDF rendering is unavailable in this browser.');
    await page.render({ canvas, canvasContext: drawing, viewport, background: '#ffffff' }).promise;
    const prepared = await compressCanvas(canvas, file.name.replace(/\.pdf$/i, '') + '-page1.jpg', maximumBytes);
    return { ...prepared, originalFilename: file.name, renderedPdf: true };
  } catch (error) {
    if (error instanceof Error && /one-page PDFs|page size is invalid|rendering is unavailable|cannot fit/.test(error.message)) throw error;
    throw new Error('This PDF could not be rendered. Choose an unlocked, valid one-page PDF or a PNG/JPEG image.');
  } finally { clearTimeout(timeout); await task.destroy().catch(() => {}); }
}
/** Local browser attachment preparation only. No upload, OCR or inference occurs here. */
export async function prepareInvoiceImage(file: File, maximumBytes: number): Promise<PreparedAttachment> {
  if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) throw new Error('Choose a PNG, JPEG or one-page PDF invoice.');
  if (file.size > 12000000) throw new Error('Choose an invoice attachment smaller than 12 MB.');
  const limit = Math.min(maximumBytes, 90000);
  if (!Number.isFinite(limit) || limit <= 0) throw new Error('The local image limit is unavailable.');
  if (file.type === 'application/pdf') return preparePdfPage(file, limit);
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('This image could not be opened. Choose a valid PNG or JPEG.'); });
  try {
    if (bitmap.width <= 0 || bitmap.height <= 0 || bitmap.width * bitmap.height > 60000000) throw new Error('Choose a smaller invoice image.');
    if (file.size <= limit && bitmap.width <= 1024 && bitmap.height <= 1024) {
      const preview = await dataUrl(file);
      return { filename: file.name, originalFilename: file.name, mediaType: file.type as 'image/png' | 'image/jpeg', dataBase64: preview.split(',')[1], preview, resized: false, renderedPdf: false };
    }
    return { ...await compressCanvas(bitmap, file.name.replace(/\.[^.]+$/, '') + '.jpg', limit), originalFilename: file.name };
  } finally { bitmap.close(); }
}
