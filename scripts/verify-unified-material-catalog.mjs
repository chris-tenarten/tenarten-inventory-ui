// Permanent read-only regression: actual search, mapping, pricing and editor
// selection callbacks with deterministic Catalog fixtures. No network or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, imports = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(output, { module: loaded, exports: loaded.exports, require: key => {
    assert.ok(key in imports, `Unexpected dependency: ${key}`);
    return imports[key];
  } });
  return loaded.exports;
}
const records = load('src/modules/purchasing/catalog-records.ts');
const pricing = load('src/modules/purchasing/catalog-pricing.ts');
const sample = load('src/modules/samples/material-autofill.ts');
// Authoritative identity/metadata observed in the read-only 2026-09-22 read-only reconfirmation.
const plex = { id: '2ad03b7e-7515-4a5a-aa73-0c662e50dc63', vendor_name: 'Klein & Co / KCI', item_name: 'Plex-A-Bond', category: 'resin', material_type: 'Resin / chemical system', component_type: 'Polyacrylate additive', price_unit: 'quote', quote_required: true, is_active: true };
const specialty = [plex,
  ...['K-Poxy Acrylic Sealer', 'K-Poxy Flexible Epoxy', 'K-Poxy Epoxy Terrazzo Resin'].map((name, i) => ({ ...plex, id: `resin-${i}`, item_name: name })),
  ...['TTC2 (Coarse)', 'XO (Coarse 00 GA White)'].map((name, i) => ({ ...plex, id: `filler-${i}`, item_name: name, category: 'filler', material_type: 'Terrazzo filler', component_type: 'Filler', packaging: '50 lb bag', price_unit: 'per 50-lb bag' })),
  { ...plex, id: 'inactive', item_name: 'Plex inactive', is_active: false },
];
// >250 matches force paging; >30 aggregates previously hid every resin.
const standard = Array.from({ length: 270 }, (_, i) => ({ id: `chip-${String(i).padStart(3, '0')}`, vendor: 'Klein & Co / KCI', item_name: `Normal aggregate ${i}`, category: 'marble', size: '#1', unit: '50 LB Bag', price: 42 }));
standard.push({ id: 'blanco', vendor: 'KCI', vendor_sku: 'BL-52', item_name: 'Blanco Mexicano', category: 'marble', size: '#1', unit: '50 LB Bag', price: 52.5 });
const tables = { vendor_catalog: standard, vendor_catalog_v2: specialty };
let failure = ''; let serverCap = 250; let missingCount = false; let truncate = false; const calls = [];
const client = { from(table) {
  let filter = '', active = false, from = 0, to = 0;
  return {
    select() { return this; }, eq() { active = true; return this; },
    or(value) { filter = value; return this; }, order() { return this; },
    range(start, end) { from = start; to = end; return this; },
    returns() { return this; },
    then(resolve, reject) {
      calls.push({ table, from, to, filter });
      const terms = [...filter.matchAll(/(\w+)\.ilike\.("(?:[^"\\]|\\.)*")/g)];
      assert.ok(terms.length);
      const rows = tables[table].filter(row => (!active || row.is_active === true) && terms.some(([, column, pattern]) => {
        const term = JSON.parse(pattern).slice(1, -1).replace(/\\([\\%_])/g, '$1').toLowerCase();
        return String(row[column] ?? '').toLowerCase().includes(term);
      })).sort((a, b) => a.id.localeCompare(b.id));
      const count = rows.length;
      const page = truncate && from > 0 ? [] : rows.slice(from, Math.min(to + 1, from + serverCap));
      return Promise.resolve({ data: page, count: missingCount ? null : count, error: failure === table ? { message: 'Unavailable' } : null }).then(resolve, reject);
    },
  };
} };
const { searchPurchasingCatalog: search } = load('src/modules/purchasing/catalog.ts', { '@/lib/supabase': { supabase: client }, './catalog-records': records });
for (const query of ['Plex-A-Bond', 'Plex']) {
  const results = await search(query);
  assert.equal(results.length, 1); assert.equal(results[0].id, plex.id);
}
const vendorResults = await search('Klein');
assert.equal(vendorResults.length, 276);
assert.equal(vendorResults.filter(row => row.id === plex.id).length, 1);
for (const entry of specialty.filter(row => row.is_active)) assert.ok(vendorResults.some(row => row.id === entry.id));
assert.ok(calls.some(call => call.table === 'vendor_catalog' && call.from === 250));
assert.equal((await search('Plex', '', 'resin')).length, 1);
for (const type of ['chip', 'filler', 'pigment', 'other']) assert.equal((await search('Plex', '', type)).length, 0);
assert.equal((await search('TTC2', '', 'filler'))[0].packageQuantity, '50');
assert.equal((await search('TTC2', '', 'resin')).length, 0);
const normal = (await search('Blanco', '', 'chip'))[0];
assert.equal((await search('BL-52'))[0].id, 'blanco');
assert.equal(normal.referencePrice, '52.5'); assert.equal(normal.source, 'standard');
for (const table of Object.keys(tables)) {
  failure = table; await assert.rejects(search('Plex'), /Catalog search is incomplete/);
}
failure = '';
await search('a,b'); await search('50%'); await search('a"b');
const item = (await search('Plex'))[0];
assert.equal(item.vendor, plex.vendor_name); assert.equal(item.materialType, plex.material_type);
assert.equal(item.componentType, 'Polyacrylate additive'); assert.equal(item.quoteRequired, true);
for (const field of ['vendorSku', 'packageQuantity', 'packageMeasure', 'containerType', 'orderUnit', 'referencePrice']) assert.equal(item[field], '');
assert.equal(pricing.getApplicableCatalogPrice({ ...item, referencePrice: '99', bulkPrice: '88', bulkMinimumQuantity: '1', bulkMinimumUom: 'Bag' }, '10', 'Bag').price, '');
const current = { componentRole: 'resin', quantity: '15', quantityProvenance: 'manual', calculationBasis: 'resin_volume', color: '', size: '', unit: 'fl oz', vendor: '' };
const selectedSample = { ...current, ...sample.sampleBlendCatalogAutofill(current, item) };
assert.equal(selectedSample.color, 'Plex-A-Bond'); assert.equal(selectedSample.vendor, plex.vendor_name);
assert.equal(selectedSample.catalogSource, 'specialty'); assert.equal(selectedSample.catalogItemId, plex.id);
assert.equal(selectedSample.catalogSnapshot.vendor_sku, '');
for (const field of ['componentRole', 'quantity', 'quantityProvenance', 'calculationBasis']) assert.equal(selectedSample[field], current[field]);
// Exercise the actual PO UI click callback, including a previously priced line.
const source = fs.readFileSync('src/modules/purchasing/PurchaseOrderEditor.tsx', 'utf8');
const ast = ts.createSourceFile('editor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let arrow;
function walk(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'select' && node.initializer?.getText(ast).includes('getPurchaseOrderCatalogOrderUnit')) arrow = node.initializer.getText(ast);
  ts.forEachChild(node, walk);
}
walk(ast); assert.ok(arrow);
const callback = ts.transpileModule(`const select = ${arrow}; select(item);`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const details = { notes: 'Keep authored note', productionJobId: 'keep-job', quantityOrdered: '10', unitPrice: '999', orderUnit: 'Bag', priceBasis: 'old', chipSize: '#2', resinColor: 'Old', componentType: 'Old', packageQuantity: '50', packageMeasure: 'LB', containerType: 'Bag' };
let selected;
vm.runInNewContext(callback, { item, details, line: { materialType: 'resin', details }, getPurchaseOrderCatalogOrderUnit: records.getPurchaseOrderCatalogOrderUnit, getApplicableCatalogPrice: pricing.getApplicableCatalogPrice, onChange: value => { selected = value; }, ...Object.fromEntries(['setReference', 'setPriceSuggestions', 'setPriceHistoryState', 'setQuery', 'setResults', 'setCatalogEditor'].map(name => [name, () => {}])) });
assert.equal(selected.details.notes, 'Keep authored note'); assert.equal(selected.details.productionJobId, 'keep-job');
assert.equal(selected.details.quantityOrdered, '10');
assert.equal(selected.details.unitPrice, ''); assert.equal(selected.details.orderUnit, '');
assert.equal(selected.details.catalogSource, 'specialty'); assert.equal(selected.details.catalogItemId, plex.id);
assert.equal(selected.details.materialNameSnapshot, 'Plex-A-Bond'); assert.equal(selected.details.componentType, 'Polyacrylate additive');
for (const field of ['vendorSkuSnapshot', 'chipSize', 'resinColor', 'packageQuantity', 'packageMeasure', 'containerType']) assert.equal(selected.details[field], '');
assert.equal(selected.materialType, 'resin'); assert.equal(selected.details.priceBasis, 'quote');
// Source records remain distinct without an explicit identity link.
const twin = { id: 'twin', vendor_name: normal.vendor, item_name: normal.materialName, canonical_size: '#1', packaging: '50 LB Bag', price: 52.5, category: 'marble', is_active: true };
const legacy = standard.at(-1);
assert.equal(records.combinePurchasingCatalogRecords([legacy], [twin]).length, 2);
assert.equal(records.combinePurchasingCatalogRecords([legacy], [{ ...twin, quote_required: true }]).length, 2);
assert.equal(records.combinePurchasingCatalogRecords([{ ...legacy, vendor_sku: 'A' }], [{ ...twin, vendor_sku: 'B' }]).length, 2);
assert.equal(records.combinePurchasingCatalogRecords([legacy], [{ ...twin, color: 'Red' }]).length, 2);
assert.equal(records.combinePurchasingCatalogRecords([legacy], [{ ...twin, item_name: 'Blanco-Mexicano' }]).length, 2);

const sharedResults = fs.readFileSync('src/modules/purchasing/CatalogSearchResults.tsx', 'utf8');
assert.match(sharedResults, /Specialty/); assert.match(sharedResults, /Quote required/);
assert.match(sharedResults, /items.slice\(start, start \+ pageSize\)/);
for (const file of ['src/modules/purchasing/PurchaseOrderEditor.tsx', 'src/modules/samples/SampleWorkspace.tsx']) assert.match(fs.readFileSync(file, 'utf8'), /<CatalogSearchResults/);
serverCap = 17;
assert.equal((await search('Klein')).length, vendorResults.length, 'server page cap cannot truncate results');
missingCount = true; await assert.rejects(search('Klein'), /incomplete/); missingCount = false;
truncate = true; await assert.rejects(search('Klein'), /incomplete/); truncate = false;
// Switch back through the actual UI callback, including missing-price records.
for (const target of [normal, { ...normal, referencePrice: '', priceBasis: '' }]) {
  vm.runInNewContext(callback, { item: target, details: selected.details, line: selected, getPurchaseOrderCatalogOrderUnit: records.getPurchaseOrderCatalogOrderUnit, getApplicableCatalogPrice: pricing.getApplicableCatalogPrice, onChange: value => { selected = value; }, ...Object.fromEntries(['setReference', 'setPriceSuggestions', 'setPriceHistoryState', 'setQuery', 'setResults', 'setCatalogEditor'].map(name => [name, () => {}])) });
  assert.equal(selected.details.unitPrice, target.referencePrice);
  assert.equal(selected.details.priceBasis, target.priceBasis);
  assert.equal(selected.details.catalogSource, 'standard');
  assert.equal(selected.details.packageQuantity, '50');
  assert.equal(selected.details.notes, 'Keep authored note');
}
const clearedSample = sample.sampleBlendCatalogAutofill({ ...current, size: 'old', catalogItemId: 'old' }, item);
assert.equal(clearedSample.size, '');
assert.deepEqual(Object.keys(clearedSample).sort(), ['catalogItemId','catalogSnapshot','catalogSource','color','materialType','size','unit','vendor'].sort(), 'selection only returns supported catalog metadata');
console.log('Unified Catalog checks passed: paged and capped-server completeness, errors, escaped terms, six Specialty products, eligibility, distinct offers, quote protection, actual PO selection/switching and Sample metadata-only selection.');

// Exercise current Sample patchRow as well as the autofill boundary. Metadata
// selection must not alter V4 formulation authority or quantity provenance.
const sampleSource = fs.readFileSync('src/modules/samples/SampleWorkspace.tsx', 'utf8');
const sampleAst = ts.createSourceFile('sample.tsx', sampleSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let patchRow;
function findPatch(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'patchRow') patchRow = node.getText(sampleAst);
  ts.forEachChild(node, findPatch);
}
findPatch(sampleAst); assert.ok(patchRow);
const patchCode = ts.transpileModule(`${patchRow}; patchRow(0, changes);`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const role of ['aggregate', 'filler', 'resin', 'hardener']) {
  const row = { ...current, componentRole: role, quantityProvenance: 'calculated', percentage: '100', density: '96' };
  const draft = { blendRows: [row], formulation: { calculationVersion: 'sample-formulation-v4-density-profile', chipDensityProvenance: 'profile_default', fillerProvenance: 'profile_default', resinProvenance: 'manual', adjustment: { protected: true }, ratioProvenance: 'manual', resinHardenerRatio: '5:1' } };
  let updated;
  vm.runInNewContext(patchCode, { draft, changes: sample.sampleBlendCatalogAutofill(row, item), setDraft: fn => { updated = fn(draft); }, setMessage: () => {} });
  assert.equal(JSON.stringify(updated.formulation), JSON.stringify(draft.formulation));
  for (const key of ['quantity','quantityProvenance','componentRole','percentage','density']) assert.equal(updated.blendRows[0][key], row[key]);
}
for (const [type, category] of [['chip','marble'],['resin','epoxy'],['pigment','colorant'],['filler','filler'],['other','misc']]) {
  assert.equal(records.combinePurchasingCatalogRecords([{ id: type, item_name: 'Valid product', category }], [], '', type).length, 1);
}
for (const change of [{ price: 90 }, { packaging: '25 LB Bag' }, { vendor_name: 'Arim' }, { vendor_sku: 'different' }]) assert.equal(records.combinePurchasingCatalogRecords([legacy], [{ ...twin, ...change }]).length, 2);
console.log('Current Sample patchRow preserves V4 authority/provenance for all four calculation roles; all five PO types and commercial distinctions remain supported.');

const sampleCatalog = load('src/modules/samples/catalog.ts', { '@/modules/purchasing/catalog': { searchPurchasingCatalog: search } });
standard.push(
  { id: 'pacific-a', item_name: 'Pacific Abalone', category: 'marble', material_class: 'imported_aggregate' },
  { id: 'pacific-g', item_name: 'Pacific Clear Glass', category: 'glass', material_class: 'recycled_aggregate' },
  { id: 'glass-filler', item_name: 'Recycled Clear Glass Filler', category: 'glass', material_class: 'recycled_glass' },
);
specialty.push({ ...plex, id: 'hardener', item_name: 'Component B', component_type: 'hardener' });
for (const role of ['filler', 'resin', 'hardener', 'aggregate']) {
  for (const term of ['', 'fi']) {
    const found = await sampleCatalog.searchSampleCatalog(term, role);
    if (!term) assert.ok(found.every(item => sampleCatalog.sampleCatalogEligible(item, role)));
    if (!term && role !== 'aggregate') assert.ok(found.every(item => !['pacific-a','pacific-g','glass-filler'].includes(item.id)));
  }
}
assert.equal((await sampleCatalog.searchSampleCatalog('fi', 'filler')).length, 3);
assert.ok((await sampleCatalog.searchSampleCatalog('fi', 'filler')).every(item => !sampleCatalog.sampleCatalogEligible(item, 'filler')));
assert.equal((await sampleCatalog.searchSampleCatalog('', 'filler')).length, 2);
assert.equal((await sampleCatalog.searchSampleCatalog('', 'hardener'))[0].id, 'hardener');
assert.ok((await sampleCatalog.searchSampleCatalog('', 'resin')).some(item => item.id === plex.id));
assert.ok(!(await sampleCatalog.searchSampleCatalog('', 'resin')).some(item => item.id === 'hardener'));
assert.ok((await sampleCatalog.searchSampleCatalog('fi', 'aggregate')).some(item => item.id === 'pacific-a'));
const owned = { ...current, ...sample.sampleBlendCatalogAutofill(current, item) };
const clear = sample.clearSampleCatalogSelection(owned);
assert.equal(clear.catalogItemId, null); assert.equal(clear.vendor, ''); assert.equal(clear.size, '');
assert.equal(Object.keys(clear.catalogSnapshot).length, 0);
assert.equal('quantity' in clear, false); assert.equal('quantityProvenance' in clear, false);
assert.equal('vendor' in sample.clearSampleCatalogSelection({ ...owned, vendor: 'Authored override' }), false);
console.log('Sample role AND query checks passed: blank/typed searches, structured hardener classification, no name-based filler inference, and stale selection clearing.');

const packaged = records.combinePurchasingCatalogRecords([], [{ ...plex, id: 'packaged-filler', material_type: 'Terrazzo filler', component_type: 'Filler', category: 'filler', packaging: '50 LB Bag', vendor_sku: 'F-1' }])[0];
const packagedRow = { ...current, ...sample.sampleBlendCatalogAutofill(current, packaged) };
const clearedPackage = sample.clearSampleCatalogSelection(packagedRow);
for (const field of ['unit','size','materialType','vendor']) assert.equal(clearedPackage[field], '');
assert.equal(Object.keys(clearedPackage.catalogSnapshot).length, 0, 'SKU and all selection snapshot metadata are cleared');

const discoverable = await sampleCatalog.searchSampleCatalog('Recycled Clear Glass Filler', 'filler');
assert.equal(discoverable[0].id, 'glass-filler');
assert.equal(sampleCatalog.sampleCatalogEligible(discoverable[0], 'filler'), false);
standard.push({ id: 'eligible-name', item_name: 'Clear Glass Filler Blend', category: 'filler' });
const ranked = await sampleCatalog.searchSampleCatalog('Clear Glass', 'filler');
assert.equal(ranked[0].id, 'eligible-name');
assert.ok(ranked.slice(1).every(item => !sampleCatalog.sampleCatalogEligible(item, 'filler')));
// Add an exact secondary name to explicitly verify name ranking within that group.
standard.push({ id: 'exact-name', item_name: 'Clear Glass', category: 'glass' });
const exactRanked = await sampleCatalog.searchSampleCatalog('Clear Glass', 'filler');
assert.equal(exactRanked[0].id, 'eligible-name');
assert.equal(exactRanked[1].id, 'exact-name');
for (const role of ['resin', 'hardener']) {
  const others = await sampleCatalog.searchSampleCatalog('Recycled Clear Glass Filler', role);
  assert.equal(others.length, 1);
  assert.equal(sampleCatalog.sampleCatalogEligible(others[0], role), false);
}
console.log('Discovery checks passed: strict blank queries, eligible-first typed groups, exact-name ranking, and explicit non-compatibility for Resin/Hardener.');
