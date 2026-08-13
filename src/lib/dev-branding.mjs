export const isDevBrandingEnabled = (value) => value === "true";

export const DEV_BRANDING_ENABLED = isDevBrandingEnabled(
  process.env.NEXT_PUBLIC_DEV_BRANDING,
);

const PRODUCTION_BRANDING = Object.freeze({
  environment: "production",
  productName: "TenOps",
  subtitle: null,
  defaultAppearance: "light",
  accessStorageKey: "tenarten_internal_access",
  accessPassword: "tenarten123",
  showDeveloperArtwork: false,
  allowEarlyAccessBadge: true,
});

const DEVELOPMENT_BRANDING = Object.freeze({
  environment: "development",
  productName: "TenDev",
  subtitle: "RESEARCH & DEVELOPMENT",
  defaultAppearance: "dark",
  accessStorageKey: "tendev_internal_access_v1",
  accessPassword: "harlesbarkley",
  showDeveloperArtwork: true,
  allowEarlyAccessBadge: false,
});

export const getBrandingConfig = (developmentEnabled) =>
  developmentEnabled ? DEVELOPMENT_BRANDING : PRODUCTION_BRANDING;

export const BRANDING = getBrandingConfig(DEV_BRANDING_ENABLED);
