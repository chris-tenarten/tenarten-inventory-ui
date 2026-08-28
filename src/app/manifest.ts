import type { MetadataRoute } from 'next';
import { BRANDING } from '@/lib/dev-branding.mjs';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  const dark = BRANDING.defaultAppearance === 'dark';
  const iconPrefix = BRANDING.showDeveloperArtwork ? 'tendev-app-icon' : 'tenops-gold-app-icon';

  return {
    id: '/my-work',
    name: BRANDING.productName,
    short_name: BRANDING.productName,
    description: 'Tenarten operations and personal task workspace',
    start_url: '/my-work',
    scope: '/',
    display: 'standalone',
    background_color: dark ? '#11151b' : '#eef1f4',
    theme_color: dark ? '#11151b' : '#eef1f4',
    orientation: 'any',
    icons: [
      {
        src: `/${iconPrefix}-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/${iconPrefix}-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
