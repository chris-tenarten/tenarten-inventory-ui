'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LoginGate from '@/components/LoginGate';

function SectionPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        active
          ? 'border-[#c8a43a] bg-[#1a1610] text-[#f7f0d0]'
          : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isDashboard = pathname === '/';
  const isCatalog = pathname.startsWith('/catalog');
  const isInventory = pathname.startsWith('/inventory');
  const isTransactions = pathname.startsWith('/transactions');

  const handleLogout = () => {
    localStorage.removeItem('tenarten-auth');
    window.location.reload();
  };

  return (
    <html lang="en">
      <body className="bg-black text-white">
        <LoginGate>
          <div className="border-b border-neutral-900 bg-black/95">
            <div className="mx-auto max-w-7xl px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src="/logo.png"
                    alt="Tenarten logo"
                    className="h-12 w-auto object-contain"
                  />
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-[#bda86a]">
                      Tenarten Terrazzo
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-[#f7f0d0]">
                      Inventory & Material Management
                    </div>
                    <div className="mt-1 text-sm text-neutral-400">
                      Internal operations interface for material search, stock movement, and inventory visibility.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 lg:pt-1">
                  <div className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-400">
                    Internal Access
                  </div>
                  <button
                    onClick={handleLogout}
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm text-white transition hover:bg-neutral-900"
                  >
                    Logout
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <SectionPill href="/" label="Dashboard" active={isDashboard} />
                <SectionPill href="/catalog" label="Catalog" active={isCatalog} />
                <SectionPill href="/inventory" label="Inventory" active={isInventory} />
                <SectionPill href="/transactions" label="Transactions" active={isTransactions} />
              </div>
            </div>
          </div>

          <main>{children}</main>
        </LoginGate>
      </body>
    </html>
  );
}