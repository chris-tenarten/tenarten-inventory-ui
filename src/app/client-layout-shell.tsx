'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/inventory', label: 'Inventory', icon: BoxIcon },
  { href: '/transactions', label: 'Add Inventory', icon: PlusIcon },
  { href: '/activity', label: 'Activity Log', icon: ClockIcon },
  { href: '/catalog', label: 'Catalog', icon: BookIcon },
];

const ACCESS_STORAGE_KEY = 'tenarten_internal_access';
const ACCESS_PASSWORD = 'tenarten123';

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" />
      <path d="M3.3 7.8 12 13l8.7-5.2" />
      <path d="M12 22V13" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 17 15 12l-5-5" />
      <path d="M15 12H3" />
      <path d="M21 3v18" />
    </svg>
  );
}

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
    window.localStorage.removeItem('tenarten_admin_access');
    setIsUnlocked(false);
    setShowAccessModal(false);
    setPasswordInput('');
    setAccessError('');
  }

  return (
    <>
      <header className="border-b border-[#c8a43a]/40 bg-black px-6 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6">
          <Link href="/inventory" className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="Tenarten logo"
              className="h-14 object-contain"
            />

            <div>
              <div className="text-xl font-semibold tracking-tight text-white">
                Tenarten Inventory
              </div>
              <div className="text-sm text-neutral-400">
                Stock control and activity tracking
              </div>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-4">
            {isUnlocked && (
              <nav className="flex flex-wrap items-center gap-3 text-sm">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  const isPrimary = item.href === '/transactions';

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold transition ${
                        isActive
                          ? 'border-[#c8a43a] bg-[#c8a43a]/15 text-[#f7f0d0] shadow-[0_0_18px_rgba(200,164,58,0.18)]'
                          : isPrimary
                            ? 'border-[#c8a43a]/70 bg-[#c8a43a]/10 text-[#f0d98a] hover:bg-[#c8a43a]/20 hover:text-[#f7f0d0]'
                            : 'border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-900 hover:text-white'
                      }`}
                    >
                      <Icon />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}

            {isUnlocked ? (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-900 hover:text-white"
              >
                <LogoutIcon />
                Logout
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAccessModal(true)}
                className="rounded-xl border border-[#c8a43a]/70 bg-[#c8a43a]/10 px-4 py-3 text-sm font-semibold text-[#f0d98a] transition hover:bg-[#c8a43a]/20"
              >
                Internal Access
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {isReady && isUnlocked ? (
          children
        ) : (
          <div className="min-h-[calc(100vh-89px)] bg-black px-6 py-12">
            <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-950 p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#c8a43a]">
                Internal Access
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#f7f0d0]">
                Protected internal tool
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
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