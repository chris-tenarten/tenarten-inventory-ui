import { supabase } from "@/lib/supabase";
import { combinePurchasingCatalogRecords } from "./catalog-records";
import type { PurchasingCatalogSuggestion } from "./types";

type CatalogRecord = Record<string, unknown>;

export { samePurchasingVendor } from "./catalog-records";

export async function searchPurchasingCatalog(
  term: string,
  vendor = "",
): Promise<PurchasingCatalogSuggestion[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const standardQuery = supabase
    .from("vendor_catalog")
    .select(
      "id,vendor,vendor_sku,item_name,size,category,material_class,unit,price,price_basis",
    )
    .or(
      `item_name.ilike.%${q}%,vendor_sku.ilike.%${q}%,vendor.ilike.%${q}%,size.ilike.%${q}%`,
    )
    .limit(250);
  const specialtyQuery = supabase
    .from("vendor_catalog_v2")
    .select(
      "id,vendor_name,vendor_sku,item_name,canonical_item_name,size,canonical_size,category,material_type,packaging,unit_size,unit_size_uom,price,bulk_price,bulk_minimum_quantity,bulk_minimum_uom,truckload_price,truckload_minimum_quantity,truckload_minimum_uom,price_unit,minimum_order_qty,minimum_order_uom,lead_time_days,is_active",
    )
    .eq("is_active", true)
    .or(
      `item_name.ilike.%${q}%,canonical_item_name.ilike.%${q}%,vendor_sku.ilike.%${q}%,vendor_name.ilike.%${q}%,size.ilike.%${q}%,canonical_size.ilike.%${q}%`,
    )
    .limit(250);
  const [standard, specialty] = await Promise.all([
    standardQuery,
    specialtyQuery,
  ]);
  if (standard.error && specialty.error) {
    throw new Error("Catalog search is temporarily unavailable.");
  }
  return combinePurchasingCatalogRecords(
    (standard.error ? [] : standard.data ?? []) as CatalogRecord[],
    (specialty.error ? [] : specialty.data ?? []) as CatalogRecord[],
    vendor,
  );
}
