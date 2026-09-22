import type { PurchasingCatalogSuggestion } from "@/modules/purchasing/types";
import type { SampleBlendRow } from "./types";

export function sampleBlendCatalogAutofill(
  _current: SampleBlendRow,
  item: PurchasingCatalogSuggestion,
): Partial<SampleBlendRow> {
  return {
    color: item.materialName,
    size: item.chipSize,
    materialType: item.materialType,
    unit: item.packageMeasure,
    vendor: item.vendor,
    catalogSource: item.source,
    catalogItemId: item.id,
    catalogSnapshot: {
      material_name: item.materialName,
      size: item.chipSize,
      material_type: item.materialType,
      unit: item.packageMeasure,
      vendor: item.vendor,
      vendor_sku: item.vendorSku,
    },
  };
}

/** Clear only values still owned by the previous Catalog selection. */
export function clearSampleCatalogSelection(current: SampleBlendRow): Partial<SampleBlendRow> {
  if (!current.catalogItemId && !current.catalogSource) return {};
  const snapshot = current.catalogSnapshot;
  const changes: Partial<SampleBlendRow> = { catalogSource: null, catalogItemId: null, catalogSnapshot: {} };
  if (current.size === snapshot.size) changes.size = "";
  if (current.materialType === snapshot.material_type) changes.materialType = "";
  if (current.vendor === snapshot.vendor) changes.vendor = "";
  if (current.unit === snapshot.unit) changes.unit = "";
  return changes;
}
