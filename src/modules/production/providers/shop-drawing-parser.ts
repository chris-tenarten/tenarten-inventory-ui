import {
  labeledValue,
  normalizedLines,
  setHigh,
  type ParsedFields,
} from './parser-utils';

export function parseShopDrawing(text: string): ParsedFields {
  const lines = normalizedLines(text);
  const fields: ParsedFields = {};
  setHigh(fields, 'jobNumber', labeledValue(lines, [/project\s*#/], /(\d{2}-\d{4})/));
  setHigh(fields, 'jobName', labeledValue(lines, [/project/], /(.+)/));
  setHigh(fields, 'customer', labeledValue(lines, [/customer/], /(.+)/));
  setHigh(fields, 'location', labeledValue(lines, [/location/], /(.+)/));
  setHigh(
    fields,
    'plateNumber',
    labeledValue(lines, [/terr\.?\s+color\s+plate/], /([TD]\d{2}-\d{3}[A-Z]?(?:-[A-Z])?)/),
  );
  return fields;
}
