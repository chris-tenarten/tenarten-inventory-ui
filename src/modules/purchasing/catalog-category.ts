import type { PurchasingCatalogSuggestion } from "./types";

export const purchasingCatalogCategories = [
  "marble",
  "glass",
  "resin",
  "filler",
  "misc",
] as const;

export type PurchasingCatalogCategory =
  (typeof purchasingCatalogCategories)[number];

export function getPurchasingCatalogCategory(
  item?: Pick<PurchasingCatalogSuggestion, "materialType" | "materialName">,
): PurchasingCatalogCategory {
  const value =
    `${item?.materialType || ""} ${item?.materialName || ""}`.toLowerCase();
  if (value.includes("glass")) return "glass";
  if (value.includes("resin")) return "resin";
  if (value.includes("filler")) return "filler";
  if (/marble|aggregate|chip/.test(value)) return "marble";
  return "misc";
}
