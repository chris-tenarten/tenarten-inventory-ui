import type { Metadata } from 'next';
import './globals.css';
import ClientLayoutShell from './client-layout-shell';

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
    <html lang="en">
      <body>
        <ClientLayoutShell>{children}</ClientLayoutShell>
      </body>
    </html>
  );
}
