'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

const primaryNavItems = [
  { href: '/', label: 'Dashboard', icon: HomeIcon },
  { href: '/manpower-reporting', label: 'Production Reporting', icon: LaborIcon },
  { href: '/inventory', label: 'Inventory', icon: PackageIcon },
];

const utilityNavItems = [
  { href: '/catalog', label: 'Catalog', icon: BookIcon },
  { href: '/activity', label: 'Inventory Activity', icon: ClockIcon },
];

function LaborIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  );
}

const ACCESS_STORAGE_KEY = 'tenarten_internal_access';
const ACCESS_PASSWORD = 'tenarten123';

function PackageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m3 7 9-4 9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10 17 15 12l-5-5" />
      <path d="M15 12H3" />
      <path d="M21 3v18" />
    </svg>
  );
}

function navClass(isActive: boolean) {
  return isActive
    ? 'bg-slate-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
    : 'text-slate-700 hover:bg-white/70 hover:text-slate-950';
}

export default function ClientLayoutShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [accessError, setAccessError] = useState('');
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    setIsUnlocked(
      window.localStorage.getItem(ACCESS_STORAGE_KEY) === 'granted',
    );

    setIsReady(true);
  }, []);

  useEffect(() => {
    function handleScroll() {
      const scrollY = window.scrollY;

      setHasScrolled((current) => {
        if (current) {
          return scrollY > 4;
        }

        return scrollY > 36;
      });
    }

    handleScroll();

    window.addEventListener('scroll', handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  function handleUnlock() {
    if (passwordInput === ACCESS_PASSWORD) {
      window.localStorage.setItem(
        ACCESS_STORAGE_KEY,
        'granted',
      );

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
      <header className="sticky top-0 z-40 border-b border-slate-400/80 bg-[#e7ecf2]/95 shadow-[0_1px_0_rgba(255,255,255,0.9)] backdrop-blur transition-all duration-200">
        <div
          className={`mx-auto flex max-w-[1800px] flex-col px-3 transition-all duration-200 sm:px-5 lg:flex-row lg:items-center lg:justify-between ${
            hasScrolled
              ? 'gap-1.5 py-1.5 sm:gap-2 sm:py-2'
              : 'gap-2 py-2.5 sm:gap-3 sm:py-3'
          }`}
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <Link
              href="/"
              className="group flex min-w-0 items-center gap-2.5"
              aria-label="Go to dashboard"
            >
              <img
                src="/logo.png"
                alt="Tenarten logo"
                className={`shrink-0 object-contain transition-all duration-200 ${
                  hasScrolled
                    ? 'h-9 w-auto'
                    : 'h-11 w-auto sm:h-12'
                }`}
              />

              <div className="min-w-0 leading-none">
                <div
                  className={`truncate font-bold tracking-tight text-slate-950 transition-all duration-200 group-hover:text-slate-700 ${
                    hasScrolled
                      ? 'text-[14px] sm:text-[15px]'
                      : 'text-[16px] sm:text-[17px]'
                  }`}
                >
                  TenOps
                </div>

                <div
                  className={`mt-1 overflow-hidden font-bold uppercase tracking-[0.16em] text-slate-600 transition-all duration-200 sm:tracking-[0.18em] ${
                    hasScrolled
                      ? 'max-h-0 opacity-0 lg:max-h-5 lg:text-[9px] lg:opacity-100'
                      : 'max-h-5 text-[9px] opacity-100 sm:text-[10px]'
                  }`}
                >
                  Operations Control
                </div>
              </div>
            </Link>

            {isUnlocked && (
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                aria-label="Logout"
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center text-red-700 transition hover:bg-red-50 hover:text-red-800 sm:hidden ${
                  hasScrolled ? 'hidden' : ''
                }`}
              >
                <LogoutIcon />
              </button>
            )}
          </div>

          <div className="flex w-full items-center gap-2 lg:w-auto lg:justify-end">
            {isUnlocked && (
              <nav
                className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex-none"
                aria-label="Primary navigation"
              >
                {primaryNavItems.map((item) => {
                  const Icon = item.icon;

                  const isActive =
                    item.href === '/'
                      ? pathname === '/' || pathname === '/production'
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.07em] transition-all duration-150 sm:h-10 sm:gap-2 sm:px-4 sm:text-[12px] ${navClass(
                        isActive,
                      )}`}
                    >
                      <Icon />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}

            {isUnlocked && (
              <nav className="flex shrink-0 items-center border-l border-slate-400 pl-2" aria-label="Supporting tools">
                {utilityNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} className={`inline-flex h-9 items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.06em] transition sm:h-10 sm:px-3 ${navClass(isActive)}`}><Icon /><span className="hidden 2xl:inline">{item.label}</span></Link>;
                })}
              </nav>
            )}

            {isUnlocked ? (
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                aria-label="Logout"
                className={`hidden h-10 w-10 shrink-0 items-center justify-center text-red-700 transition hover:bg-red-50 hover:text-red-800 sm:inline-flex ${
                  hasScrolled ? 'sm:h-9 sm:w-9' : ''
                }`}
              >
                <LogoutIcon />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAccessModal(true)}
                className={`ml-auto border border-slate-950 bg-slate-900 px-4 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-all duration-200 hover:bg-slate-950 ${
                  hasScrolled ? 'h-8 sm:h-9' : 'h-10'
                }`}
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
          <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-5 py-10">
            <div className="w-full max-w-lg border border-slate-400 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
              <div className="border-b border-slate-300 bg-gradient-to-b from-white to-slate-100 px-6 py-8 text-center">
                <img
                  src="/logo.png"
                  alt="Tenarten logo"
                  className="mx-auto h-28 w-auto object-contain sm:h-32"
                />

                <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">
                  TenOps
                </h1>

                <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-600">
                  Operations Control
                </div>
              </div>

              <div className="px-6 py-6">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
                  Internal Access
                </div>

                <label
                  htmlFor="inline-access-password"
                  className="mt-4 block text-sm font-bold text-slate-800"
                >
                  Password
                </label>

                <input
                  id="inline-access-password"
                  type="password"
                  value={passwordInput}
                  onChange={(event) => {
                    setPasswordInput(event.target.value);
                    setAccessError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleUnlock();
                    }
                  }}
                  className="mt-2 h-12 w-full border border-slate-500 bg-white px-3 text-slate-950 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  autoFocus
                />

                {accessError && (
                  <div className="mt-3 text-sm font-semibold text-red-700">
                    {accessError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleUnlock}
                  className="mt-5 h-12 w-full border border-slate-950 bg-slate-900 px-4 text-sm font-bold uppercase tracking-[0.1em] text-white transition hover:bg-slate-950"
                >
                  Unlock Workspace
                </button>
              </div>
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

            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Enter password
            </h2>

            <div className="mt-5">
              <label
                htmlFor="access-password"
                className="mb-2 block text-sm font-bold text-slate-800"
              >
                Password
              </label>

              <input
                id="access-password"
                type="password"
                value={passwordInput}
                onChange={(event) => {
                  setPasswordInput(event.target.value);
                  setAccessError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleUnlock();
                  }
                }}
                className="h-11 w-full border border-slate-500 bg-white px-3 text-slate-950 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                autoFocus
              />
            </div>

            {accessError && (
              <div className="mt-3 text-sm font-semibold text-red-700">
                {accessError}
              </div>
            )}

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
