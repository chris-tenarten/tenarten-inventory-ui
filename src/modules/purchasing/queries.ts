import { supabase } from '@/lib/supabase';
import type { PurchaseOrder, PurchaseOrderDocument, PurchaseOrderLine, PurchaseOrderPendingReceivalProjection, PurchaseOrderSummary, VendorContact, VendorOption } from './types';

type DbOrder = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);
const address = (row: Record<string, unknown>) => [row.address_line_1 || row.address, row.address_line_2, [row.city, row.state, row.postal_code].filter(Boolean).join(', '), row.country].filter(Boolean).join('\n');
const contactText = (contact: VendorContact) => [contact.contactName, contact.role, contact.email, contact.phone].filter(Boolean).join(' · ');

export async function loadVendors(includeInactive = false): Promise<VendorOption[]> {
  let query = supabase.from('vendors').select('id,name,canonical_name,address,address_line_1,address_line_2,city,state,postal_code,country,phone,email,website,payment_terms,notes,is_active,contacts:vendor_contacts(id,vendor_id,contact_name,role,email,phone,notes,is_default,is_active)').order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const contacts = ((row.contacts as Array<Record<string, unknown>>) ?? []).map((item): VendorContact => ({
      id:text(item.id), vendorId:text(item.vendor_id), contactName:text(item.contact_name), role:text(item.role),
      email:text(item.email), phone:text(item.phone), notes:text(item.notes), isDefault:Boolean(item.is_default), isActive:Boolean(item.is_active),
    })).sort((a,b) => Number(b.isDefault)-Number(a.isDefault) || a.contactName.localeCompare(b.contactName));
    const defaultContact = contacts.find(item => item.isActive && item.isDefault) ?? contacts.find(item => item.isActive);
    return {
      id:text(row.id), name:text(row.name), canonicalName:text(row.canonical_name), address:address(row),
      addressLine1:text(row.address_line_1 || row.address), addressLine2:text(row.address_line_2),
      city:text(row.city), state:text(row.state), postalCode:text(row.postal_code), country:text(row.country),
      phone:text(row.phone), email:text(row.email), website:text(row.website), paymentTerms:text(row.payment_terms),
      notes:text(row.notes), contact:defaultContact ? contactText(defaultContact) : [row.contact_name,row.email,row.phone].filter(Boolean).join(' · '),
      contacts, isActive:Boolean(row.is_active),
    };
  });
}

export async function loadPurchaseOrderSummaries(): Promise<PurchaseOrderSummary[]> {
  const { data, error } = await supabase.from('purchase_orders').select('id,po_number,status,vendor_name_snapshot,order_date,requested_date,currency,total,revision_number,updated_at,lines:purchase_order_lines(id)').order('updated_at',{ascending:false});
  if (error) throw error;
  return (data ?? []).map(row => ({
    id:String(row.id), poNumber:row.po_number ? String(row.po_number) : null, status:row.status as PurchaseOrderSummary['status'],
    vendorNameSnapshot:text(row.vendor_name_snapshot), orderDate:text(row.order_date), requestedDate:text(row.requested_date),
    currency:text(row.currency), total:text(row.total), revisionNumber:Number(row.revision_number),
    updatedAt:text(row.updated_at), lineCount:Array.isArray(row.lines) ? row.lines.length : 0,
  }));
}

export async function loadPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data, error } = await supabase.from('purchase_orders').select('*,issuances:purchase_order_issuances(id,revision_number,issued_at,issued_by,snapshot_hash),lines:purchase_order_lines(*,details:chip_purchase_order_line_details(*))').eq('id',id).single();
  if (error) throw error;
  const row = data as DbOrder;
  const lines = ((row.lines as Array<Record<string,unknown>>) || []).sort((a,b) => Number(a.line_number)-Number(b.line_number)).map((line): PurchaseOrderLine => {
    const detail = (Array.isArray(line.details) ? line.details[0] : line.details) as Record<string,unknown>;
    return {
      id:text(line.id), lineNumber:Number(line.line_number), lineCategory:'chip', status:'active',
      details:{
        productionJobId:text(detail.production_job_id), catalogSource:text(detail.catalog_source) as PurchaseOrderLine['details']['catalogSource'],
        catalogItemId:text(detail.catalog_item_id), vendorSkuSnapshot:text(detail.vendor_sku_snapshot),
        materialNameSnapshot:text(detail.material_name_snapshot), chipSize:text(detail.chip_size),
        packageQuantity:text(detail.package_quantity), packageMeasure:text(detail.package_measure),
        containerType:text(detail.container_type), moistureCondition:text(detail.moisture_condition) as PurchaseOrderLine['details']['moistureCondition'],
        quantityOrdered:text(detail.quantity_ordered), orderUnit:text(detail.order_unit), unitPrice:text(detail.unit_price),
        priceBasis:text(detail.price_basis), notes:text(detail.notes),
      },
    };
  });
  const issuanceRows = ((row.issuances as Array<Record<string, unknown>>) ?? []).sort((a,b) => Number(b.revision_number)-Number(a.revision_number));
  const issuance = issuanceRows.find(item => Number(item.revision_number) === Number(row.revision_number));
  return {
    id:text(row.id), poFamilyId:text(row.po_family_id), poNumber:row.po_number ? text(row.po_number) : null,
    poCategory:'chip', status:row.status as PurchaseOrder['status'],
    documentTemplate:text(row.document_template) === 'classic' ? 'classic' : 'tenops',
    productionJobId:text(row.production_job_id), jobNumberSnapshot:text(row.job_number_snapshot), jobNameSnapshot:text(row.job_name_snapshot),
    jobPoReferenceType:(text(row.job_po_reference_type) === 'resin' ? 'resin' : text(row.job_po_reference_type) === 'chip' ? 'chip' : ''),
    vendorId:text(row.vendor_id), vendorNameSnapshot:text(row.vendor_name_snapshot), vendorAddressSnapshot:text(row.vendor_address_snapshot),
    vendorContactSnapshot:text(row.vendor_contact_snapshot), shipToSnapshot:text(row.ship_to_snapshot),
    paymentTermsSnapshot:text(row.payment_terms_snapshot), authorizedBySnapshot:text(row.authorized_by_snapshot),
    orderDate:text(row.order_date), requestedDate:text(row.requested_date), currency:text(row.currency), subtotal:text(row.subtotal),
    discountPercent:text(row.discount_percent), discountAmount:text(row.discount_amount), taxPercent:text(row.tax_percent),
    taxAmount:text(row.tax_amount), freight:text(row.freight), total:text(row.total), commercialNotes:text(row.commercial_notes),
    internalNotes:text(row.internal_notes), revisionNumber:Number(row.revision_number),
    supersedesPurchaseOrderId:text(row.supersedes_purchase_order_id), revisionReason:text(row.revision_reason),
    createdBy:text(row.created_by), updatedBy:text(row.updated_by), createdAt:text(row.created_at), updatedAt:text(row.updated_at),
    issuedAt:text(issuance?.issued_at ?? row.issued_at), issuedBy:text(issuance?.issued_by ?? row.issued_by),
    issuanceId:text(issuance?.id), snapshotHash:text(issuance?.snapshot_hash), lines,
  };
}

export async function loadPurchaseOrderDocument(issuanceId: string): Promise<PurchaseOrderDocument | null> {
  const { data, error } = await supabase.from('purchase_order_documents')
    .select('id,issuance_id,status,snapshot_hash,storage_bucket,storage_path,document_version,template_name,template_version,generation_started_at,generated_at,failed_at,last_error,attempt_count')
    .eq('issuance_id', issuanceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id:text(data.id), issuanceId:text(data.issuance_id), status:data.status as PurchaseOrderDocument['status'],
    snapshotHash:text(data.snapshot_hash), storageBucket:text(data.storage_bucket), storagePath:text(data.storage_path),
    documentVersion:text(data.document_version), templateName:text(data.template_name) === 'classic' ? 'classic' : 'tenops',
    templateVersion:Number(data.template_version), generationStartedAt:text(data.generation_started_at),
    generatedAt:text(data.generated_at), failedAt:text(data.failed_at), lastError:text(data.last_error),
    attemptCount:Number(data.attempt_count),
  };
}

export async function loadPurchaseOrderPendingReceivalProjection(
  issuanceId: string,
): Promise<PurchaseOrderPendingReceivalProjection> {
  const [{ data: issuance, error: issuanceError }, { data: existing, error: existingError }] = await Promise.all([
    supabase.from('purchase_order_issuances')
      .select('id,order_snapshot,lines_snapshot')
      .eq('id', issuanceId)
      .single(),
    supabase.from('pending_receivals')
      .select('id,source_purchase_order_line_id')
      .eq('source_purchase_order_issuance_id', issuanceId),
  ]);
  if (issuanceError) throw issuanceError;
  if (existingError) throw existingError;

  const order = (issuance.order_snapshot ?? {}) as Record<string, unknown>;
  const snapshotLines = Array.isArray(issuance.lines_snapshot)
    ? issuance.lines_snapshot as Array<Record<string, unknown>>
    : [];
  const existingByLineId = new Map(
    (existing ?? []).map(row => [text(row.source_purchase_order_line_id), text(row.id)]),
  );
  return {
    issuanceId:text(issuance.id),
    poNumber:text(order.po_number),
    vendorName:text(order.vendor_name),
    jobNumber:text(order.job_number),
    jobName:text(order.job_name),
    productionJobId:text(order.production_job_id),
    lines:snapshotLines.map((line) => {
      const sourceLineId = text(line.purchase_order_line_id);
      const material = text(line.material).trim();
      const unit = text(line.unit).trim();
      const quantity = Number(line.quantity);
      const lineKind = text(line.line_kind);
      let exclusionReason = '';
      if (lineKind !== 'chip') exclusionReason = 'This is not a supported material line.';
      else if (!Number.isFinite(quantity) || quantity <= 0) exclusionReason = 'Quantity must be greater than zero.';
      else if (!material) exclusionReason = 'Material name is missing.';
      else if (!unit) exclusionReason = 'Order unit is missing.';
      else if (!sourceLineId) exclusionReason = 'Immutable source identity is missing.';
      const pendingReceivalId = existingByLineId.get(sourceLineId) ?? '';
      return {
        sourceLineId,
        sourceLineNumber:Number(line.line_number),
        eligible:!exclusionReason,
        exclusionReason,
        alreadyCreated:Boolean(pendingReceivalId),
        pendingReceivalId,
        selected:!exclusionReason && !pendingReceivalId,
        materialName:material,
        size:text(line.chip_size),
        category:'Chip / Aggregate',
        quantityExpected:text(line.quantity),
        unit,
        eta:'',
        location:'Denton',
        vendorSku:text(line.vendor_sku),
      };
    }),
  };
}
