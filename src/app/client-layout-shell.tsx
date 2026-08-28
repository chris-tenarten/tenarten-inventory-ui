'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  applyDisplaySize,
  DISPLAY_SIZE_STORAGE_KEY,
  isDisplaySize,
  readDisplaySize,
} from '@/lib/display-size';
import { type TranslationKey, useLanguage } from '@/lib/language';
import {
  BrandSubtitle,
  HeaderBrandArtwork,
  HeaderEnvironmentIdentity,
  HeaderProductName,
  LoginBrandIdentity,
} from '@/components/AppBranding';
import { BRANDING } from '@/lib/dev-branding.mjs';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/rbac';
import { accountInitials } from '@/lib/identity-presentation';
import { useAccountPreferences } from '@/lib/account-preferences';
import AccountAccessPanel from '@/components/AccountAccessPanel';
import AccountNotifications from '@/components/AccountNotifications';
import WelcomeHero from '@/components/WelcomeHero';
import { openProductionJob } from '@/modules/production/job-options';

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

function MyWorkIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 2 2 4-4M8 16h8"/></svg>; }

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
        className={`inline-flex h-9 shrink-0 items-center justify-center gap-1 px-2 text-[11px] font-bold uppercase leading-none tracking-[0.07em] outline-none transition-all duration-150 sm:h-10 sm:gap-2 sm:px-4 sm:text-[12px] ${navClass(isActive)}`}
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
  const auth = useAuth();
  const accountPreferences = useAccountPreferences();

  const [hasScrolled, setHasScrolled] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const accountDisplaySize = accountPreferences.preferences.display_size;
    applyDisplaySize(accountPreferences.accountScoped
      ? isDisplaySize(accountDisplaySize) ? accountDisplaySize : 'default'
      : readDisplaySize());

    function syncDisplaySize(event: StorageEvent) {
      if (accountPreferences.accountScoped || event.key !== DISPLAY_SIZE_STORAGE_KEY) return;
      applyDisplaySize(isDisplaySize(event.newValue) ? event.newValue : 'default');
    }

    window.addEventListener('storage', syncDisplaySize);
    return () => window.removeEventListener('storage', syncDisplaySize);
  }, [accountPreferences.accountScoped, accountPreferences.preferences.display_size]);

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

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeAccountMenu = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && accountMenuRef.current?.contains(event.target as Node)) return;
      setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', closeAccountMenu);
    window.addEventListener('keydown', closeAccountMenu);
    return () => {
      document.removeEventListener('mousedown', closeAccountMenu);
      window.removeEventListener('keydown', closeAccountMenu);
    };
  }, [accountMenuOpen]);

  async function handleLogout() {
    await auth.signOut();
  }

  const shellUnlocked = !auth.requiresPasswordSetup && auth.isAuthenticated && auth.accessAllowed;

  return (
    <div data-app-shell>
      <WelcomeHero />
      <header data-shell-header data-login-gate={!shellUnlocked ? 'true' : undefined} data-dev-branding={BRANDING.showDeveloperArtwork ? 'true' : undefined} className="sticky top-0 z-40 border-b border-slate-200 bg-[#f2f5f8]/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur transition-all duration-200">
        <div
          data-shell-header-inner
          className={`relative mx-auto flex max-w-[1800px] flex-col px-3 transition-all duration-200 sm:px-5 lg:flex-row lg:items-center lg:justify-between ${
            hasScrolled
              ? 'gap-1.5 py-1.5 sm:gap-2 sm:py-2'
              : 'gap-2 py-2.5 sm:gap-3 sm:py-3'
          }`}
        >
          <div data-shell-branding className="flex min-h-11 min-w-0 items-center gap-3 pr-12 sm:min-h-0 sm:pr-0">
            <Link
              data-shell-brand-link
              href="/"
              className="group flex min-w-0 items-center gap-2.5"
              aria-label={t('shell.goToDashboard')}
            >
              {shellUnlocked ? <span
                data-authenticated-header-logo
                className={`relative shrink-0 transition-all duration-200 ${
                  hasScrolled
                    ? 'h-9 w-9'
                    : 'h-11 w-11 sm:h-12 sm:w-12'
                }`}
              >
                <Image
                  data-authenticated-steel-logo="true"
                  src="/tenarten-logo-steel-welcome.webp"
                  alt="Tenarten logo"
                  fill
                  sizes="48px"
                  className="object-contain"
                />
              </span> : <Image
                src="/logo.png"
                alt="Tenarten logo"
                width={256}
                height={256}
                className={`shrink-0 object-contain transition-all duration-200 ${hasScrolled ? 'h-9 w-auto' : 'h-11 w-auto sm:h-12'}`}
              />}

              <div className="flex min-w-0 items-center gap-2">
                <div className="relative min-w-0 leading-none">
                  <div
                    data-shell-product-name
                    className={`truncate font-bold tracking-tight text-slate-950 transition-all duration-200 group-hover:text-slate-700 ${
                      hasScrolled
                        ? 'text-[14px] sm:text-[15px]'
                        : 'text-[16px] sm:text-[17px]'
                    }`}
                  >
                    <HeaderProductName loginGate={!shellUnlocked} />
                  </div>

                  <div
                    data-shell-brand-subtitle
                    className={`mt-1 overflow-hidden font-bold uppercase tracking-[0.16em] text-slate-600 transition-all duration-200 sm:tracking-[0.18em] ${
                      hasScrolled
                        ? 'max-h-0 opacity-0 lg:max-h-5 lg:text-[9px] lg:opacity-100'
                        : 'max-h-5 text-[9px] opacity-100 sm:text-[10px]'
                    }`}
                  >
                    <BrandSubtitle productionSubtitle={t('shell.operationsControl')} />
                  </div>
                  <HeaderBrandArtwork loginGate={!shellUnlocked} />
                </div>
                <span data-shell-environment><HeaderEnvironmentIdentity loginGate={!shellUnlocked} /></span>
              </div>
            </Link>

          </div>

          <div data-shell-nav-row className="flex w-full items-center lg:w-auto lg:justify-end">
            {shellUnlocked && (
              <nav
                data-shell-primary-nav
                className="flex min-w-0 flex-1 items-center justify-between overflow-visible sm:justify-start sm:gap-1 lg:flex-none"
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
                      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1 px-2 text-[11px] font-bold uppercase leading-none tracking-[0.07em] transition-all duration-150 sm:h-10 sm:gap-2 sm:px-4 sm:text-[12px] ${navClass(
                        isActive,
                      )}`}
                    >
                      <Icon />
                      <span className={item.href === '/' || item.href === '/my-work' ? 'hidden sm:inline' : ''}>{t(item.labelKey)}</span>
                    </Link>
                  );
                })}

                <DomainNav pathname={pathname} labelKey="nav.reporting" href="/manpower-reporting" icon={LaborIcon} items={reportingNavItems} />
                <DomainNav pathname={pathname} labelKey="nav.inventory" href="/inventory" icon={PackageIcon} items={inventoryNavItems} />
                <DomainNav pathname={pathname} labelKey="nav.purchasing" href="/purchasing" icon={CartIcon} items={purchasingNavItems} />
                <div className="flex shrink-0 items-center">
                  <span aria-hidden="true" className="mx-1 h-5 border-l border-slate-300 sm:mx-2" />
                  <Link
                    href="/my-work"
                    className={`inline-flex h-9 shrink-0 items-center justify-center gap-1 px-2 text-[11px] font-bold uppercase leading-none tracking-[0.07em] transition-all duration-150 sm:h-10 sm:gap-2 sm:px-3 sm:text-[12px] ${navClass(pathname === '/my-work' || pathname.startsWith('/my-work/'))}`}
                  >
                    <MyWorkIcon />
                    <span className="hidden sm:inline">{t('nav.myWork')}</span>
                  </Link>
                  <AccountNotifications onOpen={(notification) => openProductionJob(notification.job_id, `job-updates:${notification.update_id}`)} />
                  {auth.isAuthenticated && auth.profile?.isActive ? <div ref={accountMenuRef} data-account-identity className="relative">
                    <button
                      type="button"
                      onClick={() => setAccountMenuOpen((current) => !current)}
                      aria-haspopup="menu"
                      aria-expanded={accountMenuOpen}
                      aria-label={`Account menu for ${auth.profile.displayName}, ${ROLE_LABELS[auth.profile.role]}`}
                      title={auth.profile.displayName}
                      className="group relative inline-flex h-9 w-14 shrink-0 items-center justify-center overflow-visible text-xs font-bold uppercase tracking-wide text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:h-10"
                    >
                      <span aria-hidden="true" className="absolute left-1/2 top-0 h-9 w-9 -translate-x-1/2 rounded-full border-2 border-slate-400 bg-slate-100 transition group-hover:border-slate-500 group-hover:bg-slate-200 sm:h-10 sm:w-10" />
                      <span className="relative z-10 leading-none">{accountInitials(auth.profile.displayName)}</span>
                      <span className="absolute bottom-[-5px] left-1/2 z-20 inline-flex h-3 -translate-x-1/2 items-center justify-center whitespace-nowrap border border-slate-400 bg-white px-1.5 text-[6px] font-bold leading-none tracking-[0.08em] text-slate-600 shadow-sm sm:text-[7px]">
                        {ROLE_LABELS[auth.profile.role]}
                      </span>
                    </button>
                    {accountMenuOpen ? <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-56 border border-slate-300 bg-white py-1 text-left shadow-xl">
                      <div className="border-b border-slate-200 px-3 py-2">
                        <div className="truncate text-sm font-bold text-slate-950" title={auth.profile.displayName}>{auth.profile.displayName}</div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{ROLE_LABELS[auth.profile.role]}</div>
                      </div>
                      <Link role="menuitem" href="/settings" onClick={() => setAccountMenuOpen(false)} className="block px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950">Settings</Link>
                      <button role="menuitem" type="button" onClick={() => { setAccountMenuOpen(false); void handleLogout(); }} className="block w-full px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 hover:text-red-800">Sign out</button>
                    </div> : null}
                  </div> : null}
                </div>
              </nav>
            )}
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-65px)] bg-[#eef1f4] text-slate-950">
        {auth.ready && shellUnlocked ? (
          children
        ) : (
          <div data-login-gate-body className="flex min-h-[calc(100vh-65px)] items-center justify-center px-3 py-4 sm:px-5 sm:py-10">
            <div data-theme-access-card className="w-full max-w-lg border border-slate-400 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)] sm:max-w-2xl lg:max-w-3xl">
              <div data-theme-access-brand className="border-b border-slate-300 bg-gradient-to-b from-white to-slate-100 px-4 py-5 text-center sm:px-8 sm:py-10 lg:px-10 lg:py-12">
                <Image
                  src="/logo.png"
                  alt="Tenarten logo"
                  width={256}
                  height={256}
                  className="mx-auto h-20 w-auto object-contain sm:h-40 lg:h-44"
                />

                <LoginBrandIdentity productionSubtitle={t('shell.operationsControl')} />
              </div>

              <div className="px-4 py-5 sm:px-10 sm:py-8 lg:px-12">
                {auth.ready
                  ? <AccountAccessPanel onAuthenticated={() => {}} separated={false} />
                  : <div role="status" aria-live="polite" className="py-6 text-center text-sm font-semibold text-slate-600">Restoring your TenOps session…</div>}
                {auth.isAuthenticated && !auth.accessAllowed ? <div role="alert" className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">This account is disabled or does not have access to this TenOps environment.</div> : null}
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
