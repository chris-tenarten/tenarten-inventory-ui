export function isDevBrandingEnabled(value: string | undefined): boolean;
export const DEV_BRANDING_ENABLED: boolean;
export type BrandingConfig = Readonly<{
  environment: "production" | "development";
  productName: "TenOps" | "TenDev";
  subtitle: "RESEARCH & DEVELOPMENT" | null;
  defaultAppearance: "light" | "dark";
  showDeveloperArtwork: boolean;
  allowEarlyAccessBadge: boolean;
}>;
export function getBrandingConfig(developmentEnabled: boolean): BrandingConfig;
export const BRANDING: BrandingConfig;
