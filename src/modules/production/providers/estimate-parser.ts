import {
  normalizedLines,
  setHigh,
  type ParsedFields,
} from './parser-utils';

const ESTIMATE_NUMBER = /^Q\d{2}-\d{4}-\d+(?:\.\d+)?$/i;
const PLATE_NUMBER = /\b[TD]\d{2}-\d{3}[A-Z]?(?:-[A-Z])?(?:\s*\(TZ-[A-Z0-9]+\))?/i;

export function parseEstimate(text: string): ParsedFields {
  const lines = normalizedLines(text);
  const fields: ParsedFields = {};
  const estimateIndex = lines.findIndex((line) => /^estimate\s*#\s*:?.*$/i.test(line));
  const estimateNumber = lines
    .slice(Math.max(0, estimateIndex + 1), estimateIndex + 7)
    .find((line) => ESTIMATE_NUMBER.test(line)) ?? '';
  setHigh(fields, 'estimateNumber', estimateNumber);
  if (estimateNumber) {
    const valueIndex = lines.indexOf(estimateNumber);
    const customer = lines[valueIndex + 1] ?? '';
    if (customer && !/^(?:f\.?o\.?b\.?|lead\s+time|side\s+mark)$/i.test(customer)) {
      setHigh(fields, 'customer', customer);
    }
  }
  const explicitPlateContext = text.match(/(?:color\s+plate|formula)[\s\S]{0,100}?([TD]\d{2}-\d{3}[A-Z]?(?:-[A-Z])?(?:\s*\(TZ-[A-Z0-9]+\))?)/i)?.[1] ?? '';
  setHigh(fields, 'plateNumber', explicitPlateContext.match(PLATE_NUMBER)?.[0] ?? '');
  return fields;
}
