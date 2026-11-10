import {
  commonLabeledFields,
  normalizedLines,
  type ParsedFields,
} from './parser-utils';

export function parseBlendSheet(text: string): ParsedFields {
  return commonLabeledFields(normalizedLines(text));
}
