import type { Metadata } from 'next';
import './globals.css';
import ClientLayoutShell from './client-layout-shell';
import { LanguageProvider } from '@/lib/language';

export const metadata: Metadata = {
  title: {
    default: 'TenOps Cloud — Dashboard',
    template: 'TenOps Cloud — %s',
  },
  description: 'Tenarten inventory and material management',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-display-size="default" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=localStorage.getItem('tenops_display_size');if(s==='compact'||s==='large'||s==='default'){document.documentElement.dataset.displaySize=s}var l=localStorage.getItem('tenops_language');if(l==='en'||l==='es'){document.documentElement.lang=l}}catch(e){}",
          }}
        />
      </head>
      <body>
        <LanguageProvider>
          <ClientLayoutShell>{children}</ClientLayoutShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
