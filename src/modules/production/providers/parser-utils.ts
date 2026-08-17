import type { ExtractedJobField, ExtractionConfidence } from '../job-import-provider';

export type ParsedFields = Partial<Record<ExtractedJobField, { value: string; confidence: Exclude<ExtractionConfidence, 'missing'> }>>;

export type ExtractedCandidate = {
  field: ExtractedJobField;
  value: string;
  normalizedValue: string;
  confidence: Exclude<ExtractionConfidence, 'missing'>;
  sourceFile: string;
  family: string;
  sourceKind: 'family_parser' | 'generic';
  fileIndex: number;
  sequence: number;
};

export const normalizedLines = (text: string) => text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);

export function labeledValue(lines: string[], labels: RegExp[], valuePattern = /(.+)/): string {
  for (let index = 0; index < lines.length; index += 1) {
    for (const label of labels) {
      const inline = lines[index].match(new RegExp(`^(?:${label.source})(?:\\s*[:#-]\\s*|\\s+)${valuePattern.source}$`, 'i'));
      if (inline?.[1]?.trim()) return inline[1].trim();
      if (new RegExp(`^(?:${label.source})\\s*[:#-]?\\s*$`, 'i').test(lines[index])) {
        const next = lines[index + 1]?.trim();
        if (next && valuePattern.test(next)) return next;
      }
    }
  }
  return '';
}

export function labeledValues(lines: string[], labels: RegExp[], valuePattern = /(.+)/): string[] {
  const values: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    for (const label of labels) {
      const inline = lines[index].match(new RegExp(`^(?:${label.source})(?:\\s*[:#-]\\s*|\\s+)${valuePattern.source}$`, 'i'));
      if (inline?.[1]?.trim()) values.push(inline[1].trim());
      else if (new RegExp(`^(?:${label.source})\\s*[:#-]?\\s*$`, 'i').test(lines[index])) {
        const next = lines[index + 1]?.trim();
        if (next && valuePattern.test(next)) values.push(next);
      }
    }
  }
  return values;
}

export function setHigh(fields: ParsedFields, field: ExtractedJobField, value: string) {
  if (value) fields[field] = { value, confidence: 'high' };
}

export function setMedium(fields: ParsedFields, field: ExtractedJobField, value: string) {
  if (value && !fields[field]) fields[field] = { value, confidence: 'medium' };
}

function normalizedDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return '';
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

export function commonLabeledFields(lines: string[]): ParsedFields {
  const fields: ParsedFields = {};
  setHigh(fields, 'jobNumber', labeledValue(lines, [/job\s*number/, /job\s*no\.?/, /job\s*#/, /project\s*(?:number|no\.?|#)/] , /([A-Z0-9-]+)/));
  setHigh(fields, 'jobName', labeledValue(lines, [/job[.\s]*name/, /project\s*name/]));
  setHigh(fields, 'customer', labeledValue(lines, [/customer/, /custiomer/, /contractor/]));
  setHigh(fields, 'estimateNumber', labeledValue(lines, [/estimate\s*number/, /estimate\s*no\.?/, /estimate\s*#/, /estimate/], /([A-Z0-9][A-Z0-9./-]*)/));
  setHigh(fields, 'workOrderNumber', labeledValue(lines, [/work\s*order\s*number/, /work\s*order\s*no\.?/, /work\s*order\s*#/, /w\/?o\s*#/] , /([A-Z0-9-]+)/));
  setHigh(fields, 'plateNumber', labeledValue(lines, [/(?:color\s*)?plate\s*number/, /(?:color\s*)?plate\s*no\.?/, /(?:color\s*)?plate\s*#/] , /([A-Z0-9-]+)/));
  setHigh(fields, 'productType', labeledValue(lines, [/product\s*type/, /production\s*type/, /system/, /type/]));
  setHigh(fields, 'resin', labeledValue(lines, [/resin(?:\s*type)?/]));
  setHigh(fields, 'thickness', labeledValue(lines, [/thickness/]));
  setHigh(fields, 'pieces', labeledValue(lines, [/(?:no\.?\s*of\s*)?pieces/, /quantity/, /pcs\.?/] , /(\d+)/));
  setHigh(fields, 'requestedDelivery', normalizedDate(labeledValue(lines, [/requested\s*(?:delivery|ship)\s*date/, /due\s*date/, /delivery\s*date/])));
  setHigh(fields, 'location', labeledValue(lines, [/location/, /job\s*site/, /project\s*location/]));
  return fields;
}
