// Pure shared catalog proposal validation; the canonical database remains final.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Node/Deno module
// @ts-ignore -- explicit extension required by Edge.
import {samePurchasingVendor} from '../../../src/modules/purchasing/catalog-records.ts';
import type {ProposedCatalogMaterial} from '../../../src/modules/tenbot/live-review.ts';

export function catalogRequestIssues(value: ProposedCatalogMaterial, invoiceSupplier?: string): Partial<Record<keyof ProposedCatalogMaterial, string>> {
  const issues: Partial<Record<keyof ProposedCatalogMaterial, string>> = {};
  for (const key of ['supplier','itemName','vendorSku','materialType','size','unitSize','unitSizeUom','packaging','priceUnit','notes'] as const) {
    if (typeof value[key] !== 'string' || value[key].length > (key === 'notes' ? 1200 : 160) || /[\u0000-\u001f\u007f]/.test(value[key])) issues[key] = 'Use bounded plain text for this catalog field.';
  }
  if (!value.supplier?.trim()) issues.supplier = 'Supplier is required.';
  else if (invoiceSupplier && !samePurchasingVendor(value.supplier,invoiceSupplier)) issues.supplier = `Invoice supplier is ${invoiceSupplier}. Choose that supplier for this proposal.`;
  if (!value.itemName?.trim()) issues.itemName = 'Material name is required.';
  if (!['chip','resin','pigment','filler','other'].includes(value.materialType)) issues.materialType = 'Choose a material type.';
  if (value.materialType === 'chip' && !value.size?.trim()) issues.size = 'Chip size is required.';
  const unit = typeof value.priceUnit === 'string' ? receivalUnit(value.priceUnit) : '';
  if (!unit) issues.priceUnit = 'A supported order unit is required.';
  const packageUnit = ['Bag','Pail','Box','Bucket','Drum','Case','Tote','Kit'].includes(unit);
  if (packageUnit || value.unitSize || value.unitSizeUom || value.packaging) {
    if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(value.unitSize) || !(Number(value.unitSize) > 0)) issues.unitSize = 'Package amount must be a positive decimal.';
    if (!['LB','GAL','KG','OZ','L'].includes(value.unitSizeUom)) issues.unitSizeUom = 'Choose the package measure.';
    if (!value.packaging?.trim() || packageUnit && receivalUnit(value.packaging) !== unit) issues.packaging = 'Container must match the proposed order unit.';
  }
  return issues;
}
/** Completing local fields prepares a proposal, never employee approval. */
export function completeCatalogRequest(value: ProposedCatalogMaterial): ProposedCatalogMaterial { return {...value,prepared:Object.keys(catalogRequestIssues(value)).length===0}; }
// Advisory display validation follows the existing invoice unit aliases; the
// caller-authorized server remains responsible for accepting every line.
export function receivalUnit(value: string): string {
  const key = value.trim().toLowerCase().replace(/\.$/, '');
  const groups: [string, string[]][] = [['Bag', ['bag', 'bags']], ['Pail', ['pail', 'pails']], ['Box', ['box', 'boxes']], ['Bucket', ['bucket', 'buckets']], ['Drum', ['drum', 'drums']], ['Case', ['case', 'cases']], ['Tote', ['tote', 'totes']], ['Kit', ['kit', 'kits']], ['Each', ['ea', 'each']], ['LB', ['lb', 'lbs', 'pound', 'pounds']], ['KG', ['kg', 'kilogram', 'kilograms']], ['GAL', ['gal', 'gallon', 'gallons']], ['L', ['l', 'liter', 'liters']], ['OZ', ['oz', 'ounce', 'ounces']]];
  return groups.find(([, aliases]) => aliases.includes(key))?.[0] || '';
}
