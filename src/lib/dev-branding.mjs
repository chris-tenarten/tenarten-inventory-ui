export const isDevBrandingEnabled = (value) => value === "true";

export const DEV_BRANDING_ENABLED = isDevBrandingEnabled(
  process.env.NEXT_PUBLIC_DEV_BRANDING,
);

const PRODUCTION_BRANDING = Object.freeze({
  environment: "production",
  productName: "TenOps",
  subtitle: null,
  defaultAppearance: "light",
  showDeveloperArtwork: false,
  allowEarlyAccessBadge: true,
});

const DEVELOPMENT_BRANDING = Object.freeze({
  environment: "development",
  productName: "TenDev",
  subtitle: "RESEARCH & DEVELOPMENT",
  defaultAppearance: "dark",
  showDeveloperArtwork: true,
  allowEarlyAccessBadge: false,
});

export const getBrandingConfig = (developmentEnabled) =>
  developmentEnabled ? DEVELOPMENT_BRANDING : PRODUCTION_BRANDING;

export const BRANDING = getBrandingConfig(DEV_BRANDING_ENABLED);
