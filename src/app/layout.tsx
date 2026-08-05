import type { Metadata, Viewport } from 'next';
import './globals.css';
import ClientLayoutShell from './client-layout-shell';
import { LanguageProvider } from '@/lib/language';
import { ThemeProvider } from '@/lib/appearance';
import { BRANDING } from '@/lib/dev-branding.mjs';

export const metadata: Metadata = {
  title: {
    default: `${BRANDING.productName} Cloud — Dashboard`,
    template: `${BRANDING.productName} Cloud — %s`,
  },
  description: 'Tenarten inventory and material management',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const defaultAppearance = BRANDING.defaultAppearance;
  const appearanceBootstrap =
    `try{var s=localStorage.getItem('tenops_display_size');if(s==='compact'||s==='large'||s==='default'){document.documentElement.dataset.displaySize=s}var l=localStorage.getItem('tenops_language');if(l==='en'||l==='es'){document.documentElement.lang=l}var a=localStorage.getItem('tenops_appearance');document.documentElement.dataset.appearance=a==='dark'||a==='light'?a:'${defaultAppearance}'}catch(e){document.documentElement.dataset.appearance='${defaultAppearance}'}`;

  return (
    <html
      lang="en"
      data-display-size="default"
      data-appearance={defaultAppearance}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: appearanceBootstrap,
          }}
        />
      </head>
      <body>
        <ThemeProvider defaultAppearance={defaultAppearance}>
          <LanguageProvider>
            <ClientLayoutShell>{children}</ClientLayoutShell>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
