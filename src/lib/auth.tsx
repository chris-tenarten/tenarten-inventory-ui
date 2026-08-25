"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BRANDING } from "@/lib/dev-branding.mjs";
import {
  type AppRole,
  type Capability,
  isAppRole,
  RBAC_MODE,
  roleHasCapability,
} from "@/lib/rbac";

export type AppUserProfile = {
  userId: string;
  displayName: string;
  role: AppRole;
  isActive: boolean;
};

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: AppUserProfile | null;
  profileError: string;
  requiresPasswordSetup: boolean;
  isAuthenticated: boolean;
  accessAllowed: boolean;
  can(capability: Capability): boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestAccountSetup(email: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  refreshProfile(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeProfile(value: unknown): AppUserProfile | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const source = row as Record<string, unknown>;
  const role = source.role;
  if (!isAppRole(role) || typeof source.user_id !== "string") return null;
  return {
    userId: source.user_id,
    displayName: typeof source.display_name === "string" ? source.display_name : "TenOps user",
    role,
    isActive: source.is_active === true,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    if (!nextSession) {
      setProfile(null);
      setProfileError("");
      return;
    }
    const { data, error } = await supabase.rpc("get_my_app_user");
    if (error) {
      setProfile(null);
      setProfileError(
        RBAC_MODE === "compatibility"
          ? "Account profile infrastructure is not available in this environment yet."
          : error.message,
      );
      return;
    }
    const nextProfile = normalizeProfile(data);
    setProfile(nextProfile);
    setProfileError("");
    if (nextProfile?.isActive) {
      const { error: welcomeError } = await supabase.rpc("ensure_my_welcome_notification");
      if (!welcomeError) window.dispatchEvent(new Event("tenops:notifications-changed"));
    }
  }, []);

  useEffect(() => {
    let live = true;
    let authChangeProfileTimer: number | null = null;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!live) return;
      const accountFlow = new URLSearchParams(window.location.search).get("account");
      setRequiresPasswordSetup((accountFlow === "setup" || accountFlow === "recovery") && Boolean(data.session));
      setSession(data.session);
      await loadProfile(data.session);
      if (live) setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const accountFlow = new URLSearchParams(window.location.search).get("account");
      const callbackFlow = accountFlow === "setup" || accountFlow === "recovery";
      setRequiresPasswordSetup(Boolean(nextSession) && (event === "PASSWORD_RECOVERY" || callbackFlow));
      setSession(nextSession);
      // Supabase holds its auth-token lock while this callback runs. Starting
      // an authenticated RPC here can contend with that lock for five seconds.
      if (authChangeProfileTimer !== null) window.clearTimeout(authChangeProfileTimer);
      authChangeProfileTimer = window.setTimeout(() => {
        if (live) void loadProfile(nextSession);
      }, 0);
      setReady(true);
    });
    return () => {
      live = false;
      if (authChangeProfileTimer !== null) window.clearTimeout(authChangeProfileTimer);
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => loadProfile(session), [loadProfile, session]);
  const can = useCallback((capability: Capability) => {
    if (!session) return RBAC_MODE === "compatibility";
    if (!profile?.isActive) return false;
    return roleHasCapability(profile.role, capability);
  }, [profile, session]);

  const value = useMemo<AuthContextValue>(() => ({
    ready,
    session,
    user: session?.user ?? null,
    profile,
    profileError,
    requiresPasswordSetup,
    isAuthenticated: Boolean(session),
    accessAllowed:
      RBAC_MODE === "compatibility"
        ? true
        : Boolean(profile?.isActive && (!BRANDING.showDeveloperArtwork || roleHasCapability(profile.role, "accessDevelopmentEnvironment"))),
    can,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    async requestAccountSetup(email) {
      const emailRedirectTo = `${window.location.origin}/?account=setup`;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo },
      });
      if (error) throw error;
    },
    async requestPasswordReset(email) {
      const redirectTo = `${window.location.origin}/?account=recovery`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
    },
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      setRequiresPasswordSetup(false);
      window.history.replaceState({}, "", window.location.pathname);
    },
    refreshProfile,
  }), [can, profile, profileError, ready, refreshProfile, requiresPasswordSetup, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
