import { moneyToCents } from './calculations';
import type { PurchaseOrderDraft } from './types';

export function validatePurchaseOrderDraft(draft: PurchaseOrderDraft): string[] {
  const errors:string[] = [];
  if (draft.jobPoReferenceType && !draft.productionJobId) errors.push('Link a Production Job before selecting a Resin or Chip PO reference.');
  if (!draft.vendorNameSnapshot.trim()) errors.push('Vendor is required.');
  if (!draft.orderDate) errors.push('PO Date is required.');
  if (!draft.createdBy.trim()) errors.push('PO Originated By is required.');
  if (!draft.lines.length) errors.push('Add at least one line.');
  draft.lines.forEach((line,index) => {
    const label = `Line ${index + 1}`;
    if (!line.details.materialNameSnapshot.trim()) errors.push(`${label}: material is required.`);
    if (!(Number(line.details.quantityOrdered) > 0)) errors.push(`${label}: quantity must be positive.`);
    if (line.details.packageQuantity && !(Number(line.details.packageQuantity) > 0)) errors.push(`${label}: container size quantity must be positive.`);
    if (!line.details.orderUnit.trim()) errors.push(`${label}: quantity unit is required.`);
    if (line.details.unitPrice && moneyToCents(line.details.unitPrice) === null) errors.push(`${label}: unit cost is invalid.`);
  });
  for (const [label,value] of [['Discount',draft.discountPercent],['Tax',draft.taxPercent]] as const) {
    if (value.trim() && (!/^\d+(\.\d+)?$/.test(value) || Number(value) < 0 || Number(value) > 100)) errors.push(`${label} percent must be between 0 and 100.`);
  }
  if (draft.freight.trim() && moneyToCents(draft.freight) === null) errors.push('Freight must be a non-negative currency amount.');
  return errors;
}
