import type { PurchasingCatalogSuggestion } from './types';

const unit = (value: string) => value.trim().toLowerCase().replace(/s$/, '');

export type CatalogPricingMode = 'individual' | 'bulk' | 'truckload';

export function getCatalogPricingMode(item: PurchasingCatalogSuggestion, quantity: string, orderUnit: string): CatalogPricingMode {
  const entered = Number(quantity);
  if (!(entered >= 0)) return 'individual';
  const truckloadThreshold = Number(item.truckloadMinimumQuantity);
  if (truckloadThreshold > 0 && entered >= truckloadThreshold && unit(item.truckloadMinimumUom) === unit(orderUnit)) return 'truckload';
  const bulkThreshold = Number(item.bulkMinimumQuantity);
  if (bulkThreshold > 0 && entered >= bulkThreshold && unit(item.bulkMinimumUom) === unit(orderUnit)) return 'bulk';
  return 'individual';
}

export function getApplicableCatalogPrice(item: PurchasingCatalogSuggestion, quantity: string, orderUnit: string) {
  const mode = getCatalogPricingMode(item, quantity, orderUnit);
  return { mode, price: mode === 'truckload' ? item.truckloadPrice : mode === 'bulk' ? item.bulkPrice : item.referencePrice };
}
