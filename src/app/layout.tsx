import type { Metadata, Viewport } from 'next';
import './globals.css';
import ClientLayoutShell from './client-layout-shell';
import { LanguageProvider } from '@/lib/language';
import { ThemeProvider } from '@/lib/appearance';
import { AuthProvider } from '@/lib/auth';
import { AccountPreferencesProvider } from '@/lib/account-preferences';
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
  const appearanceSelection = `document.documentElement.dataset.appearance='${defaultAppearance}'`;
  const appearanceBootstrap =
    `try{${appearanceSelection}}catch(e){document.documentElement.dataset.appearance='${defaultAppearance}'}`;

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
        <AuthProvider>
          <AccountPreferencesProvider>
            <ThemeProvider
              defaultAppearance={defaultAppearance}
              allowUserAppearance={BRANDING.showDeveloperArtwork}
            >
            <LanguageProvider>
              <ClientLayoutShell>{children}</ClientLayoutShell>
            </LanguageProvider>
            </ThemeProvider>
          </AccountPreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
