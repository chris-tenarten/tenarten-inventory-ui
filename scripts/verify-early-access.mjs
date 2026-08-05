import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isEarlyAccessEnabled } from "../src/lib/early-access.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [helper, badge, appBranding, transmittal, planning, manifest] = await Promise.all([
  read("src/lib/early-access.mjs"),
  read("src/components/EarlyAccessBadge.tsx"),
  read("src/components/AppBranding.tsx"),
  read("src/modules/transmittals/JobTransmittalPanel.tsx"),
  read("src/modules/planning/timeline-model.mjs"),
  read("docs/workflows/PRODUCTION_PIPELINE.md"),
]);

assert.equal(isEarlyAccessEnabled("true"), true);
for (const value of [undefined, "", "false", "TRUE", "1", " true "]) {
  assert.equal(isEarlyAccessEnabled(value), false);
}
assert.match(helper, /process\.env\.NEXT_PUBLIC_EARLY_ACCESS/);
assert.doesNotMatch(helper, /hostname|localhost|NODE_ENV|branch/i);
assert.match(badge, /border-amber-300 bg-amber-50/);
assert.equal((appBranding.match(/EARLY_ACCESS_ENABLED/g) ?? []).length, 3);
assert.equal((appBranding.match(/title="TenOps Early Access environment"/g) ?? []).length, 2);
assert.match(appBranding, /BRANDING\.allowEarlyAccessBadge/);
assert.doesNotMatch(transmittal, /<h2[^>]*>Letter of Transmittal<\/h2>[\s\S]{0,200}<span[^>]*>[\s\S]*Early Access/);
assert.match(transmittal, /This workflow is still under active development\. Feedback is welcome\./);
assert.match(planning, /process\.env\.NEXT_PUBLIC_ENABLE_PLANNING|value === "true"/);
assert.match(manifest, /NEXT_PUBLIC_EARLY_ACCESS=true/);
assert.match(manifest, /does not enable Planning or alter application behavior/);

console.log("Early Access deployment identity checks passed.");
