import assert from 'node:assert/strict';
import {deriveInvoiceQuantity,invoiceQuantityIssues,type InvoiceQuantityOffer} from '../src/modules/inventory/invoice-quantity';
const checks:string[]=[];
function test(name:string,run:()=>void){run();checks.push(name);}
const bag:InvoiceQuantityOffer={orderUnit:'Bag',packageQuantity:'50',packageMeasure:'LB',containerType:'Bag'};
const pail:InvoiceQuantityOffer={orderUnit:'Pail',packageQuantity:'5',packageMeasure:'GAL',containerType:'Pail'};
test('150 LB and 10 GAL have independent total, per-container and receival dimensions',()=>{
 for(const [source,offer,count] of [[{quantity:'150',unit:'LB'},bag,'3'],[{quantity:'10',unit:'GAL'},pail,'2']] as const){const before=structuredClone(source),basis=deriveInvoiceQuantity(source,offer,`${source.quantity} ${source.unit}`);assert.equal(basis.receivalQuantity,count);assert.equal(basis.packageCount,count);assert.deepEqual(basis.totalMaterial,source);assert.equal(basis.sourceKind,'material_total');assert.equal(basis.inventoryStockingUnit,null);assert.equal(basis.calculation,'exact_catalog_package_conversion');assert.deepEqual(source,before);}
});
test('explicit package counts multiply to total material without changing the receival count',()=>{
 const basis=deriveInvoiceQuantity({quantity:'3',unit:'bags'},bag,'3 bags');assert.equal(basis.receivalQuantity,'3');assert.equal(basis.receivalUnit,'Bag');assert.equal(basis.sourceKind,'package_count');assert.deepEqual(basis.totalMaterial,{quantity:'150',unit:'LB'});assert.deepEqual(basis.perPackage,{quantity:'50',unit:'LB',container:'Bag'});
});
test('unit-only, quantity-only and alias edits cannot reinterpret total material as package count',()=>{
 assert.deepEqual(invoiceQuantityIssues({quantity:'150',unit:'LB'},bag,'150','Bag','150 LB').reasons,['source_quantity_mismatch']);assert.deepEqual(invoiceQuantityIssues({quantity:'10',unit:'GAL'},pail,'10','Pail','10 GAL').reasons,['source_quantity_mismatch']);assert.deepEqual(invoiceQuantityIssues({quantity:'150',unit:'lbs'},bag,'3.0','bags','150 lbs').reasons,[]);assert.deepEqual(invoiceQuantityIssues({quantity:'150',unit:'LB'},bag,'3','LB','150 LB').reasons,['source_unit_mismatch']);
});
test('a changed catalog package recomputes expected count from the unchanged invoice total',()=>{
 const offer={...bag,packageQuantity:'25'},source={quantity:'150',unit:'LB'};assert.equal(deriveInvoiceQuantity(source,offer,'150 LB').receivalQuantity,'6');assert.deepEqual(invoiceQuantityIssues(source,offer,'3','Bag','150 LB').reasons,['source_quantity_mismatch']);assert.deepEqual(invoiceQuantityIssues(source,offer,'6','Bag','150 LB').reasons,[]);
});
test('incompatible dimensions and unproven physical unit conversions remain held',()=>{
 for(const source of [{quantity:'150',unit:'KG'},{quantity:'150',unit:'GAL'},{quantity:'3',unit:'Pail'}])assert(deriveInvoiceQuantity(source,bag,`${source.quantity} ${source.unit}`).reasons.includes('incompatible_unit_or_package'));
});
test('fractional derived containers and nonterminating divisions are never silently rounded',()=>{
 assert(deriveInvoiceQuantity({quantity:'125',unit:'LB'},bag,'125 LB').reasons.includes('non_integral_package_count'));assert(deriveInvoiceQuantity({quantity:'100',unit:'LB'},{...bag,packageQuantity:'3'},'100 LB').reasons.includes('non_exact_package_conversion'));assert.equal(deriveInvoiceQuantity({quantity:'0.5',unit:'Bag'},bag,'0.5 Bag').receivalQuantity,'0.5');
});
test('explicit conflicting package evidence survives selection, edits and revalidation',()=>{
 for(const label of ['25 LB Bag','5 KG Bag','50 LB Pail','25 LB/Bag','25-LB Bag','25-LB/Bag','25 LB. Bag']){const check=invoiceQuantityIssues({quantity:'150',unit:'LB'},bag,'3','Bag',`150 LB | Package: ${label}`);assert(check.reasons.includes('invoice_catalog_package_conflict'));assert.equal(check.basis.receivalQuantity,null);}
});
test('per-container factors cannot masquerade as total quantities in compound invoice lines',()=>{
 const line='3 Bag × 50 LB = 150 LB';for(const source of [{quantity:'3',unit:'Bag'},{quantity:'150',unit:'LB'}])assert.equal(deriveInvoiceQuantity(source,bag,line).receivalQuantity,'3');const wrong=deriveInvoiceQuantity({quantity:'50',unit:'LB'},bag,line);assert(wrong.reasons.includes('source_quantity_is_package_size'));assert.equal(wrong.receivalQuantity,null);assert(deriveInvoiceQuantity({quantity:'50',unit:'LB'},bag,'Package: 50 LB Bag').reasons.includes('source_quantity_is_package_size'));for(const label of ['50 LB/Bag','50-LB Bag','50-LB/Bag','50 LB. Bag']){assert(deriveInvoiceQuantity({quantity:'50',unit:'LB'},bag,`Package: ${label}`).reasons.includes('source_quantity_is_package_size'));assert.equal(deriveInvoiceQuantity({quantity:'150',unit:'LB'},bag,`Total: 150 LB | Package: ${label}`).receivalQuantity,'3');}
});
test('conflicting count/total assertions hold only their own invoice line',()=>{
 for(const source of [{quantity:'3',unit:'Bag'},{quantity:'200',unit:'LB'}]){const basis=deriveInvoiceQuantity(source,bag,'3 Bag × 50 LB = 200 LB');assert(basis.reasons.includes('conflicting_source_quantity'));assert.equal(basis.receivalQuantity,null);}assert.equal(deriveInvoiceQuantity({quantity:'10',unit:'GAL'},pail,'10 GAL').receivalQuantity,'2');
});
test('missing source and malformed package contracts fail closed',()=>{
 assert.deepEqual(invoiceQuantityIssues(null,bag,'3','Bag').reasons,['missing_invoice_quantity_evidence']);for(const value of ['0','NaN','1e2'])assert(deriveInvoiceQuantity({quantity:'150',unit:'LB'},{...bag,packageQuantity:value},'150 LB').reasons.includes('invalid_catalog_package'));
});
console.log(JSON.stringify({status:'pass',mode:'offline exact quantity/source contract; no extraction or model claim',groups:checks.length,checks,inferenceCalls:0,databaseWrites:0},null,2));
