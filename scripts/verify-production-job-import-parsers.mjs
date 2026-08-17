import assert from 'node:assert/strict';
import { extractMetadataFromTextDocuments } from '../src/modules/production/providers/composite-extraction-provider.ts';
import { findMatchingProductionJob } from '../src/modules/production/job-import-matching.ts';
import { detectProductionDocumentFamily } from '../src/modules/production/providers/document-family-detector.ts';
import { extractGenericIdentifiers } from '../src/modules/production/providers/generic-identifier-parser.ts';
import { parseMaterialQuantitySheet } from '../src/modules/production/providers/material-quantity-parser.ts';
import { parsePurchaseOrder } from '../src/modules/production/providers/purchase-order-parser.ts';
import { textInReadingOrder } from '../src/modules/production/providers/pdf-text.ts';
import { parseSampleWorkOrder } from '../src/modules/production/providers/sample-work-order-parser.ts';
import { parseShopFabricationWorkOrder } from '../src/modules/production/providers/shop-fabrication-parser.ts';

// Sanitized fragments preserve the actual pdfjs structure: content-stream order is
// scrambled, while labels and values are separate positioned items on shared rows.
const shopText = textInReadingOrder([
  { str: '6/26/2026', x: 484, y: 715 },
  { str: '062626-1', x: 335, y: 714 },
  { str: 'SHOP FABRICATION WORK ORDER', x: 234, y: 732 },
  { str: 'JOB. NAME', x: 68, y: 697 },
  { str: 'T26-254-A', x: 132, y: 656 },
  { str: 'W/O #:', x: 299, y: 716 },
  { str: 'Grady Hospital', x: 131, y: 696 },
  { str: 'PLATE #:', x: 84, y: 658 },
  { str: '26-0322', x: 132, y: 715 },
  { str: 'JOB #', x: 93, y: 716 },
  { str: 'TYPE:', x: 302, y: 697 },
  { str: 'EPOXY', x: 347, y: 696 },
  { str: 'PCS:', x: 461, y: 678 },
  { str: '24', x: 528, y: 676 },
  { str: 'DUE DATE', x: 71, y: 677 },
  { str: 'W/O ITEM:', x: 282, y: 677 },
]);

assert.equal(detectProductionDocumentFamily({ text: shopText }), 'shop_work_order');
const shop = parseShopFabricationWorkOrder(shopText);
assert.equal(shop?.jobNumber?.value, '26-0322');
assert.equal(shop?.jobNumber?.confidence, 'high');
assert.equal(shop?.jobName?.value, 'Grady Hospital');
assert.equal(shop?.workOrderNumber?.value, '062626-1');
assert.equal(shop?.plateNumber?.value, 'T26-254-A');
assert.equal(shop?.productType?.value, 'EPOXY');
assert.equal(shop?.pieces?.value, '24');
assert.equal(shop?.requestedDelivery, undefined);

// Legacy/current Tenarten Shop Work Orders may omit "Fabrication" from the
// otherwise identical deterministic template heading.
const coralReefShopText = textInReadingOrder([
  { str: 'SHOP WORK ORDER', x: 234, y: 732 },
  { str: 'JOB #', x: 93, y: 716 },
  { str: '25-0730', x: 132, y: 715 },
  { str: 'W/O #:', x: 299, y: 716 },
  { str: '091225-4', x: 335, y: 714 },
  { str: 'JOB. NAME', x: 68, y: 697 },
  { str: 'CORAL REEF', x: 131, y: 696 },
  { str: 'TYPE:', x: 302, y: 697 },
  { str: 'Cement', x: 347, y: 696 },
  { str: 'PCS:', x: 461, y: 678 },
  { str: '8', x: 528, y: 676 },
  { str: 'PLATE #:', x: 84, y: 658 },
  { str: 'T25-169-A (TZ-D)', x: 132, y: 656 },
]);

assert.equal(detectProductionDocumentFamily({ text: coralReefShopText }), 'shop_work_order');
const coralReefShop = parseShopFabricationWorkOrder(coralReefShopText);
assert.equal(coralReefShop?.jobNumber?.value, '25-0730');
assert.equal(coralReefShop?.jobName?.value, 'CORAL REEF');
assert.equal(coralReefShop?.workOrderNumber?.value, '091225-4');
assert.equal(coralReefShop?.plateNumber?.value, 'T25-169-A (TZ-D)');
assert.equal(coralReefShop?.productType?.value, 'Cement');
assert.equal(coralReefShop?.pieces?.value, '8');
assert.equal(coralReefShop?.customer, undefined);
assert.equal(coralReefShop?.location, undefined);

const coralReefOnly = extractMetadataFromTextDocuments([
  { name: 'WO #091225-4.pdf', text: coralReefShopText },
]);
assert.equal(coralReefOnly.jobNumber, '25-0730');
assert.equal(coralReefOnly.jobName, 'CORAL REEF');
assert.equal(coralReefOnly.workOrderNumber, '091225-4');
assert.equal(coralReefOnly.plateNumber, 'T25-169-A (TZ-D)');
assert.equal(coralReefOnly.productType, 'Cement');
assert.equal(coralReefOnly.pieces, '8');
assert.equal(coralReefOnly.customer, '');
assert.equal(coralReefOnly.location, '');

const sampleText = textInReadingOrder([
  { str: 'Custiomer Williams', x: 39, y: 671 },
  { str: '26-0322', x: 427, y: 705 },
  { str: 'Project #', x: 375, y: 707 },
  { str: 'SAMPLE WORK ORDER', x: 105, y: 740 },
  { str: 'Grady Hospital', x: 84, y: 707 },
  { str: 'Project Name:', x: 24, y: 707 },
  { str: 'Location: Atlanta, GA', x: 44, y: 688 },
  { str: 'T26-254-A', x: 84, y: 641 },
  { str: 'FORMULA #', x: 29, y: 645 },
]);

assert.equal(detectProductionDocumentFamily({ text: sampleText }), 'sample_work_order');
const sample = parseSampleWorkOrder(sampleText);
assert.equal(sample?.jobNumber?.value, '26-0322');
assert.equal(sample?.jobName?.value, 'Grady Hospital');
assert.equal(sample?.customer?.value, 'Williams');
assert.equal(sample?.location?.value, 'Atlanta, GA');
assert.equal(sample?.plateNumber?.value, 'T26-254-A');

const materialText = textInReadingOrder([
  { str: 'Tenarten Terrazzo', x: 392, y: 710 },
  { str: 'JOB #', x: 50, y: 692 },
  { str: '26-0322', x: 139, y: 692 },
  { str: 'JOB. NAME', x: 50, y: 675 },
  { str: 'Grady Hospital', x: 139, y: 675 },
  { str: 'WO #', x: 50, y: 662 },
  { str: '062626-1', x: 139, y: 662 },
  { str: 'PLATE #:', x: 50, y: 635 },
  { str: 'T26-257-A', x: 139, y: 634 },
  { str: 'RESIN "A"', x: 50, y: 622 },
  { str: 'Terroxy', x: 139, y: 622 },
]);

assert.equal(detectProductionDocumentFamily({ text: materialText, fileName: 'WO 062626-1 MAT QTY.pdf' }), 'material_quantity_sheet');
assert.equal(parseMaterialQuantitySheet(materialText).jobNumber?.value, '26-0322');

// Sanitized coordinates mirror the embedded text structure of the two existing
// Tenarten PO formats without retaining vendor pricing or contact details.
const keyResinPurchaseOrderText = textInReadingOrder([
  { str: 'TENARTEN TERRAZZO LLC', x: 50, y: 726 },
  { str: 'PRECAST MANUFACTURING', x: 50, y: 709 },
  { str: 'PURCHASE ORDER', x: 329, y: 707 },
  { str: 'PO Date', x: 335, y: 680 },
  { str: 'PO #', x: 504, y: 680 },
  { str: '7/14/26', x: 331, y: 663 },
  { str: '0421-001', x: 485, y: 662 },
  { str: 'PROJECT INFORMATION', x: 252, y: 550 },
  { str: 'JOB REFERENCE', x: 49, y: 534 },
  { str: 'JOB NUMBER', x: 211, y: 534 },
  { str: 'SHIP TO:', x: 315, y: 534 },
  { str: 'McCullough JHS', x: 81, y: 518 },
  { str: '26-0421', x: 249, y: 518 },
  { str: '2933 EISENHOWER ST., SUITE 120', x: 330, y: 518 },
  { str: 'PAYMENT TERMS', x: 49, y: 502 },
  { str: 'SHIP DATE REQUESTED', x: 211, y: 502 },
  { str: 'CARROLLTON, TX 75007', x: 330, y: 502 },
  { str: 'Net 30', x: 121, y: 485 },
  { str: '7/20/2026', x: 244, y: 485 },
  { str: 'ITEM', x: 49, y: 469 },
]);

assert.equal(detectProductionDocumentFamily({ text: keyResinPurchaseOrderText }), 'purchase_order');
assert.equal(detectProductionDocumentFamily({ text: 'TENARTEN TERRAZZO PURCHASE ORDER' }), 'purchase_order');
assert.equal(detectProductionDocumentFamily({ text: 'TENARTEN TERRAZZO LLC\nPRECAST MANUFACTURING PURCHASE ORDER' }), 'purchase_order');
const keyResinPurchaseOrder = parsePurchaseOrder(keyResinPurchaseOrderText);
assert.equal(keyResinPurchaseOrder.jobNumber?.value, '26-0421');
assert.equal(keyResinPurchaseOrder.jobName?.value, 'McCullough JHS');
assert.equal(keyResinPurchaseOrder.requestedDelivery?.value, '2026-07-20');
const keyResinPurchaseOrderOnly = extractMetadataFromTextDocuments([{ name: 'existing-document.pdf', text: keyResinPurchaseOrderText }]);
assert.equal(keyResinPurchaseOrderOnly.jobNumber, '26-0421');
assert.equal(keyResinPurchaseOrderOnly.jobName, 'McCullough JHS');
assert.equal(keyResinPurchaseOrderOnly.requestedDelivery, '2026-07-20');
assert.equal(keyResinPurchaseOrderOnly.customer, '');
assert.equal(keyResinPurchaseOrderOnly.plateNumber, '');
assert.equal(keyResinPurchaseOrderOnly.workOrderNumber, '');

const terrazzoMarblePurchaseOrderText = textInReadingOrder([
  { str: 'TENARTEN TERRAZZO', x: 50, y: 722 },
  { str: 'PURCHASE ORDER', x: 347, y: 712 },
  { str: 'PRECAST MANUFACTURING', x: 50, y: 705 },
  { str: 'PO #', x: 504, y: 691 },
  { str: '0430-001', x: 485, y: 674 },
  { str: 'PROJECT INFORMATION', x: 252, y: 546 },
  { str: 'JOB REFERENCE', x: 49, y: 531 },
  { str: 'JOB NUMBER', x: 211, y: 531 },
  { str: 'SHIP TO:', x: 315, y: 531 },
  { str: 'Boston City Hall', x: 98, y: 514 },
  { str: '26-0430', x: 249, y: 514 },
  { str: '2933 EISENHOWER ST., SUITE 120', x: 330, y: 514 },
  { str: 'PAYMENT TERMS', x: 49, y: 498 },
  { str: 'DATE REQUESTED', x: 211, y: 498 },
  { str: 'CARROLLTON, TX 75007', x: 330, y: 498 },
  { str: 'Net 30', x: 121, y: 481 },
  { str: '7/13/2026', x: 244, y: 481 },
  { str: 'ITEM', x: 49, y: 466 },
]);

assert.equal(detectProductionDocumentFamily({ text: terrazzoMarblePurchaseOrderText }), 'purchase_order');
const terrazzoMarblePurchaseOrder = extractMetadataFromTextDocuments([{ name: 'supporting-record.pdf', text: terrazzoMarblePurchaseOrderText }]);
assert.equal(terrazzoMarblePurchaseOrder.jobNumber, '26-0430');
assert.equal(terrazzoMarblePurchaseOrder.jobName, 'Boston City Hall');
assert.equal(terrazzoMarblePurchaseOrder.requestedDelivery, '2026-07-13');

const poWithGenericFill = extractMetadataFromTextDocuments([{ name: 'document.pdf', text: `${terrazzoMarblePurchaseOrderText}\nCustomer\nGeneral Contractor` }]);
assert.equal(poWithGenericFill.jobNumber, '26-0430', 'Generic parsing must not overwrite the PO parser result');
assert.equal(poWithGenericFill.customer, 'General Contractor', 'Generic parsing should fill a canonical field omitted by the PO parser');

const genericOnly = extractGenericIdentifiers('JOB #\n27-0001\nCustomer\nGeneric Customer');
assert.equal(genericOnly.jobNumber?.value, '27-0001');
assert.equal(genericOnly.jobNumber?.confidence, 'medium');
assert.equal(genericOnly.customer?.value, 'Generic Customer');

const unknownIdentifiers = extractMetadataFromTextDocuments([{ name: 'supporting-record.pdf', text: [
  'JOB #', '27-0001',
  'Estimate No.', 'Q27-0042-1.0',
  'W/O #', '070127-2',
  'Color Plate #', 'T27-042-A',
].join('\n') }]);
assert.equal(unknownIdentifiers.jobNumber, '27-0001');
assert.equal(unknownIdentifiers.estimateNumber, 'Q27-0042-1.0');
assert.equal(unknownIdentifiers.workOrderNumber, '070127-2');
assert.equal(unknownIdentifiers.plateNumber, 'T27-042-A');
assert.equal(unknownIdentifiers.confidence.jobNumber, 'medium');

const corroborated = extractMetadataFromTextDocuments([
  { name: 'first.pdf', text: 'Job #\n27-9999' },
  { name: 'second.pdf', text: 'Job Number\n27-0001' },
  { name: 'third.pdf', text: 'Project #\n27-0001' },
]);
assert.equal(corroborated.jobNumber, '27-0001', 'Matching values from multiple files should corroborate');

const scalarConflict = extractMetadataFromTextDocuments([
  { name: 'first.pdf', text: 'Job #\n27-0001' },
  { name: 'second.pdf', text: 'Job #\n27-0002' },
]);
assert.equal(scalarConflict.jobNumber, '27-0001', 'Equal evidence should retain stable file order');

const multiplePlates = extractMetadataFromTextDocuments([
  { name: 'first.pdf', text: 'Plate #\nT27-001-A\nColor Plate No.\nT27-001-B' },
  { name: 'second.pdf', text: 'Color Plate Number\nT27-001-A' },
]);
assert.equal(multiplePlates.plateNumber, 'T27-001-A, T27-001-B');

const combined = extractMetadataFromTextDocuments([
  { name: 'WO 062626-1 MAT QTY.pdf', text: materialText },
  { name: 'T26-254-A.pdf', text: sampleText },
  { name: 'WO 062626-1 Grady Hospital.pdf', text: shopText },
  { name: 'unsupported.pdf', text: 'Unrelated supporting document' },
]);
assert.equal(combined.jobNumber, '26-0322');
assert.equal(combined.jobName, 'Grady Hospital');
assert.equal(combined.customer, 'Williams');
assert.equal(combined.workOrderNumber, '062626-1');
assert.equal(combined.plateNumber, 'T26-254-A, T26-257-A', 'Distinct legitimate plates should survive family reconciliation');
assert.equal(combined.location, 'Atlanta, GA');
assert.equal(combined.requestedDelivery, '');

assert.equal(detectProductionDocumentFamily({ text: 'Unrelated vendor invoice', fileName: 'invoice.pdf' }), null);
assert.equal(detectProductionDocumentFamily({ text: 'Unrelated vendor invoice', fileName: 'PO 0421-001.pdf' }), null, 'PO filenames must not drive classification');
assert.equal(extractMetadataFromTextDocuments([{ name: 'invoice.pdf', text: 'JOB #\n99-9999\nUnrelated vendor invoice' }]).jobNumber, '99-9999');

const specializedBeatsGeneric = extractMetadataFromTextDocuments([
  { name: 'shop.pdf', text: shopText },
  { name: 'unknown.pdf', text: 'Job #\n99-9999' },
]);
assert.equal(specializedBeatsGeneric.jobNumber, '26-0322');

const matchBase = {
  id: 'existing', name: 'Existing', customer: null, job_number: null, estimate_number: 'Q27-0042-1.0',
  work_order_number: null, color_plate_number: 'T27-042-A, T27-042-B',
};
assert.equal(findMatchingProductionJob([matchBase], unknownIdentifiers)?.matchedBy, 'estimate_number');
assert.equal(findMatchingProductionJob([{ ...matchBase, estimate_number: null }], unknownIdentifiers)?.matchedBy, 'plate_number');
console.log('Production Job import real-structure parser checks passed.');
