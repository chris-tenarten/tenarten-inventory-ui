import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateSampleFormulation,
  standardFormulationState,
} from "../src/modules/samples/formulation";
import {
  blankSampleBlendRow,
  newLocalSample,
  sampleRowsForDisplay,
} from "../src/modules/samples/types";

const workspace = readFileSync(
  "src/modules/samples/SampleWorkspace.tsx",
  "utf8",
);
const configurator = readFileSync(
  "src/modules/samples/SampleFormulationConfigurator.tsx",
  "utf8",
);
const versions = readFileSync(
  "src/modules/samples/SampleVersionHistory.tsx",
  "utf8",
);
const queries = readFileSync("src/modules/samples/queries.ts", "utf8");

const rows = [40, 30, 20, 5, 5].map((percentage, index) => ({
  ...blankSampleBlendRow(index),
  percentage: String(percentage),
  color: `Aggregate ${index + 1}`,
}));
const standard = standardFormulationState();
const calculated = calculateSampleFormulation(standard, rows);
assert.equal(calculated.finishedAreaSf, "1");
assert.equal(calculated.areaSf, "1");
assert.equal(calculated.calculatedWeightPerSf, "4");
assert.equal(calculated.availableChipMixOz, "100");
assert.deepEqual(
  calculated.rows.map((row) => row.calculatedQuantityOz),
  ["40", "30", "20", "5", "5"],
);

const custom = calculateSampleFormulation({ ...standard, width: "24" }, rows);
assert.equal(custom.areaSf, "2");
assert.equal(custom.geometryChipMixWeight, "8");
const overridden = calculateSampleFormulation(
  { ...standard, basis: "total_weight", totalWeight: "6" },
  rows,
);
assert.equal(overridden.geometryChipMixWeight, "6");
assert.equal(overridden.availableChipMixOz, "100");

const local = newLocalSample({ preparedBy: "Gio", formulation: standard });
assert.equal(local.id, "");
assert.equal(local.blendRows[0].calculationBasis, "target_total");
assert.equal(local.blendRows[0].quantityProvenance, "calculated");
const authoredRows=[
  {...blankSampleBlendRow(0),id:"aggregate-1",percentage:"60"},
  {...blankSampleBlendRow(1),id:"filler",componentRole:"other" as const,quantityProvenance:"manual" as const,calculationBasis:null,quantity:"18"},
  {...blankSampleBlendRow(2),id:"resin",componentRole:"resin" as const,quantityProvenance:"manual" as const,calculationBasis:null,quantity:"15"},
  {...blankSampleBlendRow(3),id:"hardener",componentRole:"hardener" as const,calculationBasis:null},
  {...blankSampleBlendRow(4),id:"aggregate-2",percentage:"40"},
];
const grouped=sampleRowsForDisplay(authoredRows);
assert.deepEqual(grouped.map(({row})=>row.id),["aggregate-1","aggregate-2","filler","resin","hardener"]);
assert.deepEqual(grouped.map(({sourceIndex})=>sourceIndex),[0,4,1,2,3],"presentation grouping must retain canonical source indices");
assert.deepEqual(authoredRows.map(row=>row.id),["aggregate-1","filler","resin","hardener","aggregate-2"],"presentation grouping must not mutate persisted order");
const groupedCalculation=calculateSampleFormulation(standard,authoredRows);
assert.deepEqual(grouped.filter(({row})=>row.componentRole==='aggregate').map(({sourceIndex})=>groupedCalculation.rows[sourceIndex].calculatedQuantity),["38.4","25.6"],"calculated ounces must remain attached through source index");
assert.match(workspace, /loadSampleFormulationDefault/);
assert.match(workspace, /newLocalSample/);
assert.match(workspace, /if \(!source\.id\)/);
assert.match(workspace, /Save Draft/);
assert.match(workspace, /Keep Editing/);
assert.match(workspace, /Unsaved changes discarded/);
assert.doesNotMatch(configurator, />Total Weight</);
assert.doesNotMatch(configurator, />Weight \/ SF</);
assert.match(configurator, /Sample Plate Quantities/);
assert.match(configurator, /Adjust Sample Plate Calculation/);
assert.match(configurator, /Reset to Calculated/);
assert.match(configurator, /Total Formula Weight/);
assert.match(configurator, /Geometry Chip Mix Reference/);
assert.match(workspace, /Formula Role/);
assert.match(workspace, /sampleRowsForDisplay/);
assert.match(workspace, /Add Aggregate/);
assert.match(workspace, /Aggregate total|Total \{/);
assert.doesNotMatch(
  workspace,
  /Component calculation participation|Aggregate basis|Quantity source/,
);
assert.match(versions, /Generate Working Sheet/);
assert.match(versions, /Saved Version/);
assert.match(versions, /target\s*=\s*await onSave\(\)/);
assert.match(queries, /row\.componentRole==='aggregate'&&row\.quantityProvenance==='calculated'/);
console.log("Sample workspace UX and Draft persistence checks passed.");
