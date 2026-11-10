import type { PurchaseOrderLine } from './types';

const component = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');

export function suggestedPartBQuantity(lines: PurchaseOrderLine[], targetIndex: number, ratio = 5): string {
  const target = lines[targetIndex];
  if (!(ratio > 0) || target?.materialType !== 'resin' || !/\b(part b|hardener)\b/.test(component(target.details.componentType))) return '';
  const candidates = lines.filter((line, index) => index !== targetIndex && line.materialType === 'resin' && /\bpart a\b/.test(component(line.details.componentType)));
  const targetIdentity = component(`${target.details.materialNameSnapshot} ${target.details.resinColor}`);
  const partA = candidates.find((line) => component(`${line.details.materialNameSnapshot} ${line.details.resinColor}`) === targetIdentity) || candidates[0];
  const quantity = Number(partA?.details.quantityOrdered);
  if (!(quantity > 0)) return '';
  return String(Number((quantity / ratio).toFixed(4)));
}
