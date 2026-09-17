import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { combinePurchasingCatalogRecords } from '../src/modules/purchasing/catalog-records.ts';
import { applyPurchaseOrderMaterialDefaults, createChipLine, createPurchaseOrderDraft, createPurchaseOrderMaterialLine } from '../src/modules/purchasing/defaults.ts';
import { suggestedPartBQuantity } from '../src/modules/purchasing/resin-assist.ts';
import { validatePurchaseOrderDraft } from '../src/modules/purchasing/validation.ts';
import { lineTotalCents } from '../src/modules/purchasing/calculations.ts';
import { buildPurchaseOrderLineDescription, buildPurchaseOrderPdfModel } from '../supabase/functions/_shared/purchase-order-pdf-model.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [migration, taxonomyMigration, recoveryMigration, editor, mutations, queries, catalog, catalogEditor, pdfRenderer, recovery] = await Promise.all([
  read('../supabase/migrations/20260908_002_purchase_order_line_material_types.sql'),
  read('../supabase/migrations/20260917_004_purchase_order_material_taxonomy.sql'),
  read('../supabase/migrations/20260917_005_purchase_order_recovery_idempotency.sql'),
  read('../src/modules/purchasing/PurchaseOrderEditor.tsx'),
  read('../src/modules/purchasing/mutations.ts'),
  read('../src/modules/purchasing/queries.ts'),
  read('../src/modules/purchasing/catalog.ts'),
  read('../src/modules/purchasing/CatalogItemEditor.tsx'),
  read('../supabase/functions/generate-purchase-order-pdf/index.ts'),
  read('./recover-anthony-hermes-po.mjs'),
]);

for (const fragment of [
  'purchase_order_lines add column if not exists material_type',
  "material_type in ('chip','resin')",
  'add column if not exists resin_color',
  'add column if not exists component_type',
  'alter column chip_size drop not null',
  "lines.material_type = 'chip'",
  "'line_kind', lines.material_type",
  "'resin_color', details.resin_color",
  "'component_type', details.component_type",
  "not in ('chip','resin')",
]) assert.match(migration, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(migration, /update public\.purchase_order_issuances|update public\.pending_receivals/);
assert.doesNotMatch(migration, /purchase_orders[^;]*add column[^;]*order_type/is);
assert.match(taxonomyMigration, /'chip','resin','pigment','filler','other'/);
assert.doesNotMatch(taxonomyMigration, /update public\.purchase_order_issuances/);
assert.match(migration, /tenops_create_pending_receivals_from_po_impl\(uuid,jsonb,text\)/);
assert.doesNotMatch(migration, /pg_get_functiondef\(to_regprocedure\('public\.create_pending_receivals_from_purchase_order/);
assert.match(editor, /Material Type/);
assert.match(editor, /Add Chip Line/);
assert.match(editor, /\['resin','pigment','filler','other'\]/);
assert.match(editor, /'pigment', 'filler', 'other'/);
assert.match(editor, /Use 5:1 Part B suggestion/);
assert.match(editor, /Select a Catalog package size/);
assert.doesNotMatch(editor, /placeholder="5 gal or 50 lb"/);
assert.match(editor, /line\.materialType && line\.materialType !== 'chip' && <label[\s\S]*?Quantity Unit/);
assert.doesNotMatch(editor, /input value="Bag" readOnly/);
assert.match(editor, /materialType=\{line\.materialType \|\| 'chip'\}/);
assert.match(mutations, /material_type:line\.materialType/);
assert.match(mutations, /resin_color:line\.details\.resinColor/);
assert.match(mutations, /save_purchasing_catalog_item_v2/);
assert.match(queries, /category:lineKind === 'chip' \? 'Chip \/ Aggregate'/);
assert.match(catalog, /searchPurchasingCatalog[\s\S]*materialType/);
assert.match(catalogEditor, /materialType: existing\?\.materialType \|\| materialType/);
assert.doesNotMatch(catalogEditor, /materialType:\s*"chip",/);
assert.match(pdfRenderer, /model\.lineLayout === "material-aware"/);
assert.match(recovery, /recover_purchase_order_draft_v2/);
assert.match(recovery, /RECOVER_EVIDENCE_BACKED_UNNUMBERED_DRAFT/);
assert.match(recovery, /p_recovery_key:recoveryKey/);
assert.match(recoveryMigration, /pg_advisory_xact_lock/);
assert.match(recoveryMigration, /purchase_orders_recovery_key_unique_idx/);
assert.match(recovery, /assert\.equal\(recovered\.po_number,null\)/);

const partA = {...createChipLine(1), materialType:'resin', details:{...createChipLine(1).details, componentType:'Part A', quantityOrdered:'100'}};
const partB = {...createChipLine(2), materialType:'resin', details:{...createChipLine(2).details, componentType:'Part B / Hardener', quantityOrdered:'17'}};
assert.equal(suggestedPartBQuantity([partA, partB], 1), '20');
assert.equal(partB.details.quantityOrdered, '17', 'The assist must not overwrite an intentional value');
assert.equal(suggestedPartBQuantity([{...partA, details:{...partA.details, quantityOrdered:'25'}}, partB], 1), '5');

const draft = createPurchaseOrderDraft();
draft.vendorNameSnapshot = 'Vendor'; draft.createdBy = 'AI'; draft.lines = [partA, partB];
assert.equal(validatePurchaseOrderDraft(draft).some(error => /size is required/i.test(error)), false);
const chip = {...createChipLine(1), materialType:'chip', details:{...createChipLine(1).details, materialNameSnapshot:'Marble', quantityOrdered:'1', orderUnit:'bag'}};
draft.lines = [chip];
assert.equal(validatePurchaseOrderDraft(draft).some(error => /size is required for a Chip line/i.test(error)), true);
chip.details.chipSize = '#1'; chip.details.orderUnit = 'lb';
assert.equal(validatePurchaseOrderDraft({...draft, lines:[chip]}).some(error => /quantity unit must be Bag/i.test(error)), true);

const standard = [{id:'chip',vendor:'T&M',item_name:'Marble Chip',size:'#1',category:'Aggregate',material_class:'Marble',unit:'50 LB Bag'}];
const specialty = [{id:'resin',vendor_name:'T&M',item_name:'Terroxy Resin',canonical_item_name:'Terroxy Resin',material_type:'resin',category:'Resin',color:'Sandy Ridge',component_type:'Part A',packaging:'5 gal pail',is_active:true}];
assert.deepEqual(combinePurchasingCatalogRecords(standard, specialty, '', 'chip').map(item => item.id), ['chip']);
assert.deepEqual(combinePurchasingCatalogRecords(standard, specialty, '', 'resin').map(item => item.id), ['resin']);
assert.equal(combinePurchasingCatalogRecords(standard, specialty, '', 'chip')[0].orderUnit, 'Bag');
assert.equal(lineTotalCents('25', '23.30'), 58250);
assert.equal(lineTotalCents('100', '2.46') + lineTotalCents('20', '2.71'), 30020, 'Anthony recovery fixture must total $300.20');
const recoveryDraft = createPurchaseOrderDraft();
recoveryDraft.productionJobId = '38552df8-5a2f-4179-88af-4bd47f2c12bf';
recoveryDraft.jobNumberSnapshot = '26-0808';
recoveryDraft.jobNameSnapshot = 'Hermes - Manhasset, NY';
recoveryDraft.vendorId = '303c94f8-9849-432d-b36d-264b81b923f3';
recoveryDraft.vendorNameSnapshot = 'DCS Inc.';
recoveryDraft.orderDate = '2026-09-15';
recoveryDraft.requestedDate = '2026-09-25';
recoveryDraft.createdBy = 'Anthony Iorio';
recoveryDraft.lines = [['100','50','2.46'],['20','20','2.71']].map(([quantity, packageQuantity, unitPrice], index) => ({
  ...createPurchaseOrderMaterialLine('pigment', index + 1),
  details:{...createPurchaseOrderMaterialLine('pigment', index + 1).details, productionJobId:recoveryDraft.productionJobId, materialNameSnapshot:'Dry Cement Pigment', chipSize:'', packageQuantity, packageMeasure:'LB', containerType:'Bag', quantityOrdered:quantity, orderUnit:'bag', unitPrice, notes:'Color #188 Hershey Bar Lot match'},
}));
assert.deepEqual(validatePurchaseOrderDraft(recoveryDraft), []);
assert.equal(recoveryDraft.poNumber, '');
assert.equal(recoveryDraft.lines.reduce((sum, line) => sum + lineTotalCents(line.details.quantityOrdered, line.details.unitPrice), 0), 30020);

const defaultChip = createPurchaseOrderMaterialLine('chip');
assert.deepEqual(
  [defaultChip.details.packageQuantity, defaultChip.details.packageMeasure, defaultChip.details.containerType, defaultChip.details.orderUnit],
  ['50', 'LB', 'Bag', 'Bag'],
);
const defaultResin = createPurchaseOrderMaterialLine('resin');
assert.deepEqual(
  [defaultResin.details.packageQuantity, defaultResin.details.packageMeasure, defaultResin.details.containerType, defaultResin.details.orderUnit],
  ['5', 'GAL', 'Pail', 'gal'],
);
const customResin = applyPurchaseOrderMaterialDefaults(
  {...defaultResin.details, packageQuantity:'55', packageMeasure:'GAL', containerType:'Drum', orderUnit:'lb'},
  'resin',
  'resin',
);
assert.deepEqual(
  [customResin.packageQuantity, customResin.packageMeasure, customResin.containerType, customResin.orderUnit],
  ['55', 'GAL', 'Drum', 'lb'],
  'Material defaults must not overwrite explicit line values',
);
const switchedToResin = applyPurchaseOrderMaterialDefaults(defaultChip.details, 'resin', 'chip');
assert.deepEqual(
  [switchedToResin.packageQuantity, switchedToResin.packageMeasure, switchedToResin.containerType, switchedToResin.orderUnit],
  ['5', 'GAL', 'Pail', 'gal'],
  'Untouched source defaults should follow a deliberate material-type switch',
);
for (const materialType of ['pigment','filler','other']) {
  const generic = createPurchaseOrderMaterialLine(materialType);
  generic.details.materialNameSnapshot = materialType === 'pigment' ? 'Dry Cement Pigment' : materialType;
  generic.details.quantityOrdered = '1';
  generic.details.orderUnit = 'bag';
  assert.equal(validatePurchaseOrderDraft({...draft, lines:[generic]}).some(error => /size is required/i.test(error)), false);
}
assert.deepEqual(
  [createChipLine().details.packageQuantity, createChipLine().details.containerType, createChipLine().details.orderUnit],
  ['', '', ''],
  'Unclassified and historical-line factories must remain un-defaulted',
);

const resinDescription = buildPurchaseOrderLineDescription({line_kind:'resin',material:'Terroxy Resin',resin_color:'Sandy Ridge',component_type:'Part A',container_size:'5 gal',container:'pail',notes:''});
assert.equal(resinDescription, 'Terroxy Resin, Sandy Ridge, Part A, 5 gal, pail');
const chipDescription = buildPurchaseOrderLineDescription({line_kind:'chip',material:'Beige Blend Marble',chip_size:'#1',container_size:'50 lb',container:'bag',moisture_condition:'dry',notes:''});
assert.equal(chipDescription, 'Beige Blend Marble, #1, 50 lb, bag, Dry');
const pigmentDescription = buildPurchaseOrderLineDescription({line_kind:'pigment',material:'Dry Cement Pigment',container_size:'50 lb',container:'bag',notes:'Color #188 Hershey Bar Lot match'});
assert.equal(pigmentDescription, 'Dry Cement Pigment, 50 lb, bag, Color #188 Hershey Bar Lot match');
const header = {po_number:'0422-003',status:'issued',material_classification:'mixed'};
const model = buildPurchaseOrderPdfModel(header, [
  {line_number:1,line_kind:'chip',material:'Alaska White',chip_size:'#1',package_quantity:50,package_measure:'LB',container_type:'Bag',quantity:25,unit:'Bag',unit_price:23.30,line_total:582.50},
  {line_number:2,line_kind:'resin',material:'Resin',component_type:'Part B',package_quantity:5,package_measure:'GAL',container_type:'Pail',quantity:25,unit:'gal',unit_price:1,line_total:25},
  {line_number:3,line_kind:'pigment',material:'Dry Cement Pigment',package_quantity:50,package_measure:'LB',container_type:'Bag',quantity:100,unit:'bag',unit_price:2.46,line_total:246,notes:'Color #188 Hershey Bar Lot match'},
]);
assert.equal(model.materialClassification, 'Mixed');
assert.equal(model.lineLayout, 'material-aware');
assert.deepEqual(model.lines.map(line => line.unit), ['Bag', 'gal', 'bag']);
assert.equal(model.lines[0].description, 'Alaska White, #1, 50 LB, Bag');
assert.equal(buildPurchaseOrderPdfModel({po_number:'legacy'}, [{line_number:1,material:'Legacy',chip_size:'#1',notes:'Original'}]).lineLayout, 'legacy');

console.log('Purchasing expanded line-material taxonomy checks passed.');
