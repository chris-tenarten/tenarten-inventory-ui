import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

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
      <body className="min-h-screen bg-black text-white">
        <div className="border-b border-neutral-800 bg-black/95 px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Tenarten logo" className="h-10 object-contain" />
              <div>
                <div className="text-lg font-semibold">Tenarten Inventory UI</div>
                <div className="text-xs text-neutral-400">Material control and catalog workflow</div>
              </div>
            </div>

            <nav className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Link href="/" className="rounded px-3 py-2 text-neutral-300 hover:bg-neutral-900 hover:text-white">
                  Dashboard
                </Link>

                <Link href="/catalog" className="rounded px-3 py-2 text-neutral-300 hover:bg-neutral-900 hover:text-white">
                  Catalog
                </Link>

                <Link href="/inventory" className="rounded px-3 py-2 text-neutral-300 hover:bg-neutral-900 hover:text-white">
                  Inventory
                </Link>

                <Link href="/transactions" className="rounded px-3 py-2 text-neutral-300 hover:bg-neutral-900 hover:text-white">
                  Transactions
                </Link>
              </div>
            </nav>
          </div>
        </div>

        <main>{children}</main>
      </body>
    </html>
  );
}