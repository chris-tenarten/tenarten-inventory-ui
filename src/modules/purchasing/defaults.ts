import type { PurchaseOrderDraft, PurchaseOrderLine } from './types';

export const localDateInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function createChipLine(lineNumber = 1): PurchaseOrderLine {
  return {
    lineNumber,
    lineCategory:'chip',
    status:'active',
    details:{
      productionJobId:'',
      catalogSource:'',
      catalogItemId:'',
      vendorSkuSnapshot:'',
      materialNameSnapshot:'',
      chipSize:'',
      packageQuantity:'',
      packageMeasure:'LB',
      containerType:'Bag',
      moistureCondition:'dry',
      quantityOrdered:'',
      orderUnit:'Bag',
      unitPrice:'',
      priceBasis:'',
      notes:'',
    },
  };
}

export function createPurchaseOrderDraft(): PurchaseOrderDraft {
  return {
    poNumber:'',
    status:'draft',
    documentTemplate:'tenops',
    revisionNumber:1,
    supersedesPurchaseOrderId:'',
    revisionReason:'',
    productionJobId:'',
    jobNumberSnapshot:'',
    jobNameSnapshot:'',
    vendorId:'',
    vendorNameSnapshot:'',
    vendorAddressSnapshot:'',
    vendorContactSnapshot:'',
    shipToSnapshot:'2933 EISENHOWER ST., SUITE 120\nCARROLLTON, TX 75007\nAttn. Marcos Alvarado',
    paymentTermsSnapshot:'Net 30',
    authorizedBySnapshot:'Anthony Iorio · 469-491-7002 · sales@tenartenterrazzo.com',
    orderDate:localDateInput(),
    requestedDate:'',
    currency:'USD',
    discountPercent:'',
    taxPercent:'',
    freight:'',
    commercialNotes:'Please confirm price and notify us when the order is ready to ship.',
    internalNotes:'',
    createdBy:'AI',
    updatedBy:'',
    updatedAt:'',
    issuedAt:'',
    issuedBy:'',
    issuanceId:'',
    snapshotHash:'',
    lines:[createChipLine()],
  };
}
