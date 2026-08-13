import { commonLabeledFields, normalizedLines, setHigh, setMedium, type ParsedFields } from './parser-utils';

export function parseShopFabricationWorkOrder(text: string): ParsedFields {
  const lines = normalizedLines(text);
  const fields = commonLabeledFields(lines);
  setMedium(fields, 'jobNumber', text.match(/\b\d{2}-\d{4}\b/)?.[0] ?? '');
  const plateNumber = text.match(/\bT\d{2}-\d{3}[A-Z]?(?:-[A-Z])?(?:\s*\([A-Z0-9-]+\))?/i)?.[0] ?? '';
  setHigh(fields, 'plateNumber', plateNumber);
  return fields;
}
