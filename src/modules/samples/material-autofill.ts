import type { PurchasingCatalogSuggestion } from "@/modules/purchasing/types";
import type { SampleBlendRow } from "./types";

export function sampleBlendCatalogAutofill(
  current: SampleBlendRow,
  item: PurchasingCatalogSuggestion,
): Partial<SampleBlendRow> {
  return {
    color: item.materialName,
    size: item.chipSize || current.size,
    materialType: item.materialType || current.materialType,
    unit: item.packageMeasure,
    vendor: item.vendor || current.vendor,
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
