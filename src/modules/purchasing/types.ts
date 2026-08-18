export type PurchaseOrderStatus = 'draft' | 'issued' | 'cancelled' | 'superseded';
export type PurchaseOrderCategory = 'chip';
export type PurchaseOrderTemplate = 'classic' | 'tenops';
export type JobPurchaseOrderReferenceType = '' | 'resin' | 'chip';
export type MoistureCondition = '' | 'dry' | 'damp' | 'wet';
export type CatalogSource = 'standard' | 'specialty';

export type VendorContact = { id: string; vendorId: string; contactName: string; role: string; email: string; phone: string; notes: string; isDefault: boolean; isActive: boolean };
export type VendorOption = { id: string; name: string; canonicalName: string; address: string; addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string; country: string; phone: string; email: string; website: string; paymentTerms: string; notes: string; contact: string; contacts: VendorContact[]; isActive: boolean };
export type ChipPurchaseOrderLineDetails = {
  productionJobId: string; catalogSource: CatalogSource | ''; catalogItemId: string; vendorSkuSnapshot: string;
  materialNameSnapshot: string; chipSize: string; packageQuantity: string; packageMeasure: string;
  containerType: string; moistureCondition: MoistureCondition; quantityOrdered: string; orderUnit: string;
  unitPrice: string; priceBasis: string; notes: string;
};
export type PurchaseOrderLine = { id?: string; lineNumber: number; lineCategory: 'chip'; status: 'active'; details: ChipPurchaseOrderLineDetails };
export type PurchaseOrder = {
  id: string; poFamilyId: string; poNumber: string | null; poCategory: PurchaseOrderCategory; status: PurchaseOrderStatus; documentTemplate?: PurchaseOrderTemplate;
  productionJobId: string; jobNumberSnapshot: string; jobNameSnapshot: string; jobPoReferenceType: JobPurchaseOrderReferenceType;
  vendorId: string; vendorNameSnapshot: string; vendorAddressSnapshot: string; vendorContactSnapshot: string;
  shipToSnapshot: string; paymentTermsSnapshot: string; authorizedBySnapshot: string;
  orderDate: string; requestedDate: string; currency: string; subtotal: string;
  discountPercent: string; discountAmount: string; taxPercent: string; taxAmount: string; freight: string; total: string;
  commercialNotes: string; internalNotes: string; revisionNumber: number; supersedesPurchaseOrderId: string; revisionReason: string;
  createdBy: string; updatedBy: string; createdAt: string; updatedAt: string; issuedAt: string; issuedBy: string;
  issuanceId: string; snapshotHash: string; lines: PurchaseOrderLine[];
};
export type PurchaseOrderDraft = Omit<PurchaseOrder, 'id'|'poFamilyId'|'poNumber'|'poCategory'|'status'|'subtotal'|'discountAmount'|'taxAmount'|'total'|'revisionNumber'|'createdAt'|'updatedAt'|'lines'> & {
  id?: string; poNumber: string; status: 'draft'|'issued'; revisionNumber: number; supersedesPurchaseOrderId: string; revisionReason: string;
  updatedAt: string; lines: PurchaseOrderLine[];
};
export type PurchaseOrderIssuanceResult = {
  purchaseOrderId: string; issuanceId: string; issuedAt: string; issuedBy: string;
  revisionNumber: number; snapshotHash: string; status: 'issued';
};
export type PurchaseOrderDocumentStatus = 'pending' | 'generating' | 'generated' | 'failed';
export type PurchaseOrderDocument = {
  id: string; issuanceId: string; status: PurchaseOrderDocumentStatus; snapshotHash: string;
  storageBucket: string; storagePath: string; documentVersion: string; templateName: PurchaseOrderTemplate; templateVersion: number;
  generationStartedAt: string; generatedAt: string; failedAt: string; lastError: string; attemptCount: number;
};
export type PendingReceivalProposalLine = {
  sourceLineId: string; sourceLineNumber: number; eligible: boolean; exclusionReason: string;
  alreadyCreated: boolean; pendingReceivalId: string; selected: boolean;
  materialName: string; size: string; category: string; quantityExpected: string;
  unit: string; eta: string; location: string; vendorSku: string;
};
export type PurchaseOrderPendingReceivalProjection = {
  issuanceId: string; poNumber: string; vendorName: string; jobNumber: string;
  jobName: string; productionJobId: string; lines: PendingReceivalProposalLine[];
};
export type PendingReceivalCreationResult = {
  pendingReceivalId: string; sourceLineId: string; sourceLineNumber: number;
  creationStatus: 'created' | 'existing';
};
export type PurchaseOrderSummary = Pick<PurchaseOrder,'id'|'poNumber'|'status'|'vendorNameSnapshot'|'orderDate'|'requestedDate'|'currency'|'total'|'revisionNumber'|'updatedAt'> & { lineCount: number };
export type PriceSuggestion = { source: 'prior_exact'|'prior_partial'|'catalog'; amount: string; label: string; detail: string; purchaseOrderId?: string };
export type PurchasingCatalogSuggestion = {
  source: CatalogSource; id: string; vendor: string; vendorSku: string; materialName: string; chipSize: string;
  packageQuantity: string; packageMeasure: string; containerType: string; materialType: string;
  referencePrice: string; bulkPrice: string; bulkMinimumQuantity: string; bulkMinimumUom: string;
  truckloadPrice: string; truckloadMinimumQuantity: string; truckloadMinimumUom: string;
  priceBasis: string; leadTimeDays: number | null; minimumOrder: string; score: number;
};
export type PurchasingCatalogItemInput = { id?: string; vendorId: string; vendorSku: string; itemName: string; category: string; size: string; unitSize: string; unitSizeUom: string; packaging: string; price: string; bulkPrice: string; bulkMinimumQuantity: string; bulkMinimumUom: string; truckloadPrice: string; truckloadMinimumQuantity: string; truckloadMinimumUom: string; priceUnit: string; leadTimeDays: string; minimumOrderQty: string; minimumOrderUom: string; productLine: string; materialType: string; notes: string; isActive: boolean };
