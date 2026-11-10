import { normalizedLines, setHigh, type ParsedFields } from './parser-utils';

function normalizeDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return '';
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

function isProjectHeading(line: string) {
  return /^(?:job\s+reference|job\s+number|ship\s+to)\s*:?$/i.test(line);
}

export function parsePurchaseOrder(text: string): ParsedFields {
  const lines = normalizedLines(text);
  const fields: ParsedFields = {};
  const referenceIndex = lines.findIndex((line) => /^job\s+reference\s*:?$/i.test(line));
  const numberIndex = lines.findIndex((line) => /^job\s+number\s*:?$/i.test(line));
  const shipToIndex = lines.findIndex((line) => /^ship\s+to\s*:?$/i.test(line));

  if (referenceIndex >= 0 && numberIndex > referenceIndex && shipToIndex > numberIndex) {
    const projectValues = lines.slice(shipToIndex + 1, shipToIndex + 7).filter((line) => !isProjectHeading(line));
    const jobNumberIndex = projectValues.findIndex((line) => /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/i.test(line));
    if (jobNumberIndex > 0) setHigh(fields, 'jobName', projectValues[jobNumberIndex - 1]);
    if (jobNumberIndex >= 0) setHigh(fields, 'jobNumber', projectValues[jobNumberIndex]);
  }

  const requestedDateLabelIndex = lines.findIndex((line) => /^(?:ship\s+)?date\s+requested\s*:?$/i.test(line));
  if (requestedDateLabelIndex >= 0) {
    const boundary = lines.findIndex((line, index) => index > requestedDateLabelIndex && /^item$/i.test(line));
    const candidates = lines.slice(requestedDateLabelIndex + 1, boundary >= 0 ? boundary : requestedDateLabelIndex + 8);
    const requestedDate = candidates.map(normalizeDate).find(Boolean) ?? '';
    setHigh(fields, 'requestedDelivery', requestedDate);
  }

  return fields;
}
