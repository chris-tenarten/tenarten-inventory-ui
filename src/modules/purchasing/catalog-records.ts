import type { PurchasingCatalogSuggestion } from "./types";

type CatalogRecord = Record<string, unknown>;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function parsePackage(value: string) {
  const match = value.match(
    /(\d+(?:\.\d+)?)\s*(lb|lbs|kg|oz)\.?\s*(bag|pail|box|bucket)?/i,
  );
  return match
    ? {
        quantity: match[1],
        measure: match[2].toUpperCase().replace("LBS", "LB"),
        container: match[3] || "",
      }
    : { quantity: "", measure: "", container: value };
}

function score(...values: string[]) {
  return /aggregate|marble|chip/.test(values.join(" ").toLowerCase()) ? 10 : 0;
}

function normalizeVendor(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/\b(inc|incorporated|llc|company|co|corp|corporation)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  if (normalized === "tmsupply") return "terrazzomarblesupply";
  if (normalized === "kci") return "klein";
  return normalized;
}

export function samePurchasingVendor(
  catalogVendor: string,
  selectedVendor: string,
) {
  return normalizeVendor(catalogVendor) === normalizeVendor(selectedVendor);
}

function mapStandard(row: CatalogRecord): PurchasingCatalogSuggestion | null {
  const materialName = text(row.item_name).trim();
  if (!materialName) return null;
  const pkg = parsePackage(text(row.unit));
  return {
    source: "standard",
    id: text(row.id),
    vendor: text(row.vendor),
    vendorSku: text(row.vendor_sku),
    materialName,
    chipSize: text(row.size),
    packageQuantity: pkg.quantity,
    packageMeasure: pkg.measure,
    containerType: pkg.container,
    materialType: `${text(row.category)} ${text(row.material_class)}`.trim(),
    referencePrice: row.price == null ? "" : text(row.price),
    bulkPrice: "",
    bulkMinimumQuantity: "",
    bulkMinimumUom: "",
    truckloadPrice: "",
    truckloadMinimumQuantity: "",
    truckloadMinimumUom: "",
    priceBasis: text(row.price_basis) || text(row.unit),
    leadTimeDays: null,
    minimumOrder: "",
    score: score(text(row.category), text(row.material_class)),
  };
}

function mapSpecialty(row: CatalogRecord): PurchasingCatalogSuggestion | null {
  if (row.is_active === false) return null;
  const materialName = (
    text(row.canonical_item_name) || text(row.item_name)
  ).trim();
  if (!materialName) return null;
  const pkg = parsePackage(text(row.packaging));
  return {
    source: "specialty",
    id: text(row.id),
    vendor: text(row.vendor_name),
    vendorSku: text(row.vendor_sku),
    materialName,
    chipSize: text(row.canonical_size) || text(row.size),
    packageQuantity:
      row.unit_size == null ? pkg.quantity : text(row.unit_size),
    packageMeasure: text(row.unit_size_uom) || pkg.measure,
    containerType: pkg.container || text(row.packaging),
    materialType: text(row.material_type) || text(row.category),
    referencePrice: row.price == null ? "" : text(row.price),
    bulkPrice: row.bulk_price == null ? "" : text(row.bulk_price),
    bulkMinimumQuantity:
      row.bulk_minimum_quantity == null
        ? ""
        : text(row.bulk_minimum_quantity),
    bulkMinimumUom: text(row.bulk_minimum_uom),
    truckloadPrice: row.truckload_price == null ? "" : text(row.truckload_price),
    truckloadMinimumQuantity:
      row.truckload_minimum_quantity == null
        ? ""
        : text(row.truckload_minimum_quantity),
    truckloadMinimumUom: text(row.truckload_minimum_uom),
    priceBasis: text(row.price_unit) || text(row.packaging),
    leadTimeDays:
      row.lead_time_days == null ? null : Number(row.lead_time_days),
    minimumOrder:
      row.minimum_order_qty == null
        ? ""
        : `${text(row.minimum_order_qty)} ${text(row.minimum_order_uom)}`.trim(),
    score: score(text(row.material_type), text(row.category)),
  };
}

function identity(item: PurchasingCatalogSuggestion) {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return [
    normalizeVendor(item.vendor),
    normalize(item.materialName),
    normalize(item.chipSize),
    normalize(item.packageQuantity),
    normalize(item.packageMeasure),
    normalize(item.containerType.replace(/s$/i, "")),
  ].join("|");
}

export function combinePurchasingCatalogRecords(
  standardRecords: CatalogRecord[],
  specialtyRecords: CatalogRecord[],
  vendor = "",
) {
  const maintained = specialtyRecords
    .map(mapSpecialty)
    .filter((item): item is PurchasingCatalogSuggestion => Boolean(item));
  const maintainedIdentities = new Set(maintained.map(identity));
  const legacy = standardRecords
    .map(mapStandard)
    .filter((item): item is PurchasingCatalogSuggestion => Boolean(item))
    .filter((item) => !maintainedIdentities.has(identity(item)));

  return [...maintained, ...legacy]
    .sort(
      (a, b) =>
        Number(Boolean(vendor) && samePurchasingVendor(b.vendor, vendor)) -
          Number(Boolean(vendor) && samePurchasingVendor(a.vendor, vendor)) ||
        b.score - a.score ||
        a.vendor.localeCompare(b.vendor) ||
        a.materialName.localeCompare(b.materialName),
    )
    .slice(0, 30);
}
