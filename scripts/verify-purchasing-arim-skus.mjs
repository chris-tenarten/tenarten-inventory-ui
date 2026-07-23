import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [migration, catalog, records, mutations, issuance, pdfModel] = await Promise.all([
  read('../supabase/migrations/20260723_007_arim_catalog_skus.sql'),
  read('../src/modules/purchasing/catalog.ts'),
  read('../src/modules/purchasing/catalog-records.ts'),
  read('../src/modules/purchasing/mutations.ts'),
  read('../supabase/migrations/20260723_001_purchase_order_issuance.sql'),
  read('../supabase/functions/_shared/purchase-order-pdf-model.mjs'),
]);

assert.match(migration, /add column if not exists vendor_sku text/);
for (const [name, sku] of [
  ['Arim Black','B10'],
  ['Toros Black','B30'],
  ['Raven Black','B90'],
  ['Blanco Mexicano','W80'],
  ['Verde Alpi','GN70'],
]) {
  assert.match(migration, new RegExp(`'${name}','${sku}'`));
}
assert.match(catalog, /vendor_sku/);
assert.match(catalog, /vendor_sku\.ilike/);
assert.match(records, /vendorSku: text\(row\.vendor_sku\)/);
assert.match(mutations, /vendor_sku_snapshot:line\.details\.vendorSkuSnapshot/);
assert.match(mutations, /vendor_sku:details\.vendorSkuSnapshot/);
assert.match(issuance, /'vendor_sku', details\.vendor_sku_snapshot/);
assert.match(pdfModel, /vendorSku: text\(line\.vendor_sku\)/);

console.log('Purchasing ARIM SKU propagation checks passed.');
