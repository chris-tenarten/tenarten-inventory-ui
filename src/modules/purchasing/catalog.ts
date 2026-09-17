import { supabase } from "@/lib/supabase";
import { combinePurchasingCatalogRecords, parsePurchasingPackage, samePurchasingVendor } from "./catalog-records";
import type { PurchasingCatalogSuggestion } from "./types";
import type { PurchaseOrderLineMaterialType } from "./types";

type CatalogRecord = Record<string, unknown>;

export { getPurchaseOrderCatalogOrderUnit, samePurchasingVendor } from "./catalog-records";

export async function loadPurchasingContainerSizeOptions(
  materialType: PurchaseOrderLineMaterialType,
  vendor = "",
): Promise<string[]> {
  if (!materialType) return [];
  const [standard, specialty] = await Promise.all([
    supabase.from("vendor_catalog").select("vendor,unit,category,material_class").not("unit", "is", null).limit(1000),
    supabase.from("vendor_catalog_v2").select("vendor_name,packaging,unit_size,unit_size_uom,material_type,category,is_active").eq("is_active", true).limit(1000),
  ]);
  const options = new Map<string, { value: string; preferred: boolean }>();
  const add = (quantity: unknown, measure: unknown, preferred: boolean) => {
    const amount = String(quantity ?? "").trim();
    const unit = String(measure ?? "").trim().toUpperCase().replace("LBS", "LB");
    if (!amount || !unit || !(Number(amount) > 0)) return;
    const value = `${amount} ${unit}`;
    const key = value.toLowerCase();
    const current = options.get(key);
    options.set(key, { value, preferred: preferred || Boolean(current?.preferred) });
  };
  for (const row of standard.data ?? []) {
    const classification = `${row.category ?? ""} ${row.material_class ?? ""}`.toLowerCase();
    if (materialType === "resin" ? !/resin|epoxy/.test(classification) : !/chip|aggregate|marble|glass|filler/.test(classification)) continue;
    const parsed = parsePurchasingPackage(String(row.unit ?? ""));
    add(parsed.quantity, parsed.measure, Boolean(vendor) && samePurchasingVendor(String(row.vendor ?? ""), vendor));
  }
  for (const row of specialty.data ?? []) {
    const classification = `${row.material_type ?? ""} ${row.category ?? ""}`.toLowerCase();
    if (materialType === "resin" ? !/resin|epoxy/.test(classification) : !/chip|aggregate|marble|glass|filler/.test(classification)) continue;
    const parsed = parsePurchasingPackage(String(row.packaging ?? ""));
    add(row.unit_size ?? parsed.quantity, row.unit_size_uom ?? parsed.measure, Boolean(vendor) && samePurchasingVendor(String(row.vendor_name ?? ""), vendor));
  }
  return [...options.values()]
    .sort((left, right) => Number(right.preferred) - Number(left.preferred) || left.value.localeCompare(right.value, undefined, { numeric: true }))
    .map((option) => option.value);
}

export async function searchPurchasingCatalog(
  term: string,
  vendor = "",
  materialType: PurchaseOrderLineMaterialType = "",
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
      "id,vendor_name,vendor_sku,item_name,canonical_item_name,size,canonical_size,color,component_type,category,material_type,packaging,unit_size,unit_size_uom,price,bulk_price,bulk_minimum_quantity,bulk_minimum_uom,truckload_price,truckload_minimum_quantity,truckload_minimum_uom,price_unit,minimum_order_qty,minimum_order_uom,lead_time_days,is_active",
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
    materialType,
  );
}
