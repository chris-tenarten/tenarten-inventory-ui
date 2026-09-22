import { supabase } from "@/lib/supabase";
import { combinePurchasingCatalogRecords, parsePurchasingPackage, samePurchasingVendor } from "./catalog-records";
import type { PurchasingCatalogSuggestion } from "./types";
import type { PurchaseOrderLineMaterialType } from "./types";

type CatalogRecord = Record<string, unknown>;

function catalogMatchesMaterialType(classification: string, materialType: PurchaseOrderLineMaterialType) {
  if (materialType === "resin") return /resin|epoxy/.test(classification);
  if (materialType === "chip") return /chip|aggregate|marble|glass/.test(classification);
  if (materialType === "pigment") return /pigment|colorant/.test(classification);
  if (materialType === "filler") return /filler/.test(classification);
  if (materialType === "other") return /other|misc/.test(classification);
  return false;
}

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
    if (!catalogMatchesMaterialType(classification, materialType)) continue;
    const parsed = parsePurchasingPackage(String(row.unit ?? ""));
    add(parsed.quantity, parsed.measure, Boolean(vendor) && samePurchasingVendor(String(row.vendor ?? ""), vendor));
  }
  for (const row of specialty.data ?? []) {
    const classification = `${row.material_type ?? ""} ${row.category ?? ""}`.toLowerCase();
    if (!catalogMatchesMaterialType(classification, materialType)) continue;
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
  options: { allowShortQuery?: boolean } = {},
): Promise<PurchasingCatalogSuggestion[]> {
  const q = term.trim();
  if (q.length < 2 && !options.allowShortQuery) return [];
  // Quote PostgREST grammar and escape LIKE wildcards in user-authored terms.
  const pattern = JSON.stringify(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const readSource = async (specialty: boolean): Promise<CatalogRecord[]> => {
    const rows: CatalogRecord[] = [];
    const seen = new Set<string>();
    let expected: number | null = null;
    for (;;) {
      const columns = specialty
        ? ["item_name", "canonical_item_name", "vendor_sku", "vendor_name", "size", "canonical_size"]
        : ["item_name", "vendor_sku", "vendor", "size"];
      let query = supabase.from(specialty ? "vendor_catalog_v2" : "vendor_catalog").select(
        specialty
          ? "id,vendor_name,vendor_sku,item_name,canonical_item_name,size,canonical_size,color,component_type,category,material_type,packaging,unit_size,unit_size_uom,price,bulk_price,bulk_minimum_quantity,bulk_minimum_uom,truckload_price,truckload_minimum_quantity,truckload_minimum_uom,price_unit,quote_required,minimum_order_qty,minimum_order_uom,lead_time_days,is_active"
          : "id,vendor,vendor_sku,item_name,size,category,material_class,unit,price,price_basis",
        { count: "exact" },
      );
      if (specialty) query = query.eq("is_active", true);
      const { data, error, count } = await query
        .or(columns.map((column) => `${column}.ilike.${pattern}`).join(","))
        .order("id").range(rows.length, rows.length + 249).returns<CatalogRecord[]>();
      const fail = () => new Error(`${specialty ? "Specialty" : "Regular"} Catalog search is incomplete. Retry your search to load both catalogs. Your draft is unchanged.`);
      if (error || count === null || (expected !== null && count !== expected)) throw fail();
      expected = count;
      const page = data ?? [];
      for (const row of page) {
        const id = String(row.id);
        if (seen.has(id)) throw fail();
        seen.add(id);
      }
      rows.push(...page);
      if (rows.length === count) return rows;
      if (!page.length || rows.length > count) throw fail();
    }
  };
  const [standard, specialty] = await Promise.all([readSource(false), readSource(true)]);
  return combinePurchasingCatalogRecords(standard, specialty, vendor, materialType);
}
