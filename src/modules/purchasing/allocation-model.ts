import type { PurchaseOrderLine } from './types';
export function allocationError(line: PurchaseOrderLine): string {
 const rows = line.allocations ?? [];
 if (rows.some(row => !row.productionJobId || !Number.isFinite(Number(row.quantity)) || !(Number(row.quantity) > 0))) return 'Choose a Job and positive quantity for each allocation.';
 if (new Set(rows.map(row => row.productionJobId)).size !== rows.length) return 'Use one allocation per Job on this line.';
 if (rows.reduce((sum, row) => sum + Number(row.quantity), 0) > Number(line.details.quantityOrdered) + 0.0000001) return 'Allocations exceed the PO line quantity.';
 return '';
}
