import type { Metadata } from 'next';
import './globals.css';
import ClientLayoutShell from './client-layout-shell';

export const metadata: Metadata = {
  title: 'Tenarten Operations',
  description: 'Tenarten inventory and material management',
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
