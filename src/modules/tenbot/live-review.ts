import type {PurchasingCatalogItemInput} from '../purchasing/types';
import {samePurchasingVendor} from '../purchasing/catalog-records';
import {invoiceQuantityIssues, type InvoiceQuantityBasis, type InvoiceSourceQuantity} from '../inventory/invoice-quantity';

export type LocalCatalogChoice = { id: string; materialName: string; size: string; unit: string; supplier?: string; packageLabel?: string; packageQuantity?: string; packageMeasure?: string; containerType?: string };
export type LocalJobChoice = { id: string; label: string };
export type LocalDemoStatus = { mode: 'synthetic-live' | 'offline-scripted' | 'openai' | 'authenticated-receivals'; simulation: boolean; canPrepare?: boolean; canCreateCatalog?: boolean; executionEnabled?: boolean; blockedReason?: string; catalog: LocalCatalogChoice[]; jobs: LocalJobChoice[]; maxAttachmentBytes: number; mediaTypes: string[] };
export type LocalOrderDetails = { orderedBy: string; orderDate: string; location: string };
export type LocalDuplicateMatch = {recordId: string; source: 'fixture' | 'simulated'; supplier: string; status: string; materialName: string; size: string; quantityExpected: string; quantityReceived?: string; unit: string; documentReference: string | null; classification: 'possible' | 'confirmed'; recordFingerprint?: string; reason?: string};
export type LocalDuplicateReview = {fingerprint: string; matches: LocalDuplicateMatch[]; canAcknowledge: boolean; acknowledged: boolean};
export type LocalDraftRow = { lineId: string; sourceText: string; sourceQuantity?: InvoiceSourceQuantity | null; quantityBasis?: InvoiceQuantityBasis; materialId: string | null; materialName: string | null; size: string | null; quantity: string; unit: string; jobId: string | null; excluded: boolean; reasons: string[]; catalogRequest?: ProposedCatalogMaterial | null; duplicateReview?: LocalDuplicateReview | null; duplicateAcknowledgement?: string | null };
export type LocalInvoiceProvenance = {supplier: string; documentReference: string; attachmentSha256: string};
export type LocalReceivalDraft = { id: string; revision: number; hash: string; status: 'review_required' | 'approved_simulated' | 'created'; simulation: boolean; attachmentId: string; orderDetails: LocalOrderDetails; orderDetailEvidence?: Partial<Record<keyof LocalOrderDetails,{sourceRef:string;value:string}>>; missingFields: string[]; canApprove: boolean; rows: LocalDraftRow[]; durableDraftId?: string; durableHash?: string; executionEnabled?: boolean; blockReason?: string; provenance?: LocalInvoiceProvenance; catalogApprovalRequired?: boolean; reviewed?: boolean };
export type LocalRowEdit = Pick<LocalDraftRow, 'lineId' | 'materialId' | 'quantity' | 'unit' | 'jobId' | 'excluded' | 'catalogRequest' | 'duplicateAcknowledgement'>;
export type LocalAttachment = { attachmentId: string; filename: string; mediaType: string; expiresAt?: string; simulation: boolean };
export type LocalCatalogAddition = {simulation: true; sourceLineId: string; catalogId: null; material: ProposedCatalogMaterial; provenance: LocalInvoiceProvenance & {sourceText: string}};
export type LocalApproval = { draft: LocalReceivalDraft; receivals: Record<string, unknown>[]; catalogAdditions?: LocalCatalogAddition[]; createdCount: number; simulation: boolean; idempotent: boolean };
/** Proposed operation, never an existing catalog identity or a real write. */
export type ProposedCatalogMaterial = Pick<PurchasingCatalogItemInput, 'itemName' | 'vendorSku' | 'materialType' | 'size' | 'unitSize' | 'unitSizeUom' | 'packaging' | 'priceUnit' | 'notes'> & {supplier: string; prepared: boolean};
export type ReceivalLineValidation = {
  state: 'Ready' | 'Needs catalog match' | 'Invalid quantity/unit' | 'Excluded' | 'Needs review';
  fields: Partial<Record<'materialId' | 'supplier' | 'quantity' | 'unit' | 'jobId', string>>;
  holds: string[]; changed: boolean;
};
export function catalogRequestIssues(value: ProposedCatalogMaterial, invoiceSupplier?: string): Partial<Record<keyof ProposedCatalogMaterial, string>> {
  const issues: Partial<Record<keyof ProposedCatalogMaterial, string>> = {};
  for (const key of ['supplier','itemName','vendorSku','materialType','size','unitSize','unitSizeUom','packaging','priceUnit','notes'] as const) {
    if (typeof value[key] !== 'string' || value[key].length > (key === 'notes' ? 1200 : 160) || /[\u0000-\u001f\u007f]/.test(value[key])) issues[key] = 'Use bounded plain text for this catalog field.';
  }
  if (!value.supplier?.trim()) issues.supplier = 'Supplier is required.';
  else if (invoiceSupplier && !samePurchasingVendor(value.supplier,invoiceSupplier)) issues.supplier = `Invoice supplier is ${invoiceSupplier}. Choose that supplier for this proposal.`;
  if (!value.itemName?.trim()) issues.itemName = 'Material name is required.';
  if (!['chip','resin','pigment','filler','other'].includes(value.materialType)) issues.materialType = 'Choose a material type.';
  if (value.materialType === 'chip' && !value.size?.trim()) issues.size = 'Chip size is required.';
  const unit = typeof value.priceUnit === 'string' ? receivalUnit(value.priceUnit) : '';
  if (!unit) issues.priceUnit = 'A supported order unit is required.';
  const packageUnit = ['Bag','Pail','Box','Bucket','Drum','Case','Tote','Kit'].includes(unit);
  if (packageUnit || value.unitSize || value.unitSizeUom || value.packaging) {
    if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(value.unitSize) || !(Number(value.unitSize) > 0)) issues.unitSize = 'Package amount must be a positive decimal.';
    if (!['LB','GAL','KG','OZ','L'].includes(value.unitSizeUom)) issues.unitSizeUom = 'Choose the package measure.';
    if (!value.packaging?.trim() || packageUnit && receivalUnit(value.packaging) !== unit) issues.packaging = 'Container must match the proposed order unit.';
  }
  return issues;
}
/** Completing local fields prepares a proposal, never employee approval. */
export function completeCatalogRequest(value: ProposedCatalogMaterial): ProposedCatalogMaterial { return {...value,prepared:Object.keys(catalogRequestIssues(value)).length===0}; }
// Advisory display validation follows the existing invoice unit aliases; the
// caller-authorized server remains responsible for accepting every line.
export function receivalUnit(value: string): string {
  const key = value.trim().toLowerCase().replace(/\.$/, '');
  const groups: [string, string[]][] = [['Bag', ['bag', 'bags']], ['Pail', ['pail', 'pails']], ['Box', ['box', 'boxes']], ['Bucket', ['bucket', 'buckets']], ['Drum', ['drum', 'drums']], ['Case', ['case', 'cases']], ['Tote', ['tote', 'totes']], ['Kit', ['kit', 'kits']], ['Each', ['ea', 'each']], ['LB', ['lb', 'lbs', 'pound', 'pounds']], ['KG', ['kg', 'kilogram', 'kilograms']], ['GAL', ['gal', 'gallon', 'gallons']], ['L', ['l', 'liter', 'liters']], ['OZ', ['oz', 'ounce', 'ounces']]];
  return groups.find(([, aliases]) => aliases.includes(key))?.[0] || '';
}
export function receivalLineValidation(source: LocalDraftRow, row: LocalRowEdit, status: LocalDemoStatus, invoiceSupplier?: string): ReceivalLineValidation {
  const changed = reviewRowChanged(source,row);
  if (row.excluded) return { state: 'Excluded', fields: {}, holds: [], changed };
  const fields: ReceivalLineValidation['fields'] = {}, choice = status.catalog.find(item => item.id === row.materialId);
  const proposal = !row.materialId ? row.catalogRequest : null, proposalIssues = proposal ? catalogRequestIssues(proposal) : {};
  const completeProposal = Boolean(proposal?.prepared && !Object.keys(proposalIssues).length);
  if (row.materialId && row.catalogRequest) fields.materialId = 'Choose either an existing catalog material or a proposed new material.';
  else if (!choice && !completeProposal) fields.materialId = proposal ? 'Complete the new catalog material details below.' : 'Choose an existing catalog material or add its new-material details.';
  const quantityPattern = status.simulation ? /^\d+(?:\.\d+)?$/ : /^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/;
  if (!quantityPattern.test(row.quantity) || !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0) fields.quantity = status.simulation ? 'Expected quantity must be a positive decimal number.' : 'Use a positive quantity with at most 9 whole digits and 6 decimal places.';
  if (!receivalUnit(row.unit)) fields.unit = 'Enter a supported receival unit.';
  else if (choice && (!receivalUnit(choice.unit) || (status.simulation ? row.unit.trim().toLowerCase() !== choice.unit.trim().toLowerCase() : receivalUnit(row.unit) !== receivalUnit(choice.unit)))) fields.unit = choice.unit ? `Use ${choice.unit} for this catalog offer; package conversion must be reviewed.` : 'This catalog offer has no supported receival unit. Choose another offer.';
  else if (completeProposal && proposal && receivalUnit(row.unit) !== receivalUnit(proposal.priceUnit)) fields.unit = `Use ${proposal.priceUnit} for the dependent receival.`;
  if (row.jobId && !status.jobs.some(job => job.id === row.jobId)) fields.jobId = 'Choose an authorized Job from the current list, or General stock.';
  const selectedSupplier = proposal?.supplier || choice?.supplier;
  if (invoiceSupplier && selectedSupplier && !samePurchasingVendor(selectedSupplier,invoiceSupplier)) fields.supplier = `Supplier must match the invoice: ${invoiceSupplier}.`;
  const holds: string[] = [];
  const quantityCheck = invoiceQuantityIssues(source.sourceQuantity, choice ? {orderUnit:choice.unit,packageQuantity:choice.packageQuantity,packageMeasure:choice.packageMeasure,containerType:choice.containerType} : completeProposal && proposal ? {orderUnit:proposal.priceUnit,packageQuantity:proposal.unitSize,packageMeasure:proposal.unitSizeUom,containerType:proposal.packaging} : undefined, row.quantity, row.unit, source.sourceText);
  const quantityLabels: Record<string,string> = {
    missing_invoice_quantity_evidence:'Original invoice quantity/unit evidence is missing. Prepare this line again; changing the receival fields cannot replace source evidence.',
    source_quantity_mismatch:`Invoice evidence requires ${quantityCheck.basis.receivalQuantity} ${quantityCheck.basis.receivalUnit}. Correct the receival quantity; the original invoice is unchanged.`,
    source_unit_mismatch:`Invoice evidence requires the ${quantityCheck.basis.receivalUnit} receival unit.`,
    conflicting_source_quantity:'Quantities on this invoice line conflict. Clarify the container count and total material quantity before approval.',
    source_quantity_is_package_size:'The extracted quantity describes one package, not the invoice total. Clarify this line before approval.',
    incompatible_unit_or_package:'Invoice and catalog units cannot be converted from verified package evidence. Choose the exact offer or clarify this line.',
    non_exact_package_conversion:'The invoice total does not convert exactly to the catalog package. Clarify this line before approval.',
    non_integral_package_count:'The invoice total implies a fractional container. Clarify the container count before approval.',
    invoice_catalog_package_conflict:'The invoice package size conflicts with the catalog offer. Choose the exact offer or clarify this line.',
    unknown_catalog_receival_unit:'The catalog offer has no verified receival unit. Choose a supported offer.',
  };
  for (const reason of quantityCheck.reasons) {
    if (reason==='source_quantity_mismatch') fields.quantity=quantityLabels[reason];
    else if (reason==='source_unit_mismatch') fields.unit=quantityLabels[reason];
    else holds.push(quantityLabels[reason] || `Quantity evidence needs review: ${reason.replaceAll('_',' ')}.`);
  }
  if (completeProposal && !status.simulation) holds.push('Combined catalog and receival execution is unavailable on the real-data path. No write will run.');
  if (completeProposal && status.canCreateCatalog === false) holds.push('Catalog creation requires review and approval by an employee with Manage vendors and catalog permission.');
  const labels: Record<string, string> = {
    potential_duplicate: source.duplicateReview?.canAcknowledge ? 'Review the matching receival evidence below. Acknowledge a separate order, or exclude this line.' : 'A potential duplicate needs evidence review. Exclude the line if it is the same order; saving alone cannot resolve it.',
    confirmed_duplicate: 'This invoice/material already has a simulated receival. Exclude this line; acknowledgement cannot create it again.',
    confirmed_catalog_duplicate: 'A catalog addition for this material or SKU was already simulated. Use the earlier approved result or exclude this repeated proposal; acknowledgement cannot create it again.',
    duplicate_draft_line: 'Duplicate material/Job line. Change or exclude it, then save for server review.',
    duplicate_invoice_material_line: 'Repeated invoice material. Server review is required before approval.',
    duplicate_catalog_request: 'This new material is proposed more than once. Combine or exclude the duplicate, then save for server review.',
    catalog_sku_conflict: 'This supplier SKU is already associated with another material. Resolve the catalog conflict before approval.',
    existing_catalog_match: 'This material already exists in the catalog. Select the existing offer instead of creating it again.',
    incomplete_catalog_request: 'Complete the new material details, then save for review.',
    catalog_request_conflicts_with_match: 'Choose either the existing catalog material or the proposed new material, then save for review.',
    supplier_mismatch: 'The selected or proposed supplier differs from the invoice. Correct the supplier/material or exclude this line.',
    invoice_catalog_material_conflict: 'Invoice description conflicts with the catalog material. Server review is required.',
    invoice_catalog_package_conflict: 'Invoice packaging conflicts with the catalog offer. Server review is required.',
    missing_invoice_material_size: 'Invoice material size is missing. Server review is required.',
    incompatible_unit_or_package: 'Invoice quantity/package conversion needs server review.',
    non_exact_package_conversion: 'Invoice quantity is not an exact package conversion. Server review is required.',
    invalid_catalog_package: 'Catalog package details need server review.',
    non_material_line: 'This is a freight or other non-material line; exclude it from receivals.',
  };
  if (source.duplicateReview?.matches.length && source.duplicateReview.matches.every(match=>match.classification==='possible') && !(source.duplicateReview.acknowledged && row.duplicateAcknowledgement === source.duplicateReview.fingerprint && !changed)) holds.push(labels.potential_duplicate);
  if (source.duplicateReview?.matches.some(match=>match.classification==='confirmed')) holds.push(labels.confirmed_duplicate);
  for (const reason of source.reasons) {
    if (Object.hasOwn(quantityLabels,reason)) continue; // Recomputed against current edits and offer above.
    if (['invalid_quantity', 'incompatible_unit', 'unknown_job'].includes(reason)) continue;
    if (reason === 'incomplete_catalog_request' && completeProposal) continue;
    if (reason === 'catalog_request_conflicts_with_match' && !(row.materialId && row.catalogRequest)) continue;
    if (reason === 'supplier_mismatch' && invoiceSupplier && selectedSupplier) continue; // Current supplier field names the exact remaining mismatch.
    if (reason === 'potential_duplicate' && source.duplicateReview?.acknowledged && row.duplicateAcknowledgement === source.duplicateReview.fingerprint && !changed) continue;
    if (['unmatched_material', 'ambiguous_catalog_match', 'review_required'].includes(reason)) {
      if (completeProposal) continue;
      if (choice && row.materialId === source.materialId) holds.push('Confirm the exact catalog offer, then save for server review.');
      continue;
    }
    if (reason === 'missing_material_size' && (choice?.size || completeProposal && proposal?.size)) continue;
    if (reason === 'missing_invoice_material_size' && completeProposal && proposal?.size) continue;
    if (reason === 'unknown_catalog_receival_unit') { if (!choice || receivalUnit(choice.unit)) continue; }
    holds.push(labels[reason] || `Server review required: ${reason.replaceAll('_', ' ')}.`);
  }
  return { state: fields.materialId ? 'Needs catalog match' : fields.quantity || fields.unit ? 'Invalid quantity/unit' : fields.jobId || fields.supplier || holds.length ? 'Needs review' : 'Ready', fields, holds: [...new Set(holds)], changed };
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

const normalizedEdits = (rows: LocalRowEdit[]): LocalRowEdit[] => rows.map(({ lineId, materialId, quantity, unit, jobId, excluded, catalogRequest, duplicateAcknowledgement }) => ({ lineId, materialId, quantity, unit, jobId, excluded, ...(catalogRequest ? {catalogRequest: {...catalogRequest}} : {}), ...(duplicateAcknowledgement ? {duplicateAcknowledgement} : {}) }));
export function reviewRowChanged(source: LocalRowEdit, row: LocalRowEdit) { return JSON.stringify(normalizedEdits([source])) !== JSON.stringify(normalizedEdits([row])); }
export const editableRows = (draft: LocalReceivalDraft): LocalRowEdit[] => normalizedEdits(draft.rows);
export function reviewChanged(draft: LocalReceivalDraft, edits: LocalRowEdit[], details: LocalOrderDetails) {
  return JSON.stringify(editableRows(draft)) !== JSON.stringify(normalizedEdits(edits)) || JSON.stringify(draft.orderDetails) !== JSON.stringify(details);
}
export function receivalReviewNotice(draft: LocalReceivalDraft, status: LocalDemoStatus): string {
  const concerns = Object.values(receivalOrderIssues(draft.orderDetails));
  for (const [index, row] of draft.rows.entries()) {
    const validation = receivalLineValidation(row, row, status, draft.provenance?.supplier);
    const messages = [...Object.values(validation.fields), ...validation.holds];
    if (messages.length) concerns.push(`Line ${index + 1} (${row.materialName || 'Invoice line'}): ${messages.join(' ')}`);
  }
  if (!draft.rows.some(row => !row.excluded)) concerns.push('Include at least one receival line.');
  if (concerns.length) return `Review saved. Action still required: ${concerns.join(' ')}`;
  if (draft.canApprove) return `Review complete. Confirm the exact lines below to enable ${draft.simulation ? 'simulated ' : ''}approval.`;
  return draft.blockReason || 'The server did not mark this draft ready for approval. No action was approved; reopen the draft or report this review result.';
}
export function approvalForCurrentReview(draft: LocalReceivalDraft, edits: LocalRowEdit[], details: LocalOrderDetails, checked: boolean, busy: boolean) {
  const executionReady = draft.simulation || draft.executionEnabled === true && Boolean(draft.durableDraftId && draft.durableHash);
  const quantitiesReady = draft.rows.every(row=>{
    if(row.excluded)return true;
    const basis=row.quantityBasis;
    if(!basis?.receivalQuantity || !basis.receivalUnit || basis.reasons.length)return false;
    const current=invoiceQuantityIssues(row.sourceQuantity,{orderUnit:basis.receivalUnit,packageQuantity:basis.perPackage?.quantity,packageMeasure:basis.perPackage?.unit,containerType:basis.perPackage?.container},row.quantity,row.unit,row.sourceText);
    return current.basis.receivalQuantity!==null && current.reasons.length===0;
  });
  return executionReady && quantitiesReady && draft.reviewed !== false && draft.status === 'review_required' && draft.canApprove && Boolean(draft.hash) && Number.isSafeInteger(draft.revision) && draft.revision > 0 && checked && !busy && !reviewChanged(draft, edits, details);
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
