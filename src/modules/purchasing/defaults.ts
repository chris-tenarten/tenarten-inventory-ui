import type { ChipPurchaseOrderLineDetails, PurchaseOrderDraft, PurchaseOrderLine } from './types';

type ClassifiedMaterialType = Exclude<PurchaseOrderLine['materialType'], ''>;

export const purchaseOrderMaterialDefaults: Record<ClassifiedMaterialType, Pick<ChipPurchaseOrderLineDetails, 'packageQuantity' | 'packageMeasure' | 'containerType' | 'orderUnit'>> = {
  chip: { packageQuantity:'50', packageMeasure:'LB', containerType:'Bag', orderUnit:'Bag' },
  resin: { packageQuantity:'5', packageMeasure:'GAL', containerType:'Pail', orderUnit:'gal' },
  pigment: { packageQuantity:'', packageMeasure:'', containerType:'', orderUnit:'' },
  filler: { packageQuantity:'', packageMeasure:'', containerType:'', orderUnit:'' },
  other: { packageQuantity:'', packageMeasure:'', containerType:'', orderUnit:'' },
};

export function applyPurchaseOrderMaterialDefaults(
  details: ChipPurchaseOrderLineDetails,
  materialType: ClassifiedMaterialType,
  previousMaterialType: PurchaseOrderLine['materialType'] = '',
): ChipPurchaseOrderLineDetails {
  const defaults = purchaseOrderMaterialDefaults[materialType];
  const previousDefaults = previousMaterialType ? purchaseOrderMaterialDefaults[previousMaterialType] : null;
  const packageIsBlank = !details.packageQuantity && !details.packageMeasure;
  const packageUsesPreviousDefault = Boolean(previousDefaults)
    && details.packageQuantity === previousDefaults?.packageQuantity
    && details.packageMeasure.toUpperCase() === previousDefaults?.packageMeasure.toUpperCase();
  const containerUsesPreviousDefault = Boolean(previousDefaults)
    && details.containerType.toLowerCase() === previousDefaults?.containerType.toLowerCase();
  const orderUnitUsesPreviousDefault = Boolean(previousDefaults)
    && details.orderUnit.toLowerCase() === previousDefaults?.orderUnit.toLowerCase();
  return {
    ...details,
    packageQuantity: packageIsBlank || packageUsesPreviousDefault ? defaults.packageQuantity : details.packageQuantity,
    packageMeasure: packageIsBlank || packageUsesPreviousDefault ? defaults.packageMeasure : details.packageMeasure,
    containerType: !details.containerType || containerUsesPreviousDefault ? defaults.containerType : details.containerType,
    orderUnit: materialType === 'chip' || !details.orderUnit || orderUnitUsesPreviousDefault ? defaults.orderUnit : details.orderUnit,
  };
}

export const localDateInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function createChipLine(lineNumber = 1): PurchaseOrderLine {
  return {
    lineNumber,
    lineCategory:'chip',
    materialType:'',
    status:'active',
    details:{
      productionJobId:'',
      catalogSource:'',
      catalogItemId:'',
      vendorSkuSnapshot:'',
      materialNameSnapshot:'',
      chipSize:'',
      resinColor:'',
      componentType:'',
      packageQuantity:'',
      packageMeasure:'',
      containerType:'',
      moistureCondition:'',
      quantityOrdered:'',
      orderUnit:'',
      unitPrice:'',
      priceBasis:'',
      notes:'',
    },
  };
}

export function createPurchaseOrderMaterialLine(
  materialType: ClassifiedMaterialType,
  lineNumber = 1,
): PurchaseOrderLine {
  const line = createChipLine(lineNumber);
  return {
    ...line,
    materialType,
    details: applyPurchaseOrderMaterialDefaults(line.details, materialType),
  };
}

export function createPurchaseOrderDraft(): PurchaseOrderDraft {
  return {
    poNumber:'',
    status:'draft',
    pdfTextSize:'standard',
    documentTemplate:'tenops',
    revisionNumber:1,
    supersedesPurchaseOrderId:'',
    revisionReason:'',
    productionJobId:'',
    jobNumberSnapshot:'',
    jobNameSnapshot:'',
    jobPoReferenceType:'',
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
