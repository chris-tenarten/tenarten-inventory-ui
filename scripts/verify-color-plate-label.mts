import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createColorPlateLabel, colorPlatePrintHtml } from '../src/modules/samples/color-plate-label';
import { populateColorPlateLabel, validateColorPlateLabelFields } from '../src/modules/samples/color-plate-label-fields';
import { newLocalSample, blankSampleBlendRow } from '../src/modules/samples/types';

const dir = 'output/pdf/color-plate-label'; mkdirSync(dir, { recursive: true });
const sample = newLocalSample({ preparedBy: 'Local review' });
Object.assign(sample, { projectName: 'Cartersville City Hall', colorPlateNumber: 'T26-256-A', approvedDate: '2026-05-08', resinColorNumber: 'Custom color: Alabaster', resinSupplier: 'KRC', finishRequested: '200g.', sealer: 'TerraGlaze WB Acrylic Sealer' });
sample.blendRows = [{ ...blankSampleBlendRow(0), color: 'White SKU', size: 'NTMA #0, #1, #2 & #3–5', percentage: '100' }];
const original = JSON.stringify(sample);
const fields = populateColorPlateLabel(sample);
assert.equal(fields.chips, '', 'Chip marketing wording must not be invented from blend rows');
assert.equal(fields.date, '2026-05-08'); assert.equal(fields.matrix, 'Custom color: Alabaster (KRC)');
assert.equal(fields.sizes, 'NTMA #0, #1, #2 & #3–5');
assert.equal(validateColorPlateLabelFields(fields).chips, 'Enter chips.');
fields.chips = 'Custom Blended White Marble'; fields.finish = '200g. w/ TerraGlaze WB Acrylic Sealer';
assert.deepEqual(validateColorPlateLabelFields(fields), {});
assert.equal(JSON.stringify(sample), original, 'Label edits must not mutate formulation/context');
for (const [name, values, draft] of [
  ['historical', fields, false],
  ['draft', fields, true],
  ['wrapped', { ...fields, matrix: 'Custom Alabaster matrix with warm white pigment and a subtle natural cream undertone' }, false],
] as const) {
  const label = await createColorPlateLabel(values, draft);
  const loaded = await PDFDocument.load(label.pdf);
  assert.equal(loaded.getPageCount(), 1);
  assert.deepEqual(loaded.getPage(0).getSize(), { width: 288, height: 166.5 });
  for (const t of label.texts) {
    assert.ok(t.x >= 8.5 && t.x + t.width <= 279.5, `${name}: horizontal clipping: ${t.text}`);
    assert.ok(t.y - t.size >= 2 && t.y <= 160, `${name}: vertical clipping: ${t.text}`);
  }
  const task = getDocument({ data: new Uint8Array(label.pdf), useSystemFonts: true });
  const pdf = await task.promise;
  const page = await pdf.getPage(1);
  const text = (await page.getTextContent()).items.map(t => 'str' in t ? t.str : '').join(' ');
  for (const value of [fields.plate, fields.project, '05/08/26', 'TENARTEN TERRAZZO CO.', 'sales@tenartenterrazzo.com']) assert.ok(text.includes(value), `Missing PDF text: ${value}`);
  assert.equal(text.includes('DRAFT'), draft);
  const viewport = page.getViewport({ scale: 3 }); const canvas = createCanvas(viewport.width, viewport.height);
  await page.render({ canvas: canvas as never, canvasContext: canvas.getContext('2d') as never, viewport }).promise;
  writeFileSync(`${dir}/${name}.pdf`, label.pdf); writeFileSync(`${dir}/${name}.png`, canvas.toBuffer('image/png'));
  writeFileSync(`${dir}/${name}.html`, colorPlatePrintHtml(label.svg));
  await task.destroy();
}
await assert.rejects(createColorPlateLabel({ ...fields, chips: 'Extremely long customer description '.repeat(30) }, false), /too long/);
await assert.rejects(createColorPlateLabel({ ...fields, plate: 'T26-' + '9'.repeat(100) }, false), /too long/);
await assert.rejects(createColorPlateLabel({ ...fields, chips: '白 marble' }, false), /characters cannot be printed/);
for (const date of ['2026-02-30', 'invalid', '2026-1-1']) assert.ok(validateColorPlateLabelFields({ ...fields, date }).date);
assert.ok(validateColorPlateLabelFields({ ...fields, chips: 'bad\ntext' }).chips);
const escaped = await createColorPlateLabel({ ...fields, chips: '<script>alert(1)</script>' }, false);
assert.ok(!escaped.svg.includes('<script>')); assert.ok(escaped.svg.includes('&lt;script&gt;'));
sample.resinColorNumber = ''; assert.equal(populateColorPlateLabel(sample).matrix, '', 'Supplier alone is not a matrix description');
sample.approvedDate = ''; assert.equal(populateColorPlateLabel(sample).date, '', 'Creation date is not approval evidence');
console.log('PASS label PDF: physical dimensions, one page, text extraction, draft marking, field sources, temporary overrides, wrapping, clipping bounds, long-text rejection, date validation, unsupported characters, escaped markup. PNGs rendered with PDF.js (Poppler unavailable).');
