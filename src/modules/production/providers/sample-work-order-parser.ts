import { commonLabeledFields, normalizedLines, setMedium, type ParsedFields } from './parser-utils';

export function parseSampleWorkOrder(text: string): ParsedFields {
  const fields = commonLabeledFields(normalizedLines(text));
  setMedium(fields, 'plateNumber', text.match(/\bT\d{2}-\d{3}[A-Z]?(?:-[A-Z])?\b/i)?.[0] ?? '');
  return fields;
}
