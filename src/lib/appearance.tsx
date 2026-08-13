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
  const [appearance, setAppearanceState] = useState<Appearance>(defaultAppearance);

  useLayoutEffect(() => {
    const initial = isAppearance(document.documentElement.dataset.appearance)
      ? document.documentElement.dataset.appearance
      : defaultAppearance;
    applyAppearance(initial);
    const timeout = window.setTimeout(() => setAppearanceState(initial), 0);

    function syncAppearance(event: StorageEvent) {
      if (event.key !== APPEARANCE_STORAGE_KEY) return;
      const next = isAppearance(event.newValue) ? event.newValue : defaultAppearance;
      setAppearanceState(next);
      applyAppearance(next);
    }

    window.addEventListener("storage", syncAppearance);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("storage", syncAppearance);
    };
  }, [defaultAppearance]);

  const setAppearance = useCallback((next: Appearance) => {
    setAppearanceState(next);
    applyAppearance(next);
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    } catch {
      // Appearance still applies for the current page when storage is unavailable.
    }
  }, []);

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
