import { calculatePurchaseOrderTotals, centsToMoney } from './calculations';
import type { PurchaseOrderDraft } from './types';

export type PurchaseOrderPrintLine = { item: number; sku: string; description: string; quantity: string; unit: string; unitPrice: string; lineTotal: string };
export type PurchaseOrderPrintModel = {
  poNumber: string; poDate: string; originatedBy: string; status: 'DRAFT'|'ISSUED'; vendorName: string; vendorAddress: string; vendorContact: string;
  jobReference: string; jobNumber: string; shipTo: string; paymentTerms: string; requestedDate: string; notes: string; authorizedBy: string;
  lines: PurchaseOrderPrintLine[]; subtotal: string; discountPercent: string; discountAmount: string; taxableSubtotal: string; taxPercent: string; taxAmount: string; freight: string; total: string;
};

const displayDate = (value: string) => { if (!value) return ''; const [year, month, day] = value.split('-'); return year && month && day ? `${Number(month)}/${Number(day)}/${year.slice(-2)}` : value; };
const money = (value: number | null) => value === null ? '—' : `$ ${centsToMoney(value)}`;

export function toPurchaseOrderPrintModel(draft: PurchaseOrderDraft): PurchaseOrderPrintModel {
  const totals = calculatePurchaseOrderTotals(draft.lines.map(line => ({ quantityOrdered: line.details.quantityOrdered, unitPrice: line.details.unitPrice })), draft.discountPercent, draft.taxPercent, draft.freight);
  const lines = draft.lines.map((line, index) => {
    const details = line.details;
    const packageText = [details.packageQuantity, details.packageMeasure, details.containerType].filter(Boolean).join(' ');
    const description = [details.materialNameSnapshot, details.chipSize, packageText, details.moistureCondition ? `${details.moistureCondition[0].toUpperCase()}${details.moistureCondition.slice(1)}` : ''].filter(Boolean).join(', ');
    return { item: index + 1, sku: details.vendorSkuSnapshot, description, quantity: details.quantityOrdered, unit: details.orderUnit, unitPrice: details.unitPrice ? `$ ${details.unitPrice}` : '', lineTotal: money(totals.lineTotals[index]) };
  });
  return { poNumber: draft.poNumber || 'Not assigned', poDate: displayDate(draft.orderDate), originatedBy: draft.createdBy, status: draft.status === 'issued' ? 'ISSUED' : 'DRAFT', vendorName: draft.vendorNameSnapshot, vendorAddress: draft.vendorAddressSnapshot, vendorContact: draft.vendorContactSnapshot, jobReference: draft.jobNameSnapshot, jobNumber: draft.jobNumberSnapshot, shipTo: draft.shipToSnapshot, paymentTerms: draft.paymentTermsSnapshot, requestedDate: displayDate(draft.requestedDate), notes: draft.commercialNotes, authorizedBy: draft.authorizedBySnapshot, lines, subtotal: money(totals.subtotal), discountPercent: draft.discountPercent, discountAmount: money(totals.discountAmount), taxableSubtotal: money(totals.taxableSubtotal), taxPercent: draft.taxPercent, taxAmount: money(totals.taxAmount), freight: totals.freightAmount === null ? '—' : totals.freightAmount === 0 && !draft.freight.trim() ? '' : money(totals.freightAmount), total: money(totals.total) };
}
