import { supabase } from '@/lib/supabase';
import { calculatePurchaseOrderTotals, centsToMoney, lineTotalCents } from './calculations';
import type { PendingReceivalCreationResult, PendingReceivalProposalLine, PurchaseOrderDraft, PurchaseOrderIssuanceResult, PurchasingCatalogItemInput, VendorContact, VendorOption } from './types';

async function throwPdfFunctionError(error: unknown): Promise<never> {
  if (typeof error === 'object' && error !== null && 'context' in error && error.context instanceof Response) {
    let detail = '';
    try {
      const body = await error.context.clone().json() as { error?:unknown };
      detail = body?.error ? String(body.error) : '';
    } catch {}
    if (detail) throw new Error(detail);
  }
  throw error;
}

export async function savePurchaseOrderDraft(draft: PurchaseOrderDraft): Promise<string> {
  const lines = draft.lines.map((line,index) => ({ id:line.id || null, line_number:index+1, production_job_id:line.details.productionJobId || null, catalog_source:line.details.catalogSource || null, catalog_item_id:line.details.catalogItemId || null, vendor_sku_snapshot:line.details.vendorSkuSnapshot || null, material_name_snapshot:line.details.materialNameSnapshot, chip_size:line.details.chipSize, package_quantity:line.details.packageQuantity || null, package_measure:line.details.packageMeasure || null, container_type:line.details.containerType || null, moisture_condition:line.details.moistureCondition || null, quantity_ordered:line.details.quantityOrdered, order_unit:line.details.orderUnit, unit_price:line.details.unitPrice || null, price_basis:line.details.priceBasis || null, notes:line.details.notes || null }));
  const { data,error } = await supabase.rpc('save_chip_purchase_order_draft_v2',{ p_order:{ id:draft.id || null, production_job_id:draft.productionJobId || null, job_number_snapshot:draft.jobNumberSnapshot || null, job_name_snapshot:draft.jobNameSnapshot || null, vendor_id:draft.vendorId || null, vendor_name_snapshot:draft.vendorNameSnapshot, vendor_address_snapshot:draft.vendorAddressSnapshot || null, vendor_contact_snapshot:draft.vendorContactSnapshot || null, ship_to_snapshot:draft.shipToSnapshot || null, payment_terms_snapshot:draft.paymentTermsSnapshot || null, authorized_by_snapshot:draft.authorizedBySnapshot || null, order_date:draft.orderDate, requested_date:draft.requestedDate || null, currency:'USD', discount_percent:draft.discountPercent || null, tax_percent:draft.taxPercent || null, freight:draft.freight || null, commercial_notes:draft.commercialNotes || null, internal_notes:draft.internalNotes || null }, p_lines:lines, p_actor:draft.createdBy.trim() });
  if (error) throw error;
  const id = String(data);
  const { error:templateError } = await supabase.rpc('set_purchase_order_document_template', {
    p_purchase_order_id:id,
    p_template_name:draft.documentTemplate || 'tenops',
    p_actor:draft.createdBy.trim(),
  });
  if (templateError) throw templateError;
  return id;
}

export async function deletePurchaseOrderDraft(id: string, actor: string): Promise<void> {
  const { error } = await supabase.rpc('delete_purchase_order_draft', { p_purchase_order_id:id, p_actor:actor.trim() });
  if (error) throw error;
}

export async function purgeTestPurchaseOrder(id: string, poNumber: string, confirmation: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('generate-purchase-order-pdf', {
    body: { action:'purge-test-purchase-order', purchaseOrderId:id, poNumber, confirmation },
  });
  if (error) await throwPdfFunctionError(error);
  if (data?.error) throw new Error(String(data.error));
  if (data?.status !== 'deleted') throw new Error('The test Purchase Order was not deleted.');
  if (data?.storageCleanupComplete === false) {
    throw new Error('The Purchase Order was deleted, but one or more test PDF files require Storage cleanup.');
  }
}

export async function issuePurchaseOrder(id: string, actor: string, expectedUpdatedAt: string): Promise<PurchaseOrderIssuanceResult> {
  const { data, error } = await supabase.rpc('issue_purchase_order', {
    p_purchase_order_id: id,
    p_actor: actor.trim(),
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('The Purchase Order was not issued. Reload and try again.');
  return {
    purchaseOrderId: String(row.purchase_order_id),
    issuanceId: String(row.issuance_id),
    issuedAt: String(row.issued_at),
    issuedBy: String(row.issued_by),
    revisionNumber: Number(row.revision_number),
    snapshotHash: String(row.snapshot_hash),
    status: 'issued',
  };
}

export async function generatePurchaseOrderPdf(issuanceId: string, actor: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('generate-purchase-order-pdf', {
    body: { action:'generate', issuanceId, actor },
  });
  if (error) await throwPdfFunctionError(error);
  if (data?.error) throw new Error(String(data.error));
  if (data?.status !== 'generated') throw new Error('Permanent PDF generation did not complete.');
}

export async function getPurchaseOrderPdfPreviewUrl(issuanceId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-purchase-order-pdf', {
    body: { action:'preview', issuanceId },
  });
  if (error) await throwPdfFunctionError(error);
  if (data?.error) throw new Error(String(data.error));
  if (!data?.url) throw new Error('The permanent Purchase Order PDF is not available.');
  return String(data.url);
}

export async function createPendingReceivalsFromPurchaseOrder(
  issuanceId: string,
  lines: PendingReceivalProposalLine[],
  actor: string,
): Promise<PendingReceivalCreationResult[]> {
  const { data, error } = await supabase.rpc('create_pending_receivals_from_purchase_order', {
    p_issuance_id:issuanceId,
    p_lines:lines.map(line => ({
      source_line_id:line.sourceLineId,
      material_name:line.materialName.trim(),
      size:line.size.trim() || null,
      category:line.category.trim() || null,
      quantity_expected:line.quantityExpected,
      unit:line.unit.trim(),
      eta:line.eta || null,
      location:line.location.trim(),
    })),
    p_actor:actor.trim(),
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(row => ({
    pendingReceivalId:String(row.pending_receival_id),
    sourceLineId:String(row.source_line_id),
    sourceLineNumber:Number(row.source_line_number),
    creationStatus:row.creation_status === 'existing' ? 'existing' : 'created',
  }));
}

export async function generatePurchaseOrderDraftPdf(draft: PurchaseOrderDraft): Promise<Blob> {
  const totals = calculatePurchaseOrderTotals(
    draft.lines.map(line => ({ quantityOrdered:line.details.quantityOrdered, unitPrice:line.details.unitPrice })),
    draft.discountPercent,
    draft.taxPercent,
    draft.freight,
  );
  const orderSnapshot = {
    po_number:draft.poNumber.trim() || 'DRAFT',
    po_date:draft.orderDate,
    originated_by:draft.createdBy,
    vendor_name:draft.vendorNameSnapshot,
    vendor_address:draft.vendorAddressSnapshot,
    vendor_contact:draft.vendorContactSnapshot,
    production_job_id:draft.productionJobId || null,
    job_number:draft.jobNumberSnapshot,
    job_name:draft.jobNameSnapshot,
    customer:'',
    ship_to:draft.shipToSnapshot,
    payment_terms:draft.paymentTermsSnapshot,
    requested_date:draft.requestedDate,
    authorized_by:draft.authorizedBySnapshot,
    commercial_notes:draft.commercialNotes,
    subtotal:centsToMoney(totals.subtotal),
    discount_percent:draft.discountPercent || null,
    discount_amount:totals.discountAmount === null ? null : centsToMoney(totals.discountAmount),
    tax_percent:draft.taxPercent || null,
    tax_amount:totals.taxAmount === null ? null : centsToMoney(totals.taxAmount),
    freight:draft.freight || null,
    total:totals.total === null ? null : centsToMoney(totals.total),
    template_name:draft.documentTemplate || 'tenops',
    template_version:1,
    document_version:'po-pdf-v2',
  };
  const linesSnapshot = draft.lines.map((line,index) => {
    const details = line.details;
    const lineTotal = lineTotalCents(details.quantityOrdered, details.unitPrice);
    return {
      line_number:index + 1,
      material:details.materialNameSnapshot,
      vendor_sku:details.vendorSkuSnapshot,
      display_description:[
        details.materialNameSnapshot,
        details.chipSize,
        [details.packageQuantity,details.packageMeasure,details.containerType].filter(Boolean).join(' '),
        details.moistureCondition,
      ].filter(Boolean).join(', '),
      quantity:details.quantityOrdered,
      unit:details.orderUnit,
      unit_price:details.unitPrice || null,
      line_total:lineTotal === null ? null : centsToMoney(lineTotal),
    };
  });
  const { data,error } = await supabase.functions.invoke('generate-purchase-order-pdf', {
    body:{ action:'draft-preview', orderSnapshot, linesSnapshot },
  });
  if (error) await throwPdfFunctionError(error);
  if (data instanceof Blob) return data;
  if (data instanceof ArrayBuffer) return new Blob([data], { type:'application/pdf' });
  throw new Error('The Draft PDF preview returned an invalid document.');
}

export async function saveVendorProfile(vendor: Partial<VendorOption> & Pick<VendorOption,'name'>): Promise<string> {
  const { data,error } = await supabase.rpc('save_vendor_profile',{ p_vendor:{ id:vendor.id || null, name:vendor.name, address_line_1:vendor.addressLine1 || null, address_line_2:vendor.addressLine2 || null, city:vendor.city || null, state:vendor.state || null, postal_code:vendor.postalCode || null, country:vendor.country || null, phone:vendor.phone || null, email:vendor.email || null, website:vendor.website || null, payment_terms:vendor.paymentTerms || null, notes:vendor.notes || null, is_active:vendor.isActive ?? true } });
  if (error) throw error;
  return String(data);
}

export async function saveVendorContact(contact: Partial<VendorContact> & Pick<VendorContact,'vendorId'|'contactName'>): Promise<string> {
  const { data,error } = await supabase.rpc('save_vendor_contact',{ p_contact:{ id:contact.id || null, vendor_id:contact.vendorId, contact_name:contact.contactName, role:contact.role || null, email:contact.email || null, phone:contact.phone || null, notes:contact.notes || null, is_default:contact.isDefault ?? false, is_active:contact.isActive ?? true } });
  if (error) throw error;
  return String(data);
}

export async function savePurchasingCatalogItem(item: PurchasingCatalogItemInput): Promise<string> {
  const { data,error } = await supabase.rpc('save_purchasing_catalog_item',{ p_item:{ id:item.id || null, vendor_id:item.vendorId, vendor_sku:item.vendorSku || null, item_name:item.itemName, category:item.category || null, size:item.size || null, unit_size:item.unitSize || null, unit_size_uom:item.unitSizeUom || null, packaging:item.packaging || null, price:item.price || null, bulk_price:item.bulkPrice || null, bulk_minimum_quantity:item.bulkMinimumQuantity || null, bulk_minimum_uom:item.bulkMinimumUom || null, truckload_price:item.truckloadPrice || null, truckload_minimum_quantity:item.truckloadMinimumQuantity || null, truckload_minimum_uom:item.truckloadMinimumUom || null, price_unit:item.priceUnit || null, lead_time_days:item.leadTimeDays || null, minimum_order_qty:item.minimumOrderQty || null, minimum_order_uom:item.minimumOrderUom || null, product_line:item.productLine || null, material_type:item.materialType || null, notes:item.notes || null, is_active:item.isActive } });
  if (error) throw error;
  return String(data);
}
