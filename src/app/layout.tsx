import type { Metadata } from 'next';
import './globals.css';
import ClientLayoutShell from './client-layout-shell';

export const metadata: Metadata = {
  title: 'Tenarten Inventory UI',
  description: 'Tenarten inventory and material management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        <ClientLayoutShell>{children}</ClientLayoutShell>
      </body>
    </html>
  );
}