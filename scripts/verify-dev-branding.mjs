import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getBrandingConfig, isDevBrandingEnabled } from "../src/lib/dev-branding.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [shell, appBranding, overlays, layout, settings, appearance, styles] = await Promise.all([
  read("src/app/client-layout-shell.tsx"),
  read("src/components/AppBranding.tsx"),
  read("src/components/DevBranding.tsx"),
  read("src/app/layout.tsx"),
  read("src/app/settings/page.tsx"),
  read("src/lib/appearance.tsx"),
  read("src/app/globals.css"),
]);

assert.equal(isDevBrandingEnabled("true"), true);
for (const value of [undefined, "", "TRUE", "1", "false"]) assert.equal(isDevBrandingEnabled(value), false);
const production = getBrandingConfig(false);
const development = getBrandingConfig(true);
assert.deepEqual(
  { name: production.productName, subtitle: production.subtitle, appearance: production.defaultAppearance, artwork: production.showDeveloperArtwork, earlyAccess: production.allowEarlyAccessBadge },
  { name: "TenOps", subtitle: null, appearance: "light", artwork: false, earlyAccess: true },
);
assert.deepEqual(
  { name: development.productName, subtitle: development.subtitle, appearance: development.defaultAppearance, artwork: development.showDeveloperArtwork, earlyAccess: development.allowEarlyAccessBadge },
  { name: "TenDev", subtitle: "RESEARCH & DEVELOPMENT", appearance: "dark", artwork: true, earlyAccess: false },
);
assert.equal("accessStorageKey" in development, false);
assert.equal("accessPassword" in development, false);
assert.doesNotMatch(shell, /accessStorageKey|accessPassword/);
assert.doesNotMatch(shell, /DEV_BRANDING_ENABLED|RESEARCH & DEVELOPMENT|tendev_internal_access|harlesbarkley/);
assert.match(appBranding, /BRANDING\.subtitle \?\? productionSubtitle/);
assert.match(appBranding, /BRANDING\.showDeveloperArtwork/);
assert.match(appBranding, /BRANDING\.allowEarlyAccessBadge/);
assert.match(appBranding, /HeaderProductName[\s\S]*loginGate[\s\S]*tendev-engineering-stencil/);
assert.match(appBranding, /HeaderBrandArtwork[\s\S]*!loginGate[\s\S]*DevWordmarkOverlay/);
assert.match(appBranding, /HeaderEnvironmentIdentity[\s\S]*loginGate \? null : <DevEnvironmentLockup/);
assert.match(shell, /HeaderProductName loginGate=\{!shellUnlocked\}/);
assert.match(shell, /HeaderBrandArtwork loginGate=\{!shellUnlocked\}/);
assert.match(shell, /HeaderEnvironmentIdentity loginGate=\{!shellUnlocked\}/);
assert.match(overlays, /\/dev-branding\/tendev-overlay\.webp/);
assert.match(overlays, /\/dev-branding\/development-environment\.webp/);
assert.match(overlays, /\/dev-branding\/chris-tag\.webp/);
assert.match(overlays, /data-dev-branding-login-environment/);
assert.match(overlays, /w-\[4\.25rem\][\s\S]*sm:w-\[5\.75rem\]/);
assert.match(overlays, /w-10[\s\S]*sm:w-\[3\.6rem\]/);
assert.equal((overlays.match(/chris-tag\.webp/g) ?? []).length, 1);
assert.match(appBranding, /BRANDING\.productName/);
assert.match(appBranding, /tendev-engineering-stencil/);
assert.equal((overlays.match(/pointer-events-none/g) ?? []).length, 3);
assert.equal((overlays.match(/aria-hidden="true"/g) ?? []).length, 3);
assert.match(overlays, /development-environment[\s\S]*w-\[4\.25rem\][\s\S]*sm:w-\[4\.8rem\]/);
assert.match(overlays, /tendev-overlay[\s\S]*rotate-\[4deg\]/);
assert.equal((overlays.match(/rotate-/g) ?? []).length, 2);
assert.doesNotMatch(overlays, /overflow-hidden|object-cover/);
assert.match(layout, /BRANDING\.defaultAppearance/);
assert.match(layout, /BRANDING\.showDeveloperArtwork/);
assert.match(layout, /data-appearance=\{defaultAppearance\}/);
assert.match(layout, /allowUserAppearance=\{BRANDING\.showDeveloperArtwork\}/);
assert.match(settings, /BRANDING\.showDeveloperArtwork && <section/);
assert.match(appearance, /defaultAppearance = "light"/);
assert.match(styles, /\.tendev-engineering-stencil/);
assert.match(styles, /Bank Gothic[\s\S]*Eurostile[\s\S]*DIN Alternate[\s\S]*OCR A Std/);

console.log("Dev branding structural checks passed.");
