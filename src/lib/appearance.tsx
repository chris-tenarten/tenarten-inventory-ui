"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useAccountPreferences } from "@/lib/account-preferences";

export const APPEARANCE_STORAGE_KEY = "tenops_appearance";
export const APPEARANCES = ["light", "dark"] as const;
export type Appearance = (typeof APPEARANCES)[number];

type AppearanceContextValue = {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function isAppearance(value: unknown): value is Appearance {
  return APPEARANCES.includes(value as Appearance);
}

function applyAppearance(appearance: Appearance) {
  document.documentElement.dataset.appearance = appearance;
}

export function ThemeProvider({
  children,
  defaultAppearance = "light",
}: {
  children: ReactNode;
  defaultAppearance?: Appearance;
}) {
  const accountPreferences = useAccountPreferences();
  const [appearance, setAppearanceState] = useState<Appearance>(defaultAppearance);

  useLayoutEffect(() => {
    // Keep the already-painted login Appearance while an authenticated
    // account's canonical preference is resolving. Applying the TenDev default
    // in this gap causes a light Hero to flash dark during sign-in.
    if (accountPreferences.accountScoped && !accountPreferences.ready) return;
    const accountAppearance = accountPreferences.preferences.appearance;
    const initial = accountPreferences.accountScoped
      ? (isAppearance(accountAppearance) ? accountAppearance : defaultAppearance)
      : isAppearance(document.documentElement.dataset.appearance)
        ? document.documentElement.dataset.appearance
        : defaultAppearance;
    applyAppearance(initial);
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, initial);
    } catch {
      // Appearance still applies when browser storage is unavailable.
    }
    const timeout = window.setTimeout(() => setAppearanceState(initial), 0);

    function syncAppearance(event: StorageEvent) {
      if (accountPreferences.accountScoped || event.key !== APPEARANCE_STORAGE_KEY) return;
      const next = isAppearance(event.newValue) ? event.newValue : defaultAppearance;
      setAppearanceState(next);
      applyAppearance(next);
    }

    window.addEventListener("storage", syncAppearance);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("storage", syncAppearance);
    };
  }, [accountPreferences.accountScoped, accountPreferences.preferences.appearance, accountPreferences.ready, defaultAppearance]);

  const setAppearance = useCallback((next: Appearance) => {
    setAppearanceState(next);
    applyAppearance(next);
    try {
      // Retain the last-used visual mode for the next pre-authentication paint.
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    } catch {
      // Appearance still applies for the current page when storage is unavailable.
    }
    if (accountPreferences.accountScoped) {
      void accountPreferences.setPreference("appearance", next);
      return;
    }
  }, [accountPreferences]);

  const value = useMemo(
    () => ({ appearance, setAppearance }),
    [appearance, setAppearance],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used within ThemeProvider.");
  return context;
}
