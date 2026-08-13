import { labeledValue, normalizedLines, setMedium, type ParsedFields } from './parser-utils';

function normalizedDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return '';
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

export function extractGenericIdentifiers(text: string): ParsedFields {
  const lines = normalizedLines(text);
  const fields: ParsedFields = {};
  setMedium(fields, 'jobNumber', labeledValue(lines, [/job\s*number/, /job\s*no\.?/, /job\s*#/, /project\s*(?:number|no\.?|#)/], /([A-Z0-9-]+)/));
  setMedium(fields, 'jobName', labeledValue(lines, [/job[.\s]*name/, /project\s*name/]));
  setMedium(fields, 'customer', labeledValue(lines, [/customer/, /custiomer/, /contractor/]));
  setMedium(fields, 'workOrderNumber', labeledValue(lines, [/work\s*order\s*number/, /work\s*order\s*no\.?/, /work\s*order\s*#/, /w\/?o\s*#/], /([A-Z0-9-]+)/));
  setMedium(fields, 'plateNumber', labeledValue(lines, [/(?:color\s*)?plate\s*number/, /(?:color\s*)?plate\s*no\.?/, /(?:color\s*)?plate\s*#/], /(.+)/));
  setMedium(fields, 'requestedDelivery', normalizedDate(labeledValue(lines, [/requested\s*(?:delivery|ship)\s*date/, /due\s*date/, /delivery\s*date/])));
  setMedium(fields, 'location', labeledValue(lines, [/location/, /job\s*site/, /project\s*location/]));
  return fields;
}
