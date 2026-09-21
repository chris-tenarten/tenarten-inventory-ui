import assert from "node:assert/strict";
import fs from "node:fs";

const tutorial = fs.readFileSync("src/modules/samples/SampleFormulationTutorial.tsx", "utf8");
const workspace = fs.readFileSync("src/modules/samples/SampleWorkspace.tsx", "utf8");
const configurator = fs.readFileSync("src/modules/samples/SampleFormulationConfigurator.tsx", "utf8");
const versions = fs.readFileSync("src/modules/samples/SampleVersionHistory.tsx", "utf8");

const steps = ["finished-pieces", "production-pour", "chip-mix", "aggregates", "filler", "resin-hardener", "review"];
for (const step of steps) assert.match(tutorial, new RegExp(`"${step}"`), `missing ${step} tutorial step`);
assert.match(tutorial, /Step \{index \+ 1\} of \{sampleTutorialSteps\.length\}/);
assert.match(tutorial, /Changing a quantity and changing the formulation are not the same thing\./);
assert.match(tutorial, /The Production Pour—not the finished-piece area—is what TenOps uses to calculate material quantities\./);
assert.match(tutorial, /Filler is independent during normal editing\./);
assert.match(tutorial, /Use Adjust Formulation only when you intend to coordinate Filler, effective Chip density, and Chip Mix/);
assert.match(tutorial, /WORKING SAMPLE - NOT ISSUED/);
assert.match(tutorial, /role="region"/);
assert.doesNotMatch(tutorial, /aria-modal/);
assert.match(tutorial, /aria-live="polite"/);
assert.match(tutorial, /prefers-reduced-motion/);
assert.match(tutorial, /event\.key !== "Escape"/);
assert.match(tutorial, /Adjust Formulation/);
assert.match(tutorial, /pointer-events-none/);
assert.match(tutorial, /max-h-\[42vh\]/);

assert.match(workspace, /Guide me/);
assert.match(workspace, /draft\.formulation\.calculationVersion === SAMPLE_FORMULATION_CALCULATION_VERSION/);
assert.match(workspace, /tutorialActive/);
assert.match(workspace, /setTutorialStep\("finished-pieces"\)/);
assert.match(workspace, /data-sample-tutorial="aggregate-section"/);
assert.match(workspace, /row\.componentRole === "filler" \? "filler"/);
assert.match(configurator, /data-sample-tutorial="finished-pieces"/);
assert.match(configurator, /data-sample-tutorial="production-pour"/);
assert.match(configurator, /data-sample-tutorial="chip-summary"/);
assert.match(configurator, /data-sample-tutorial="advanced-settings"/);
assert.match(versions, /data-sample-tutorial="working-sheet"/);

for (const source of [tutorial, workspace, configurator, versions]) {
  assert.doesNotMatch(source, /localStorage.*tutorial|sessionStorage.*tutorial/i);
}
for (const forbidden of ["saveSample(", "generateSamplePdf(", "generateWorkingSamplePdf(", "issueSample(", "searchPurchasingCatalog("]) {
  assert.doesNotMatch(tutorial, new RegExp(forbidden.replace("(", "\\(")), `tutorial must not invoke ${forbidden}`);
}

console.log("Sample formulation tutorial verification passed: 7 V4-only presentational steps, approved copy, stable anchors, accessibility and no persistence/network actions.");
