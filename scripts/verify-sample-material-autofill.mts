import assert from "node:assert/strict";
import { sampleBlendCatalogAutofill } from "../src/modules/samples/material-autofill";
import { blankSampleBlendRow } from "../src/modules/samples/types";
import type { PurchasingCatalogSuggestion } from "../src/modules/purchasing/types";

const suggestion = (overrides: Partial<PurchasingCatalogSuggestion> = {}): PurchasingCatalogSuggestion => ({
  source: "standard",
  id: "catalog-1",
  vendor: "Arim",
  vendorSku: "AW-1",
  materialName: "Alaska White",
  chipSize: "#1",
  packageQuantity: "",
  packageMeasure: "",
  containerType: "",
  materialType: "marble",
  referencePrice: "12.50",
  bulkPrice: "",
  bulkMinimumQuantity: "",
  bulkMinimumUom: "",
  truckloadPrice: "",
  truckloadMinimumQuantity: "",
  truckloadMinimumUom: "",
  priceBasis: "less than pallet order",
  leadTimeDays: null,
  minimumOrder: "",
  score: 10,
  ...overrides,
});

const manual = {
  ...blankSampleBlendRow(0),
  color: "Manual blue",
  size: "Custom size",
  materialType: "Custom type",
  quantity: "2.5",
  unit: "scoop",
  vendor: "Manual vendor",
};

const arim = sampleBlendCatalogAutofill(manual, suggestion());
assert.equal(arim.color, "Alaska White");
assert.equal(arim.size, "#1");
assert.equal(arim.materialType, "marble");
assert.equal(arim.vendor, "Arim");
assert.equal(arim.unit, "", "procurement price basis must not become a formulation unit");
assert.equal(arim.catalogSnapshot?.unit, "");

const measured = sampleBlendCatalogAutofill(manual, suggestion({ packageMeasure: "LB" }));
assert.equal(measured.unit, "LB");
assert.equal(measured.catalogSnapshot?.unit, "LB");

const overridden = { ...manual, ...measured, unit: "oz", vendor: "Authored vendor" };
assert.equal(overridden.unit, "oz");
assert.equal(overridden.vendor, "Authored vendor");
assert.equal(overridden.catalogItemId, "catalog-1");
assert.equal(manual.catalogItemId, null);
assert.equal(manual.color, "Manual blue");

console.log("sample material autofill verifier passed");
