import { commonLabeledFields, normalizedLines, setMedium, type ParsedFields } from './parser-utils';

export function parseMaterialQuantitySheet(text: string): ParsedFields {
  const fields = commonLabeledFields(normalizedLines(text));
  setMedium(fields, 'jobNumber', text.match(/\b\d{2}-\d{4}\b/)?.[0] ?? '');
  return fields;
}
