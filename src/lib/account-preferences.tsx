"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export type AccountPreferences = {
  appearance?: "light" | "dark";
  language?: "en" | "es";
  display_size?: "compact" | "default" | "large";
  production_view?: "overview" | "table" | "timeline";
  production_arrangement?: "stage" | "deadline" | "labor";
  timeline_zoom?: "days" | "weeks" | "months" | "year";
  timeline_row_density?: "compact" | "standard" | "comfortable";
  production_table_hidden_columns?: string[];
  collapsed_phase_display?: "compact" | "fill";
  transmittal_sender?: { name: string; phone: string; email: string };
};

export type AccountPreferenceKey = keyof AccountPreferences;

type AccountPreferencesContextValue = {
  accountScoped: boolean;
  ready: boolean;
  preferences: AccountPreferences;
  error: string;
  setPreference<K extends AccountPreferenceKey>(key: K, value: NonNullable<AccountPreferences[K]>): Promise<void>;
};

const AccountPreferencesContext = createContext<AccountPreferencesContextValue | null>(null);

function normalizePreferences(value: unknown): AccountPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AccountPreferences;
}

export function AccountPreferencesProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const sessionUserId = auth.user?.id ?? null;
  const accountUserId = auth.isAuthenticated
    && auth.profile?.isActive
    && auth.profile.userId === sessionUserId
    ? sessionUserId
    : null;
  const accountScoped = !auth.ready || auth.isAuthenticated;
  const [loaded, setLoaded] = useState<{ userId: string | null; preferences: AccountPreferences; error: string }>({
    userId: null,
    preferences: {},
    error: "",
  });

  useEffect(() => {
    let active = true;
    if (!accountUserId) return () => { active = false; };

    void supabase.rpc("get_my_account_preferences").then(({ data, error: loadError }) => {
      if (!active) return;
      setLoaded({
        userId: accountUserId,
        preferences: loadError ? {} : normalizePreferences(data),
        error: loadError ? "Account preferences could not be loaded. TenOps defaults are active." : "",
      });
    });
    return () => { active = false; };
  }, [accountUserId]);

  const setPreference = useCallback(async <K extends AccountPreferenceKey>(
    key: K,
    value: NonNullable<AccountPreferences[K]>,
  ) => {
    if (!accountUserId) return;
    setLoaded((current) => ({
      userId: accountUserId,
      preferences: { ...(current.userId === accountUserId ? current.preferences : {}), [key]: value },
      error: "",
    }));
    const { data, error: saveError } = await supabase.rpc("set_my_account_preference", {
      p_key: key,
      p_value: value,
    });
    if (saveError) {
      setLoaded((current) => current.userId === accountUserId
        ? { ...current, error: "That account preference could not be saved. The current page remains usable." }
        : current);
      return;
    }
    setLoaded((current) => ({
      userId: accountUserId,
      preferences: {
        ...(current.userId === accountUserId ? current.preferences : {}),
        ...normalizePreferences(data),
      },
      error: "",
    }));
  }, [accountUserId]);

  const value = useMemo<AccountPreferencesContextValue>(() => ({
    accountScoped,
    ready: !accountScoped || Boolean(accountUserId && loaded.userId === accountUserId),
    preferences: loaded.userId === accountUserId ? loaded.preferences : {},
    error: loaded.userId === accountUserId ? loaded.error : "",
    setPreference,
  }), [accountScoped, accountUserId, loaded, setPreference]);

  return <AccountPreferencesContext.Provider value={value}>{children}</AccountPreferencesContext.Provider>;
}

export function useAccountPreferences() {
  const value = useContext(AccountPreferencesContext);
  if (!value) throw new Error("useAccountPreferences must be used within AccountPreferencesProvider");
  return value;
}
