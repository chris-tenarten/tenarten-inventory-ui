import { BRANDING } from '@/lib/dev-branding.mjs';

export const dynamic = 'force-static';

export function GET() {
  const dark = BRANDING.defaultAppearance === 'dark';
  const iconPrefix = BRANDING.showDeveloperArtwork ? 'tendev-app-icon' : 'tenops-gold-app-icon';
  return Response.json({
    id: '/',
    name: BRANDING.productName,
    short_name: BRANDING.productName,
    description: 'Tenarten operations control',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: dark ? '#11151b' : '#eef1f4',
    theme_color: dark ? '#11151b' : '#eef1f4',
    orientation: 'any',
    icons: [
      { src: `/${iconPrefix}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/${iconPrefix}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }, { headers: { 'content-type': 'application/manifest+json' } });
}
