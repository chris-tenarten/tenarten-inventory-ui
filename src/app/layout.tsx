import type { Metadata, Viewport } from 'next';
import './globals.css';
import ClientLayoutShell from './client-layout-shell';
import { LanguageProvider } from '@/lib/language';
import { APPEARANCE_STORAGE_KEY, TENDEV_APPEARANCE_STORAGE_KEY, ThemeProvider } from '@/lib/appearance';
import { AuthProvider } from '@/lib/auth';
import { AccountPreferencesProvider } from '@/lib/account-preferences';
import { BRANDING } from '@/lib/dev-branding.mjs';

export const metadata: Metadata = {
  applicationName: BRANDING.productName,
  title: {
    default: `${BRANDING.productName} Cloud — Dashboard`,
    template: `${BRANDING.productName} Cloud — %s`,
  },
  description: 'Tenarten inventory and material management',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: BRANDING.productName,
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
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
  themeColor: BRANDING.defaultAppearance === 'dark' ? '#11151b' : '#eef1f4',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const defaultAppearance = BRANDING.defaultAppearance;
  const appearanceStorageKey = BRANDING.showDeveloperArtwork ? TENDEV_APPEARANCE_STORAGE_KEY : APPEARANCE_STORAGE_KEY;
  const appearanceSelection = `const stored=localStorage.getItem('${appearanceStorageKey}');document.documentElement.dataset.appearance=stored==='light'||stored==='dark'?stored:'${defaultAppearance}'`;
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
