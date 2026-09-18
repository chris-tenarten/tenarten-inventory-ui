import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import {
  buildSamplePdfModel,
  paginateSampleRows,
  sampleRowHeight,
  wrapSampleText,
} from "../supabase/functions/_shared/sample-work-order-pdf-model.mjs";

const model = buildSamplePdfModel({
  project_name: "Project",
  customer_name: "Customer",
  color_plate_number: "T26-123A",
  approved_date: null,
  blend_rows: [
    { percentage: 50, color: "Authored White Override", vendor: "Authored Vendor", catalog_snapshot: { material_name: "Catalog White", vendor: "Snapshot Vendor" } },
    { percentage: 50, color: "Manual Blue" },
  ],
});
assert.equal(model.colorPlateNumber, "T26-123A");
assert.equal(model.rows.length, 2);
assert.equal(model.rows[0].color, "Authored White Override");
assert.equal(model.rows[0].vendor, "Authored Vendor");
const massBalance=buildSamplePdfModel({formulation_state:{basis:"weight_per_sf",calculationVersion:"sample-formulation-v2-mass-balance",totalFormulaWeightOz:"100",derived:{totalFormulaWeightOz:100,availableChipMixOz:64,nonChipWeightOz:36}},blend_rows:[{quantity_provenance:"calculated",calculated_quantity:25.6,unit:"oz"}]});
assert.match(massBalance.formulationSummary,/Total Formula 100 oz/);assert.match(massBalance.formulationSummary,/Chip Mix 64 oz/);assert.equal(massBalance.rows[0].unit,"oz");
const historicalParity=buildSamplePdfModel({formulation_state:{basis:"weight_per_sf",calculationVersion:"sample-formulation-v3-historical-parity",materialDensity:"128",thicknessIn:"0.375",resinParts:"5",hardenerParts:"1",derived:{areaSf:1,effectiveWeightPerSf:4,availableChipMixOz:64}},blend_rows:[{component_role:"aggregate",quantity_provenance:"calculated",calculated_quantity:25.6,unit:"oz"},{component_role:"resin",quantity_provenance:"manual",quantity:15,unit:"fl oz"},{component_role:"hardener",quantity_provenance:"calculated",calculated_quantity:3,unit:"fl oz"}]});
assert.match(historicalParity.formulationSummary,/Chip Mix 64 oz/);assert.match(historicalParity.formulationSummary,/Calculated from production pour/);assert.doesNotMatch(historicalParity.formulationSummary,/Total Formula/);assert.deepEqual(historicalParity.rows.map(row=>row.unit),["oz","fl oz","fl oz"]);
assert.equal(paginateSampleRows(Array.from({ length: 38 }, (_, index) => ({ index }))).length, 4);
assert.ok(sampleRowHeight({ color: "Custom Recycled Cobalt Glass Blend with additional hand-sorted aggregate", vendor: "Local manual stock" }) > 36);
assert.deepEqual(wrapSampleText("extraordinarilylongmaterialname", 8), ["extraord", "inarilyl", "ongmater", "ialname"]);

const bytes = readFileSync("output/pdf/sample-work-order-pp003-candidate.pdf");
const pdf = await PDFDocument.load(bytes);
assert.equal(pdf.getPageCount(), 2);
assert.deepEqual(pdf.getPage(0).getSize(), { width: 612, height: 792 });
assert.deepEqual(pdf.getPage(1).getSize(), { width: 612, height: 792 });
const renderer = readFileSync("supabase/functions/generate-sample-pdf/index.ts", "utf8");
assert.match(renderer, /CHIP BLEND/);
assert.match(renderer, /Resin Color and #/);
assert.doesNotMatch(renderer, /…/);
console.log("sample work order PDF verifier passed");
