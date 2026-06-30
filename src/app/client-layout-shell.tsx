'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/inventory', label: 'Inventory', icon: BoxIcon },
  { href: '/activity', label: 'Activity', icon: ClockIcon },
  { href: '/catalog', label: 'Catalog', icon: BookIcon },
];

const ACCESS_STORAGE_KEY = 'tenarten_internal_access';
const ACCESS_PASSWORD = 'tenarten123';

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" />
      <path d="M3.3 7.8 12 13l8.7-5.2" />
      <path d="M12 22V13" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 17 15 12l-5-5" />
      <path d="M15 12H3" />
      <path d="M21 3v18" />
    </svg>
  );
}

function navClass(isActive: boolean) {
  return isActive
    ? 'border-slate-900 bg-slate-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
    : 'border-slate-400 bg-gradient-to-b from-white to-slate-100 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] hover:border-slate-700 hover:bg-slate-200';
}

export default function ClientLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [accessError, setAccessError] = useState('');

  useEffect(() => {
    setIsUnlocked(window.localStorage.getItem(ACCESS_STORAGE_KEY) === 'granted');
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
      <header className="sticky top-0 z-40 border-b border-slate-500 bg-[#e7ecf2] shadow-[0_1px_0_rgba(255,255,255,0.85)]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-3">
          <Link href="/inventory" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-slate-400 bg-gradient-to-b from-white to-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] transition group-hover:border-slate-700">
              <img src="/logo.png" alt="Tenarten logo" className="h-6 object-contain" />
            </div>

            <div className="leading-none">
              <div className="text-[15px] font-bold tracking-tight text-slate-950">
                Tenarten Inventory
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                Operations Control
              </div>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            {isUnlocked && (
              <nav className="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Primary navigation">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex h-10 items-center gap-2 border px-4 text-[13px] font-bold uppercase tracking-[0.08em] transition ${navClass(isActive)}`}
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
                className="inline-flex h-10 items-center gap-2 border border-slate-400 bg-gradient-to-b from-white to-slate-100 px-4 text-[13px] font-bold uppercase tracking-[0.08em] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition hover:border-red-700 hover:bg-red-50 hover:text-red-700"
              >
                <LogoutIcon />
                Logout
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAccessModal(true)}
                className="h-10 border border-slate-950 bg-slate-900 px-4 text-[13px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-slate-950"
              >
                Internal Access
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-65px)] bg-[#eef1f4] text-slate-950">
        {isReady && isUnlocked ? (
          children
        ) : (
          <div className="px-5 py-10">
            <div className="mx-auto max-w-3xl border border-slate-400 bg-white p-8 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
                Internal Access
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                Protected operations tool
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
                Use the Internal Access button in the header to enter the shared password and continue.
              </p>
            </div>
          </div>
        )}
      </main>

      {showAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-6 backdrop-blur-sm">
          <div className="w-full max-w-md border border-slate-500 bg-white p-6 shadow-xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Internal Access
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Enter password</h2>

            <div className="mt-5">
              <label htmlFor="access-password" className="mb-2 block text-sm font-bold text-slate-800">
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
                  if (e.key === 'Enter') handleUnlock();
                }}
                className="h-11 w-full border border-slate-500 bg-white px-3 text-slate-950 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                autoFocus
              />
            </div>

            {accessError && <div className="mt-3 text-sm font-semibold text-red-700">{accessError}</div>}

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleUnlock}
                className="h-10 border border-slate-950 bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-950"
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
                className="h-10 border border-slate-400 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-100"
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
