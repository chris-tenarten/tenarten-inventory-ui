import assert from 'node:assert/strict';
import {
  combinePurchasingCatalogRecords,
  samePurchasingVendor,
} from '../src/modules/purchasing/catalog-records.ts';
import { getApplicableCatalogPrice, getCatalogPricingMode } from '../src/modules/purchasing/catalog-pricing.ts';
import {
  getPurchasingCatalogCategory,
  purchasingCatalogCategories,
} from '../src/modules/purchasing/catalog-category.ts';

assert.deepEqual([...purchasingCatalogCategories], ['marble','glass','resin','filler','misc']);
assert.equal(getPurchasingCatalogCategory({ materialType:'glass recycled_aggregate', materialName:'Arabian Black' }), 'glass');
assert.equal(getPurchasingCatalogCategory({ materialType:'recycled glass chip', materialName:'Blue Glass' }), 'glass');
assert.equal(getPurchasingCatalogCategory({ materialType:'resin', materialName:'Epoxy Resin' }), 'resin');
assert.equal(getPurchasingCatalogCategory({ materialType:'filler', materialName:'Limestone Filler' }), 'filler');
assert.equal(getPurchasingCatalogCategory({ materialType:'aggregate chip', materialName:'Verde Antique Marble' }), 'marble');
assert.equal(getPurchasingCatalogCategory({ materialType:'', materialName:'Unclassified Material' }), 'misc');

const item = { bulkMinimumQuantity:'50', bulkMinimumUom:'Bag', bulkPrice:'39.75', truckloadMinimumQuantity:'900', truckloadMinimumUom:'Bag', truckloadPrice:'34.25', referencePrice:'42.50' };
assert.equal(getCatalogPricingMode(item, '49', 'Bag'), 'individual');
assert.equal(getCatalogPricingMode(item, '50', 'Bag'), 'bulk');
assert.equal(getCatalogPricingMode(item, '51', 'Bags'), 'bulk');
assert.equal(getCatalogPricingMode(item, ' 51 ', ' bags '), 'bulk');
assert.equal(getCatalogPricingMode(item, '50', 'Pallet'), 'individual');
assert.equal(getCatalogPricingMode(item, '899', 'Bag'), 'bulk');
assert.equal(getCatalogPricingMode(item, '900', 'Bag'), 'truckload');
assert.equal(getCatalogPricingMode(item, '901', 'Bags'), 'truckload');
assert.equal(getCatalogPricingMode(item, '900', 'Pallet'), 'individual');
assert.deepEqual(getApplicableCatalogPrice(item, '50', 'Bag'), { mode:'bulk', price:'39.75' });
assert.deepEqual(getApplicableCatalogPrice(item, '900', 'Bag'), { mode:'truckload', price:'34.25' });
assert.deepEqual(getApplicableCatalogPrice({ ...item, truckloadPrice:'' }, '900', 'Bag'), { mode:'truckload', price:'' });
assert.deepEqual(getApplicableCatalogPrice({ ...item, bulkPrice:'' }, '50', 'Bag'), { mode:'bulk', price:'' });
assert.equal(getCatalogPricingMode({ ...item, bulkMinimumQuantity:'' }, '100', 'Bag'), 'individual');
assert.equal(getCatalogPricingMode({ ...item, bulkMinimumUom:'' }, '100', 'Bag'), 'individual');
assert.deepEqual(getApplicableCatalogPrice(item, '49', 'Bag'), { mode:'individual', price:'42.50' });

const nullableLegacy = {
  id:'legacy-nullable',
  vendor:'T&M Supply',
  item_name:'Arabian Black',
  size:null,
  category:'Aggregate',
  material_class:null,
  unit:null,
  price:null,
  price_basis:null,
};
const duplicateLegacy = {
  ...nullableLegacy,
  id:'legacy-duplicate',
  size:'#1',
  unit:'50 LB Bag',
};
const maintained = {
  id:'maintained',
  vendor_name:'Terrazzo & Marble Supply',
  vendor_sku:'AB-1',
  item_name:'Arabian Black',
  canonical_item_name:'Arabian Black',
  size:'#1',
  canonical_size:'#1',
  category:'Chip / Aggregate',
  material_type:'chip',
  packaging:'50 LB Bag',
  unit_size:50,
  unit_size_uom:'LB',
  price:77.2,
  bulk_price:null,
  bulk_minimum_quantity:null,
  bulk_minimum_uom:null,
  truckload_price:null,
  truckload_minimum_quantity:null,
  truckload_minimum_uom:null,
  price_unit:'Bag',
  minimum_order_qty:null,
  minimum_order_uom:null,
  lead_time_days:null,
  is_active:true,
};
const inactive = { ...maintained, id:'inactive', item_name:'Inactive Black', canonical_item_name:'Inactive Black', is_active:false };
const records = combinePurchasingCatalogRecords(
  [nullableLegacy, duplicateLegacy, { ...nullableLegacy, id:'blank', item_name:null }],
  [maintained, inactive],
  'Terrazzo & Marble Supply',
);
assert.equal(records.some((record) => record.id === 'inactive'), false);
assert.equal(records.some((record) => record.id === 'blank'), false);
assert.equal(records.filter((record) => record.materialName === 'Arabian Black' && record.chipSize === '#1').length, 1);
assert.equal(records.find((record) => record.chipSize === '#1')?.source, 'specialty');
assert.equal(records.find((record) => record.id === 'legacy-nullable')?.referencePrice, '');
assert.equal(records.find((record) => record.id === 'legacy-nullable')?.packageQuantity, '');
assert.equal(samePurchasingVendor('T&M Supply', 'Terrazzo & Marble Supply, Inc.'), true);
assert.equal(samePurchasingVendor('KCI', 'Klein & Co.'), true);
assert.equal(samePurchasingVendor('ASG', 'Klein & Co.'), false);

const [arim] = combinePurchasingCatalogRecords([
  {
    id:'arim-b30',
    vendor:'Arim',
    vendor_sku:'B30',
    item_name:'Toros Black',
    size:'#1',
    category:'marble',
    material_class:'marble',
    unit:'50 LB Bag',
    price:26.3,
    price_basis:'Bag',
  },
], []);
assert.equal(arim.vendorSku, 'B30');
assert.equal(arim.materialName, 'Toros Black');
console.log('Purchasing catalog pricing checks passed.');
