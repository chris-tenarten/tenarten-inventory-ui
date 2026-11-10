import type {SampleBlendRow} from './types';

/** Vendor overrides do not rewrite the original offer's identity, SKU or package evidence. */
export function sampleVendorPackageWarning(row: SampleBlendRow): string | null {
  const snapshot = row.catalogSnapshot;
  const catalogVendor = typeof snapshot.vendor === 'string' ? snapshot.vendor.trim() : '';
  if (!catalogVendor || catalogVendor.toLocaleLowerCase() === row.vendor.trim().toLocaleLowerCase() ||
      (!snapshot.package_context && !snapshot.vendor_sku)) return null;
  return `Catalog SKU/package belongs to ${catalogVendor}. Confirm packaging for the chosen supplier before using bag equivalents.`;
}
