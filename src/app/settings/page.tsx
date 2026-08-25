"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  applyDisplaySize,
  DISPLAY_SIZE_OPTIONS,
  type DisplaySize,
  readDisplaySize,
  saveDisplaySize,
} from "@/lib/display-size";
import { type TranslationKey, useLanguage } from "@/lib/language";
import { APPEARANCES, useAppearance } from "@/lib/appearance";
import PhaseLibraryManager from "@/modules/planning/PhaseLibraryManager";
import { isPlanningEnabled } from "@/modules/planning/timeline-model.mjs";
import AdminSettingsPanel from "@/components/AdminSettingsPanel";
import AccountAccessPanel from "@/components/AccountAccessPanel";
import { useAccountPreferences } from "@/lib/account-preferences";
import { BRANDING } from "@/lib/dev-branding.mjs";

const planningEnabled = isPlanningEnabled(process.env.NEXT_PUBLIC_ENABLE_PLANNING);

const settings = [
  {
    href: "/purchasing",
    titleKey: "settings.vendors" as TranslationKey,
    descriptionKey: "settings.vendorsDescription" as TranslationKey,
  },
  {
    href: "/manpower-reporting",
    titleKey: "settings.workers" as TranslationKey,
    descriptionKey: "settings.workersDescription" as TranslationKey,
  },
];

export default function SettingsPage() {
  const [displaySize, setDisplaySize] = useState<DisplaySize>("default");
  const { language, setLanguage, t } = useLanguage();
  const { appearance, setAppearance } = useAppearance();
  const accountPreferences = useAccountPreferences();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const accountValue = accountPreferences.preferences.display_size;
      const stored = accountPreferences.accountScoped ? accountValue ?? "default" : readDisplaySize();
      setDisplaySize(stored);
      applyDisplaySize(stored);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [accountPreferences.accountScoped, accountPreferences.preferences.display_size]);

  function changeDisplaySize(value: DisplaySize) {
    setDisplaySize(value);
    applyDisplaySize(value);
    if (accountPreferences.accountScoped) void accountPreferences.setPreference("display_size", value);
    else saveDisplaySize(value);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {t("settings.eyebrow")}
      </div>
      <h1 className="mt-1 text-3xl font-bold text-slate-950">
        {t("settings.title")}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {t("settings.description")}
      </p>
      {accountPreferences.error ? <p role="status" className="mt-3 border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{accountPreferences.error}</p> : null}
      <section className="mt-6 border border-slate-300 bg-white p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Account</div>
        <h2 className="mt-1 text-lg font-bold text-slate-950">Account Access</h2>
        <p className="mt-1 text-sm text-slate-600">Sign in with your individual TenOps account for personalized access, notifications, and role-based permissions.</p>
        <AccountAccessPanel onAuthenticated={() => {}} showEyebrow={false} />
      </section>
      <section id="appearance" className="mt-6 scroll-mt-20 border border-slate-300 bg-white p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {t("settings.appearance")}
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-950">
          {t("settings.theme")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("settings.themeDescription")}
        </p>
        <div
          className="mt-4 grid max-w-lg gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label={t("settings.theme")}
        >
          {APPEARANCES.map((value) => {
            const selected = appearance === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setAppearance(value)}
                className={`min-h-14 border p-3 text-left transition ${
                  selected
                    ? "border-blue-700 bg-blue-50 shadow-[inset_0_0_0_1px_#1d4ed8]"
                    : "border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2 font-bold text-slate-950">
                  <span
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 rounded-full border ${
                      selected
                        ? "border-blue-700 bg-blue-700 shadow-[inset_0_0_0_3px_white]"
                        : "border-slate-400 bg-white"
                    }`}
                  />
                  {t(`settings.${value}` as TranslationKey)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {!BRANDING.showDeveloperArtwork && accountPreferences.accountScoped ? t("settings.accountPreference") : t("settings.browserOnly")}
        </p>
      </section>
      <section className="mt-4 border border-slate-300 bg-white p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {t("settings.appearance")}
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-950">
          {t("settings.displaySize")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("settings.displayDescription")}
        </p>
        <div
          className="mt-4 grid gap-2 sm:grid-cols-3"
          role="radiogroup"
          aria-label={t("settings.displaySize")}
        >
          {DISPLAY_SIZE_OPTIONS.map((option) => {
            const selected = displaySize === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => changeDisplaySize(option.value)}
                className={`min-h-20 border p-3 text-left transition ${
                  selected
                    ? "border-blue-700 bg-blue-50 shadow-[inset_0_0_0_1px_#1d4ed8]"
                    : "border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2 font-bold text-slate-950">
                  <span
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 rounded-full border ${
                      selected
                        ? "border-blue-700 bg-blue-700 shadow-[inset_0_0_0_3px_white]"
                        : "border-slate-400 bg-white"
                    }`}
                  />
                  {t(`settings.${option.value}` as TranslationKey)}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                  {t(`settings.${option.value}Description` as TranslationKey)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {accountPreferences.accountScoped ? t("settings.accountPreference") : t("settings.browserOnly")}
        </p>
      </section>
      <section className="mt-4 border border-slate-300 bg-white p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          {t("settings.appearance")}
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-950">
          {t("settings.language")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("settings.languageDescription")}
        </p>
        <div
          className="mt-4 grid max-w-lg gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label={t("settings.language")}
        >
          {([
            ["en", "settings.english"],
            ["es", "settings.spanish"],
          ] as const).map(([value, labelKey]) => {
            const selected = language === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setLanguage(value)}
                className={`min-h-14 border p-3 text-left transition ${
                  selected
                    ? "border-blue-700 bg-blue-50 shadow-[inset_0_0_0_1px_#1d4ed8]"
                    : "border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2 font-bold text-slate-950">
                  <span
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 rounded-full border ${
                      selected
                        ? "border-blue-700 bg-blue-700 shadow-[inset_0_0_0_3px_white]"
                        : "border-slate-400 bg-white"
                    }`}
                  />
                  {t(labelKey)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {accountPreferences.accountScoped ? t("settings.accountPreference") : t("settings.browserOnly")}
        </p>
      </section>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {settings.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="border border-slate-300 bg-white p-4 transition hover:border-slate-500 hover:bg-slate-50"
          >
            <div className="font-bold text-slate-950">{t(item.titleKey)}</div>
            <div className="mt-1 text-sm text-slate-600">
              {t(item.descriptionKey)}
            </div>
          </Link>
        ))}
      </div>
      {planningEnabled && <PhaseLibraryManager />}
      <AdminSettingsPanel />
    </div>
  );
}
