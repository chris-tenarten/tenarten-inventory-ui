import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const require = createRequire('/Users/chrisngo/source/repos/tenarten-inventory-ui/package.json');
const sharp = require('sharp');
const base = '/private/tmp/tenops-tenbot-live-2026-10-29/invoice-fixture';
const width = 768, height = 920;
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const label = (x, y, text, size = 18, weight = 400, fill = '#172438', anchor = 'start') => `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escape(text)}</text>`;
const rows = [
  ['1', 'AW-1', 'Alaska White', '#1', '150', 'LB'],
  ['2', 'RES-5', 'Clear Resin', 'Part A', '10', 'GAL'],
  ['3', 'BC-0', 'Blue Coal', '#0', '3', 'Bag'],
  ['4', 'GREEN', 'CC Green', '#1', '2', 'Bag'],
  ['5', 'UNK-99', 'Unlisted Violet', '#2', '4', 'Bag'],
];
const columns = [53, 102, 211, 457, 605, 654];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="768" height="920" fill="#f3f5f7"/>
<rect x="22" y="20" width="724" height="880" rx="3" fill="#ffffff" stroke="#d5dce5"/>
<rect x="22" y="20" width="724" height="58" fill="#162b47"/>
${label(46, 56, 'SYNTHETIC  /  TEST DATA ONLY', 19, 700, '#ffffff')}
${label(46, 124, 'Terrazzo &amp; Marble Supply'.replace('&amp;', '&'), 30, 700)}
${label(722, 159, 'INVOICE', 25, 700, '#42556c', 'end')}
${label(46, 196, 'Supplier: Terrazzo & Marble Supply', 19, 700)}
${label(46, 229, 'Invoice: SYN-INV-2087', 19)}
${label(46, 262, 'Invoice date: 2026-10-29', 19)}
${label(722, 230, 'Bill to: Tenarten', 17, 400, '#42556c', 'end')}
${label(722, 259, 'Synthetic account', 15, 400, '#66768a', 'end')}
<line x1="46" y1="285" x2="722" y2="285" stroke="#d8dfe8"/>
${label(46, 316, 'MATERIALS ORDERED', 14, 700, '#53677f')}
<rect x="46" y="334" width="676" height="42" fill="#e8edf4"/>
${['LINE', 'SKU', 'MATERIAL / DESCRIPTION', 'SIZE / PART', 'QTY', 'UNIT'].map((text, index) => label(columns[index], 360, text, index === 2 ? 13 : 12, 700, '#40536c')).join('\n')}
${rows.map((row, index) => {
  const top = 376 + index * 62;
  return `<rect x="46" y="${top}" width="676" height="62" fill="${index % 2 ? '#f7f9fc' : '#ffffff'}"/>
${row.map((text, cell) => label(columns[cell], top + 38, text, cell === 2 ? 18 : 17, cell === 4 ? 700 : 400)).join('\n')}
<line x1="46" y1="${top + 62}" x2="722" y2="${top + 62}" stroke="#e0e5ed"/>`;
}).join('\n')}
<rect x="46" y="712" width="676" height="58" fill="#f1f5fa" stroke="#dce4ee"/>
${label(61, 748, 'Freight / Delivery charge', 18, 400)}
${label(707, 748, '$85.00', 21, 700, '#172438', 'end')}
${label(46, 809, 'Material quantities are listed separately from freight.', 16, 400, '#53677f')}
<line x1="46" y1="833" x2="722" y2="833" stroke="#d8dfe8"/>
${label(46, 862, 'NOT A REAL INVOICE — DO NOT POST OR PAY', 15, 700, '#53677f')}
</svg>`;
await writeFile(`${base}.svg`, svg);
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(`${base}.png`);
const png = await readFile(`${base}.png`);
const rawLines = [
  'SYNTHETIC / TEST DATA ONLY',
  'Terrazzo & Marble Supply',
  'INVOICE',
  'Supplier: Terrazzo & Marble Supply',
  'Invoice: SYN-INV-2087',
  'Invoice date: 2026-10-29',
  'Bill to: Tenarten',
  'Synthetic account',
  'MATERIALS ORDERED',
  'LINE | SKU | MATERIAL / DESCRIPTION | SIZE / PART | QTY | UNIT',
  ...rows.map(row => row.join(' | ')),
  'Freight / Delivery charge | $85.00',
  'Material quantities are listed separately from freight.',
  'NOT A REAL INVOICE — DO NOT POST OR PAY',
];
const gold = {
  synthetic: true,
  scope: 'Independent live multimodal benchmark scoring fixture. GOLD CONTENT MUST NOT BE PROVIDED TO THE MODEL OR USED AS ITS EXTRACTION.',
  generatedLocally: true,
  apiCalls: 0,
  image: { path: `${base}.png`, mimeType: 'image/png', width, height, bytes: png.length, sha256: createHash('sha256').update(png).digest('hex') },
  documentId: 'synthetic-image-invoice-2087',
  expectedTranscribedDocumentFilename: 'SYNTHETIC-model-transcribed-invoice-2087.txt',
  expectedSupplier: 'Terrazzo & Marble Supply',
  existingCatalogSupplierAlias: 'T&M Supply',
  expectedDocumentReference: 'SYN-INV-2087',
  expectedInvoiceDate: '2026-10-29',
  expectedRawLines: rawLines,
  expectedMaterialExtraction: rows.map(([line, sku, description, size, quantity, unit]) => ({ line: Number(line), sku, description, size, quantity, unit })),
  expectedReadyMaterials: [
    { sku: 'AW-1', material: 'Alaska White', size: '#1', catalogCandidateId: 'standard:synthetic-aw1', inputQuantity: '150', inputUnit: 'LB', package: '50 LB Bag', proposedQuantity: '3', proposedUnit: 'Bag' },
    { sku: 'RES-5', material: 'Clear Resin', size: 'Part A', catalogCandidateId: 'standard:synthetic-res5', inputQuantity: '10', inputUnit: 'GAL', package: '5 GAL Pail', proposedQuantity: '2', proposedUnit: 'Pail' },
  ],
  expectedHeldMaterials: [
    { sku: 'BC-0', material: 'Blue Coal', size: '#0', reasons: ['potential_duplicate'], existingSyntheticReceivalId: 'synthetic-existing-bc0' },
    { sku: 'GREEN', material: 'CC Green', size: '#1', reasons: ['ambiguous_catalog_match'], candidates: ['standard:synthetic-green-a', 'standard:synthetic-green-b'] },
    { sku: 'UNK-99', material: 'Unlisted Violet', size: '#2', reasons: ['unmatched_material'] },
  ],
  expectedExcludedCharge: { kind: 'freight', description: 'Freight / Delivery charge', amount: '85.00', currency: 'USD' },
  expectedMissingEmployeeConfirmations: ['ordered_by', 'order_date', 'location'],
  noExecution: true,
  mappingNotes: [
    'Use existing scripts/fixtures/tenbot-invoice.synthetic.json catalog and receivals unchanged; the existing pure Purchasing supplier normalizer equates Terrazzo & Marble Supply with T&M Supply.',
    'Only actual model-extracted raw_lines may form the text for createTenbotInvoiceTools. This gold file must stay outside model input.',
    'Root should construct the transcribed document with id synthetic-image-invoice-2087, mediaType text/plain, synthetic true and actualModelRawLines.join(newline).',
    'Source refs must use actual model line order: synthetic-image-invoice-2087:L<n>. Gold line indices are for scoring only.',
    'Invoice date is not order date. The image supplies neither ordered-by employee, order date nor receiving location.',
    'Material price amounts are intentionally absent; the only monetary amount is the separate freight charge.',
    'No canonical Job, PO issuance or source-line identity is invented. This fixture requests review only and never execution.',
  ],
};
await writeFile(`${base}.gold.json`, JSON.stringify(gold, null, 2) + '\n');
await writeFile(`${base}.schema.json`, JSON.stringify({ type: 'object', properties: { raw_lines: { type: 'array', minItems: 1, maxItems: 60, items: { type: 'string', minLength: 1, maxLength: 500 } } }, required: ['raw_lines'], additionalProperties: false }, null, 2) + '\n');
console.log(JSON.stringify(gold.image));
