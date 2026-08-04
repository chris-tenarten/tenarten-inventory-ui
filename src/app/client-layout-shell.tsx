'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  applyDisplaySize,
  DISPLAY_SIZE_STORAGE_KEY,
  isDisplaySize,
  readDisplaySize,
} from '@/lib/display-size';
import { type TranslationKey, useLanguage } from '@/lib/language';
import { EARLY_ACCESS_ENABLED } from '@/lib/early-access.mjs';
import EarlyAccessBadge from '@/components/EarlyAccessBadge';

const primaryNavItems = [
  { href: '/', labelKey: 'nav.dashboard' as TranslationKey, icon: HomeIcon },
];

const reportingNavItems = [
  {
    href: '/manpower-reporting',
    labelKey: 'nav.manpower' as TranslationKey,
    descriptionKey: 'nav.manpowerDescription' as TranslationKey,
  },
  {
    href: '/material-usage',
    labelKey: 'nav.materialUsage' as TranslationKey,
    descriptionKey: 'nav.materialUsageDescription' as TranslationKey,
  },
  {
    href: '',
    labelKey: 'nav.dailyProduction' as TranslationKey,
    descriptionKey: 'nav.dailyProductionDescription' as TranslationKey,
    disabled: true,
  },
];

const inventoryNavItems = [
  { href: '/inventory', labelKey: 'nav.currentInventory' as TranslationKey, descriptionKey: 'nav.currentInventoryDescription' as TranslationKey },
  { href: '/inventory?section=pending-receivals#pending-receivals', matchPath: '__pending-receivals__', labelKey: 'nav.pendingReceivals' as TranslationKey, descriptionKey: 'nav.pendingReceivalsDescription' as TranslationKey },
  { href: '/activity', labelKey: 'nav.activity' as TranslationKey, descriptionKey: 'nav.activityDescription' as TranslationKey },
];

const purchasingNavItems = [
  { href: '/purchasing', labelKey: 'nav.purchaseOrders' as TranslationKey, descriptionKey: 'nav.purchaseOrdersDescription' as TranslationKey },
  { href: '/catalog', labelKey: 'nav.catalog' as TranslationKey, descriptionKey: 'nav.catalogDescription' as TranslationKey },
];

const ACCESS_STORAGE_KEY = 'tenarten_internal_access';
const ACCESS_PASSWORD = 'tenarten123';

function LaborIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

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

function CartIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 4h2l2 11h10l2-7H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>; }

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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
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
    ? 'font-semibold text-slate-950 shadow-[inset_0_-3px_0_#172554]'
    : 'text-slate-600 hover:bg-slate-200/40 hover:text-slate-950';
}

function dropdownItemClass(isActive: boolean) {
  return isActive
    ? 'bg-slate-100 text-slate-950'
    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950';
}

type DomainNavItem = {
  href: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  matchPath?: string;
  disabled?: boolean;
};

function DomainNav({
  pathname,
  labelKey,
  href,
  icon: Icon,
  items,
}: {
  pathname: string;
  labelKey: TranslationKey;
  href: string;
  icon: ComponentType;
  items: DomainNavItem[];
}) {
  const { t } = useLanguage();
  const label = t(labelKey);
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedWhileHovered, setDismissedWhileHovered] = useState(false);
  const isActive = items.some((item) => {
    const path = item.matchPath || item.href;
    return path && (pathname === path || pathname.startsWith(`${path}/`));
  });
  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => {
        if (!dismissedWhileHovered) setIsOpen(true);
      }}
      onMouseLeave={() => {
        setIsOpen(false);
        setDismissedWhileHovered(false);
      }}
      onFocus={() => {
        if (!dismissedWhileHovered) setIsOpen(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <Link
        href={href}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(event) => {
          setDismissedWhileHovered(true);
          setIsOpen(false);
          event.currentTarget.blur();
        }}
        className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 px-3 text-[11px] font-bold uppercase leading-none tracking-[0.07em] outline-none transition-all duration-150 sm:h-10 sm:gap-2 sm:px-4 sm:text-[12px] ${navClass(isActive)}`}
      >
        <Icon />
        <span className="hidden sm:inline">{label}</span>
        <span className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDownIcon />
        </span>
      </Link>
      <div className={`absolute left-0 top-full z-50 min-w-[280px] pt-1 transition-all duration-150 ${isOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <div className="border border-slate-300 bg-white py-1 shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
          <div className="border-b border-slate-200 px-4 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
          </div>
          {items.map((item) => {
            const path = item.matchPath || item.href;
            const itemActive = Boolean(path) && (pathname === path || pathname.startsWith(`${path}/`));
            return item.disabled ? (
              <div key={item.labelKey} aria-disabled="true" className="px-4 py-3 text-slate-400">
                <div className="text-sm font-bold">{t(item.labelKey)}</div>
                <div className="mt-0.5 text-xs font-medium">{t(item.descriptionKey)}</div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => {
                  setDismissedWhileHovered(true);
                  setIsOpen(false);
                  event.currentTarget.blur();
                }}
                className={`block px-4 py-3 transition ${dropdownItemClass(itemActive)}`}
              >
                <div className="text-sm font-bold">{t(item.labelKey)}</div>
                <div className="mt-0.5 text-xs font-medium text-slate-500">{t(item.descriptionKey)}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ClientLayoutShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [accessError, setAccessError] = useState('');
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    applyDisplaySize(readDisplaySize());

    function syncDisplaySize(event: StorageEvent) {
      if (event.key !== DISPLAY_SIZE_STORAGE_KEY) return;
      applyDisplaySize(isDisplaySize(event.newValue) ? event.newValue : 'default');
    }

    window.addEventListener('storage', syncDisplaySize);
    return () => window.removeEventListener('storage', syncDisplaySize);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsUnlocked(
        window.localStorage.getItem(ACCESS_STORAGE_KEY) === 'granted',
      );
      setIsReady(true);
    }, 0);

    return () => window.clearTimeout(timeout);
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

    setAccessError(t('shell.incorrectPassword'));
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
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-[#f2f5f8]/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur transition-all duration-200">
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
              aria-label={t('shell.goToDashboard')}
            >
              <Image
                src="/logo.png"
                alt="Tenarten logo"
                width={256}
                height={256}
                className={`shrink-0 object-contain transition-all duration-200 ${
                  hasScrolled
                    ? 'h-9 w-auto'
                    : 'h-11 w-auto sm:h-12'
                }`}
              />

              <div className="flex min-w-0 items-center gap-2">
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
                    {t('shell.operationsControl')}
                  </div>
                </div>
                {EARLY_ACCESS_ENABLED && <EarlyAccessBadge title="TenOps Early Access environment" />}
              </div>
            </Link>

            {isUnlocked && (
              <button
                type="button"
                onClick={handleLogout}
                title={t('shell.logout')}
                aria-label={t('shell.logout')}
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
                className="flex min-w-0 flex-1 items-center gap-1 overflow-visible lg:flex-none"
                aria-label="Primary navigation"
              >
                {primaryNavItems.map((item) => {
                  const Icon = item.icon;

                  const isActive =
                    item.href === '/'
                      ? pathname === '/' ||
                        pathname === '/production'
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 px-3 text-[11px] font-bold uppercase leading-none tracking-[0.07em] transition-all duration-150 sm:h-10 sm:gap-2 sm:px-4 sm:text-[12px] ${navClass(
                        isActive,
                      )}`}
                    >
                      <Icon />
                      <span className={item.href === '/' ? 'hidden sm:inline' : ''}>{t(item.labelKey)}</span>
                    </Link>
                  );
                })}

                <DomainNav pathname={pathname} labelKey="nav.reporting" href="/manpower-reporting" icon={LaborIcon} items={reportingNavItems} />
                <DomainNav pathname={pathname} labelKey="nav.inventory" href="/inventory" icon={PackageIcon} items={inventoryNavItems} />
                <DomainNav pathname={pathname} labelKey="nav.purchasing" href="/purchasing" icon={CartIcon} items={purchasingNavItems} />
                <Link
                  href="/settings"
                  className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 px-3 text-[11px] font-bold uppercase leading-none tracking-[0.07em] transition-all duration-150 sm:h-10 sm:gap-2 sm:px-4 sm:text-[12px] ${navClass(pathname === '/settings' || pathname.startsWith('/settings/'))}`}
                >
                  <SettingsIcon />
                  <span className="hidden xl:inline">{t('nav.settings')}</span>
                </Link>
              </nav>
            )}

            {isUnlocked ? (
              <button
                type="button"
                onClick={handleLogout}
                title={t('shell.logout')}
                aria-label={t('shell.logout')}
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
                {t('shell.internalAccess')}
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
                <Image
                  src="/logo.png"
                  alt="Tenarten logo"
                  width={256}
                  height={256}
                  className="mx-auto h-28 w-auto object-contain sm:h-32"
                />

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                    TenOps
                  </h1>
                  {EARLY_ACCESS_ENABLED && <EarlyAccessBadge title="TenOps Early Access environment" />}
                </div>

                <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-600">
                  {t('shell.operationsControl')}
                </div>
              </div>

              <div className="px-6 py-6">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
                  {t('shell.internalAccess')}
                </div>

                <label
                  htmlFor="inline-access-password"
                  className="mt-4 block text-sm font-bold text-slate-800"
                >
                  {t('shell.password')}
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
                  {t('shell.unlockWorkspace')}
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
              {t('shell.internalAccess')}
            </div>

            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              {t('shell.enterPassword')}
            </h2>

            <div className="mt-5">
              <label
                htmlFor="access-password"
                className="mb-2 block text-sm font-bold text-slate-800"
              >
                {t('shell.password')}
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
                {t('shell.unlock')}
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
                {t('shell.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
