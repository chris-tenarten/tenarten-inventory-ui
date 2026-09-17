import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildProposalPdfModel,
  paginateProposalPdf,
  proposalPdfColumns,
  wrapProposalText,
} from '../supabase/functions/generate-proposal-pdf/proposal-pdf-model';

const edgeSource = await readFile(new URL('../supabase/functions/generate-proposal-pdf/index.ts', import.meta.url), 'utf8');

const v2 = buildProposalPdfModel({
  estimate_number: 'Q26-0901-1.0',
  customer_name: 'St. Ignacio High School',
  customer_street: '123 Long School Address',
  customer_city: 'Dallas',
  customer_state: 'TX',
  customer_postal_code: '75201',
  customer_contact_name: 'Estimator Contact',
  customer_office_phone: '214-555-0100',
  customer_mobile_phone: '469-555-0101',
  customer_email: 'estimating@example.com',
  lines: [{
    geometry_profile: 'tread_riser',
    dimension_applicability: {
      length: true,
      width: true,
      riserHeight: true,
      thickness: true,
      cubicFeet: true,
      linearFeet: true,
      estimatedWeight: true,
    },
    length_inches: 48,
    width_inches: 24,
    riser_height_inches: null,
    thickness_inches: 0.375,
    cubic_feet: 10.75,
    linear_feet: 172,
    estimated_weight_pounds: 1505,
  }],
});
assert.deepEqual(v2.geometryKeys, ['length', 'width', 'riserHeight', 'thickness', 'cubicFeet', 'linearFeet', 'estimatedWeight']);
assert.deepEqual(
  {
    length: v2.lines[0].length,
    width: v2.lines[0].width,
    riserHeight: v2.lines[0].riserHeight,
    thickness: v2.lines[0].thickness,
    cubicFeet: v2.lines[0].cubicFeet,
    linearFeet: v2.lines[0].linearFeet,
    estimatedWeight: v2.lines[0].estimatedWeight,
  },
  { length: '48', width: '24', riserHeight: '', thickness: '0.375', cubicFeet: '10.75', linearFeet: '172', estimatedWeight: '1505' },
  'issued snake_case V2 values must reach the PDF model, including blank-but-applicable RH',
);
assert.equal(
  v2.customerDisplay,
  ['St. Ignacio High School', '123 Long School Address', 'Dallas TX 75201', 'Estimator Contact', '214-555-0100', '469-555-0101', 'estimating@example.com'].join('\n'),
);
const v2Columns = proposalPdfColumns(v2);
assert.deepEqual(v2Columns.map((column) => column.label), ['Item', 'Description', 'REF', 'COLOR PLATE', 'QTY', '', 'L', 'W', 'RH', 'T', 'CFT', 'LF', 'EST. weight', 'Rate', 'Total']);
assert.equal(v2Columns.reduce((total, column) => total + column.width, 0), 548);
assert.equal(v2Columns.at(-1).x + v2Columns.at(-1).width, 580, 'dynamic columns must remain within the 32..580 table bounds');

const selective = buildProposalPdfModel({
  estimateNumber: 'Q26-selective',
  lines: [{
    geometryProfile: 'flat',
    dimensionApplicability: { length: true, width: false, riserHeight: false, thickness: true, cubicFeet: false },
    lengthInches: 48,
    widthInches: 24,
    thicknessInches: '',
    cubicFeet: 10.75,
  }],
});
assert.deepEqual(selective.geometryKeys, ['length', 'thickness'], 'explicit false flags must hide stale values while blank applicable dimensions retain columns');
assert.equal(selective.lines[0].width, '', 'an explicit false applicability flag must mask that row value');
assert.equal(selective.lines[0].cubicFeet, '', 'derived values marked inapplicable must also be masked per row');

const mixedApplicability = buildProposalPdfModel({
  estimateNumber: 'Q26-mixed-applicability',
  lines: [
    {
      geometryProfile: 'flat',
      dimensionApplicability: { length: true, width: false, thickness: true },
      lengthInches: 48,
      widthInches: 999,
      thicknessInches: 0.375,
    },
    {
      geometryProfile: 'custom',
      dimensionApplicability: { length: true, width: true, thickness: true },
      lengthInches: 12,
      widthInches: 6,
      thicknessInches: 0.5,
    },
  ],
});
assert.ok(mixedApplicability.geometryKeys.includes('width'), 'another applicable row must keep the shared width column');
assert.equal(mixedApplicability.lines[0].width, '', 'the shared column must not reveal a stale value on an explicitly inapplicable row');
assert.equal(mixedApplicability.lines[1].width, '6');

const arrayApplicability = buildProposalPdfModel({
  estimateNumber: 'Q26-array',
  lines: [{
    geometryProfile: 'custom',
    dimensionApplicability: ['length', 'riserHeight', 'thickness', 'cft', 'lf'],
  }],
});
assert.deepEqual(arrayApplicability.geometryKeys, ['length', 'riserHeight', 'thickness', 'cubicFeet', 'linearFeet']);

const legacy = buildProposalPdfModel({
  estimate_number: 'Q26-legacy',
  lines: [{ length: '48', width: '24', height_thickness: '0.375', cft: '10.75', lf: '172', estimated_weight: '1505' }],
});
assert.equal(legacy.legacyGeometry, true);
assert.deepEqual(legacy.geometryKeys, ['length', 'width', 'heightThickness', 'cft', 'lf', 'estimatedWeight']);
assert.ok(proposalPdfColumns(legacy).some((column) => column.label === 'H/T'), 'legacy-only snapshots must retain the combined H/T column');

const mixed = buildProposalPdfModel({
  estimateNumber: 'Q26-mixed',
  lines: [
    { heightThickness: '19', length: '48' },
    { geometryProfile: 'tread_riser', dimensionApplicability: { riserHeight: true, thickness: true } },
  ],
});
assert.ok(mixed.geometryKeys.includes('heightThickness'), 'mixed revisions must not discard a legacy line H/T value');
assert.ok(mixed.geometryKeys.includes('riserHeight') && mixed.geometryKeys.includes('thickness'));
const mixedColumns = proposalPdfColumns(mixed);
assert.equal(mixedColumns.at(-1).x + mixedColumns.at(-1).width, 580);

const partialStructured = buildProposalPdfModel({
  estimateNumber: 'Q26-contact',
  customerName: 'Customer',
  customerStreet: 'Structured street',
  customerContact: 'Legacy contact retained',
  lines: [],
});
assert.match(partialStructured.customerDisplay, /Structured street/);
assert.match(partialStructured.customerDisplay, /Legacy contact retained/, 'adding a structured address must not silently drop the legacy contact block');

const longToken = 'A'.repeat(500);
const brokenToken = wrapProposalText(longToken, 80, 6.4);
assert.equal(brokenToken.join(''), longToken, 'unbroken user text must wrap without character loss');
assert.ok(brokenToken.every((line) => line.length * 6.4 * 0.52 <= 80));

const longDescription = Array.from({ length: 900 }, (_, index) => `description${index}`).join(' ');
const longNotes = Array.from({ length: 1000 }, (_, index) => `note${index}`).join(' ');
const longFormula = Array.from({ length: 700 }, (_, index) => `formula${index}`).join(' ');
const overflowModel = buildProposalPdfModel({
  estimateNumber: 'Q26-overflow',
  customerName: 'Customer',
  customerStreet: Array.from({ length: 250 }, (_, index) => `address${index}`).join(' '),
  customerContactName: Array.from({ length: 120 }, (_, index) => `contact${index}`).join(' '),
  notes: longNotes,
  formulaSnapshot: longFormula,
  disclaimerSnapshot: `${Array.from({ length: 300 }, (_, index) => `material${index}`).join(' ')}\n\n${Array.from({ length: 300 }, (_, index) => `dimension${index}`).join(' ')}`,
  lines: [{ description: longDescription, quantity: 1, total: 1 }],
});
const overflowColumns = proposalPdfColumns(overflowModel);
const descriptionWidth = overflowColumns.find((column) => column.key === 'description').width - 12;
const expectedCustomer = wrapProposalText(overflowModel.customerDisplay, 255, 7.5);
const expectedDescription = wrapProposalText(longDescription, descriptionWidth, 6.4);
const expectedNotes = wrapProposalText(longNotes, 530, 6.2);
const expectedFormula = wrapProposalText(longFormula, 345, 6.2);
const expectedMaterialDisclaimer = wrapProposalText(overflowModel.disclaimer.split(/\n\s*\n/)[0], 258, 5.4);
const expectedDimensionDisclaimer = wrapProposalText(overflowModel.disclaimer.split(/\n\s*\n/)[1], 258, 5.4);
type PdfPage = {
  customerLines: string[];
  rows: Array<{ descriptionLines: string[] }>;
  notesLines: string[];
  formulaLines: string[];
  materialDisclaimerLines: string[];
  dimensionDisclaimerLines: string[];
  customerContinuation?: boolean;
  disclaimerContinuation?: boolean;
  formulaContinuation?: boolean;
  notesContinuation?: boolean;
  closing: boolean;
};
const overflowPages = paginateProposalPdf(overflowModel, {
  materialDisclaimerLines: expectedMaterialDisclaimer,
  dimensionDisclaimerLines: expectedDimensionDisclaimer,
  firstDisclaimerLineLimit: 8,
  disclaimerContinuationLineLimit: 70,
}) as PdfPage[];
assert.deepEqual(overflowPages.flatMap((page) => page.customerLines), expectedCustomer, 'customer/address/contact pagination must retain every wrapped line');
assert.deepEqual(overflowPages.flatMap((page) => page.rows.flatMap((row) => row.descriptionLines)), expectedDescription, 'description fragments must retain every wrapped line');
assert.deepEqual(overflowPages.flatMap((page) => page.notesLines), expectedNotes, 'notes pagination must retain every wrapped line');
assert.deepEqual(overflowPages.flatMap((page) => page.formulaLines), expectedFormula, 'formula pagination must retain every wrapped line');
assert.deepEqual(overflowPages.flatMap((page) => page.materialDisclaimerLines), expectedMaterialDisclaimer, 'material disclaimer pagination must retain every wrapped line');
assert.deepEqual(overflowPages.flatMap((page) => page.dimensionDisclaimerLines), expectedDimensionDisclaimer, 'dimension disclaimer pagination must retain every wrapped line');
assert.ok(overflowPages.some((page) => page.customerContinuation));
assert.ok(overflowPages.some((page) => page.disclaimerContinuation));
assert.ok(overflowPages.some((page) => page.formulaContinuation));
assert.ok(overflowPages.some((page) => page.notesContinuation));
const formulaPageIndexes = overflowPages.flatMap((page, index) => page.formulaLines.length ? [index] : []);
const notePageIndexes = overflowPages.flatMap((page, index) => page.notesLines.length ? [index] : []);
assert.ok(Math.max(...formulaPageIndexes) < Math.min(...notePageIndexes), 'all formula pages must precede notes pages');
assert.equal(overflowPages.filter((page) => page.closing).length, 1);
assert.equal(overflowPages.at(-1)?.closing, true);

assert.match(edgeSource, /drawLines\(pageLayout\.customerLines/);
assert.match(edgeSource, /drawLines\(row\.descriptionLines/);
assert.match(edgeSource, /drawLines\(pageLayout\.notesLines/);
assert.match(edgeSource, /drawLines\(pageLayout\.formulaLines/);
assert.match(edgeSource, /pageLayout\.formulaContinuation/);
assert.doesNotMatch(edgeSource, /wrapped\(model\.formula/);
assert.match(edgeSource, /const firstTableTop = 476 - identityExtraHeight/, 'the first table header must clear the dynamically reflowed disclaimer boxes');
assert.match(edgeSource, /caption: 'Project #'/);
assert.match(edgeSource, /caption: 'Project Name'/);
assert.match(edgeSource, /caption: 'Project Location'/);
assert.match(edgeSource, /caption: 'Requested delivery date'/);
assert.doesNotMatch(edgeSource, /replace\([^\n]*Delivery/i, 'authored Delivery values must not be globally rewritten');
assert.match(edgeSource, /document_version: PROPOSAL_PDF_VERSION/, 'generated PDF metadata must record the renderer version');

console.log('Proposal V2 PDF model checks passed.');
