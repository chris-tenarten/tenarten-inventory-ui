import type { SampleRecord } from './types';

// Presentation-only values. Never pass these back to saveSample or issuance RPCs.
export type ColorPlateLabelFields = {
  project: string;
  plate: string;
  date: string;
  matrix: string;
  chips: string;
  sizes: string;
  finish: string;
};

export const colorPlateLabelFieldNames: Record<keyof ColorPlateLabelFields, string> = {
  project: 'Project', plate: 'Color Plate number', date: 'Label date',
  matrix: 'Matrix / color', chips: 'Chips', sizes: 'Chip sizes', finish: 'Finish / sealer',
};

export function populateColorPlateLabel(sample: SampleRecord): ColorPlateLabelFields {
  const sizes = [...new Set(sample.blendRows
    .filter(row => row.componentRole === 'aggregate')
    .map(row => row.size.trim()).filter(Boolean))];
  return {
    project: sample.projectName.trim(),
    plate: sample.colorPlateNumber.trim(),
    date: sample.approvedDate,
    matrix: sample.resinColorNumber.trim() ? [sample.resinColorNumber.trim(), sample.resinSupplier.trim() ? `(${sample.resinSupplier.trim()})` : '']
      .filter(Boolean).join(' ') : '',
    // SKUs, percentages, and row color names do not establish customer-facing chip wording.
    chips: '',
    sizes: sizes.join(', '),
    finish: [sample.finishRequested.trim(), sample.sealer.trim()].filter(Boolean).join(' / '),
  };
}

export function validLabelDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateColorPlateLabelFields(fields: ColorPlateLabelFields) {
  const errors: Partial<Record<keyof ColorPlateLabelFields, string>> = {};
  for (const key of Object.keys(colorPlateLabelFieldNames) as (keyof ColorPlateLabelFields)[]) {
    if (!fields[key].trim()) errors[key] = `Enter ${colorPlateLabelFieldNames[key].toLowerCase()}.`;
    else if (/[\u0000-\u001f\u007f]/.test(fields[key])) errors[key] = 'Use a single line of plain text.';
  }
  if (fields.date && !validLabelDate(fields.date)) errors.date = 'Enter a valid label date.';
  return errors;
}
