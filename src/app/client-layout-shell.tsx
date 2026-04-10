'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/catalog', label: 'Catalog' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/transactions', label: 'Transactions' },
];

const ACCESS_STORAGE_KEY = 'tenarten_internal_access';
const ACCESS_PASSWORD = 'tenarten123';

export default function ClientLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [accessError, setAccessError] = useState('');

  useEffect(() => {
    const stored = window.localStorage.getItem(ACCESS_STORAGE_KEY);
    setIsUnlocked(stored === 'granted');
    setIsReady(true);
  }, []);

  const accessLabel = useMemo(() => {
    return isUnlocked ? 'Internal Access Enabled' : 'Internal Access';
  }, [isUnlocked]);

  function handleUnlock() {
    if (passwordInput === ACCESS_PASSWORD) {
      window.localStorage.setItem(ACCESS_STORAGE_KEY, 'granted');
      setIsUnlocked(true);
      setShowAccessModal(false);
      setPasswordInput('');
      setAccessError('');
      return;
    }

    setAccessError('Incorrect password.');
  }

  function handleLogout() {
    window.localStorage.removeItem(ACCESS_STORAGE_KEY);
    setIsUnlocked(false);
    setShowAccessModal(false);
    setPasswordInput('');
    setAccessError('');
  }

  return (
    <>
      <header className="border-b border-neutral-800 bg-black/95 px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Tenarten logo"
              className="h-10 object-contain"
            />
            <div>
              <div className="text-lg font-semibold tracking-tight text-white">
                Tenarten Inventory UI
              </div>
              <div className="text-xs text-neutral-400">
                Material control and catalog workflow
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAccessModal(true)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                isUnlocked
                  ? 'border-[#c8a43a] bg-[#c8a43a] text-black hover:bg-[#d6b24a]'
                  : 'border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900'
              }`}
            >
              {accessLabel}
            </button>

            {isUnlocked && (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-900"
              >
                Logout
              </button>
            )}

            <nav className="flex items-center gap-2 text-sm">
              {navItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl border px-3 py-2 font-medium transition ${
                      isActive
                        ? 'border-[#c8a43a] bg-neutral-950 text-white'
                        : 'border-transparent text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main>
        {isReady && isUnlocked ? (
          children
        ) : (
          <div className="min-h-[calc(100vh-73px)] bg-black px-6 py-12">
            <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-950 p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#c8a43a]">
                Internal Access
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#f7f0d0]">
                Protected internal tool
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                This UI is currently behind a lightweight internal-access gate.
                Use the Internal Access button in the header to enter the shared
                password and continue.
              </p>
            </div>
          </div>
        )}
      </main>

      {showAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#c8a43a]">
              Internal Access
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Enter password
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              This is a lightweight access gate for internal review. It is not a
              production auth system.
            </p>

            <div className="mt-5">
              <label
                htmlFor="access-password"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                Password
              </label>
              <input
                id="access-password"
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setAccessError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUnlock();
                  }
                }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                autoFocus
              />
            </div>

            {accessError && (
              <div className="mt-3 text-sm text-red-400">{accessError}</div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleUnlock}
                className="rounded-xl bg-[#c8a43a] px-4 py-2.5 font-medium text-black transition hover:bg-[#d6b24a]"
              >
                Unlock
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAccessModal(false);
                  setPasswordInput('');
                  setAccessError('');
                }}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}