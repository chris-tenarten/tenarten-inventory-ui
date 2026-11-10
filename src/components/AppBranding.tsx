import EarlyAccessBadge from "@/components/EarlyAccessBadge";
import { DevEnvironmentLockup, DevLoginWordmark, DevWordmarkOverlay } from "@/components/DevBranding";
import { EARLY_ACCESS_ENABLED } from "@/lib/early-access.mjs";
import { BRANDING } from "@/lib/dev-branding.mjs";

export function HeaderProductName({ loginGate }: { loginGate: boolean }) {
  if (BRANDING.showDeveloperArtwork && loginGate) {
    return <span className="tendev-engineering-stencil">{BRANDING.productName}</span>;
  }

  return <>{BRANDING.showDeveloperArtwork ? "TenOps" : BRANDING.productName}</>;
}

export function HeaderBrandArtwork({ loginGate }: { loginGate: boolean }) {
  return BRANDING.showDeveloperArtwork && !loginGate ? <DevWordmarkOverlay /> : null;
}

export function BrandSubtitle({ productionSubtitle }: { productionSubtitle: string }) {
  return (
    <span className={BRANDING.showDeveloperArtwork ? "tendev-engineering-stencil" : ""}>
      {BRANDING.subtitle ?? productionSubtitle}
    </span>
  );
}

export function HeaderEnvironmentIdentity({ loginGate }: { loginGate: boolean }) {
  if (BRANDING.showDeveloperArtwork) return loginGate ? null : <DevEnvironmentLockup />;
  if (!BRANDING.allowEarlyAccessBadge || !EARLY_ACCESS_ENABLED) return null;
  return <EarlyAccessBadge title="TenOps Early Access environment" />;
}

export function LoginBrandIdentity({ productionSubtitle }: { productionSubtitle: string }) {
  const subtitle = BRANDING.subtitle ?? productionSubtitle;

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {BRANDING.showDeveloperArtwork
          ? <DevLoginWordmark />
          : <h1 className="text-3xl font-bold tracking-tight text-slate-950">{BRANDING.productName}</h1>}
        {BRANDING.allowEarlyAccessBadge && EARLY_ACCESS_ENABLED && (
          <EarlyAccessBadge title="TenOps Early Access environment" />
        )}
      </div>
      <div
        className={`mt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-600 ${
          BRANDING.showDeveloperArtwork ? "tendev-engineering-stencil text-[14px]" : ""
        }`}
      >
        {subtitle}
      </div>
    </>
  );
}
