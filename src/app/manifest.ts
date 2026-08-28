import type { MetadataRoute } from 'next';
import { BRANDING } from '@/lib/dev-branding.mjs';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  const dark = BRANDING.defaultAppearance === 'dark';

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
        src: '/logo.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
