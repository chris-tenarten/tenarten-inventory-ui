"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BRANDING } from "@/lib/dev-branding.mjs";
import {
  type AppRole,
  type Capability,
  isAppRole,
  RBAC_MODE,
  roleHasCapability,
  accountHasCapability,
  READ_CAPABILITIES,
} from "@/lib/rbac";

export type AppUserProfile = {
  userId: string;
  displayName: string;
  role: AppRole;
  isActive: boolean;
  readOnly: boolean;
  messagingWrite: boolean;
  productionBlendManage: boolean;
  sampleLabelsGenerate: boolean;
};

export type AccountAccessStatus = "pending" | "allowed" | "denied" | "failed";

type AuthContextValue = {
  accessStatus: AccountAccessStatus;
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
    readOnly: source.read_only === true,
    messagingWrite: source.messaging_write === true,
    productionBlendManage: source.production_blend_manage === true,
    sampleLabelsGenerate: source.sample_labels_generate === true,
  };
}

// Supabase's JWT session_id identifies a login across access-token rotation.
// This is only a continuity discriminator; the current profile RPC remains the
// authority. Missing/unreadable claims never carry access to a different token.
function sameAuthSession(previous: Session | null, next: Session | null): boolean {
  if (!previous || !next || previous.user.id !== next.user.id) return false;
  if (previous.access_token && previous.access_token === next.access_token) return true;
  const identity = (session: Session): string | null => {
    try {
      const payload = JSON.parse(atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload.sub === session.user.id && typeof payload.session_id === "string" && payload.session_id.length > 0 ? payload.session_id : null;
    } catch { return null; }
  };
  const previousId = identity(previous);
  return previousId !== null && previousId === identity(next);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);

  const [accessStatus, setAccessStatus] = useState<AccountAccessStatus>("pending");
  const currentSession = useRef<Session | null>(null);
  const verifiedSession = useRef<Session | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);

  const loadProfile = useCallback(async (nextSession: Session, request: number) => {
    const current = () => mounted.current && generation.current === request && currentSession.current === nextSession;
    if (!current()) return;
    try {
      const { data, error } = await supabase.rpc("get_my_app_access");
      if (!current()) return;
      if (error) throw error;
      const nextProfile = normalizeProfile(data);
      if (nextProfile && nextProfile.userId !== nextSession.user.id) {
        throw new Error("The returned account profile does not match the authenticated account.");
      }
      const allowed = Boolean(nextProfile?.isActive && (RBAC_MODE === "compatibility" || !BRANDING.showDeveloperArtwork || roleHasCapability(nextProfile.role, "accessDevelopmentEnvironment")));
      verifiedSession.current = allowed ? nextSession : null;
      setProfile(nextProfile);
      setProfileError("");
      setAccessStatus(allowed ? "allowed" : "denied");
      if (allowed && nextProfile && !nextProfile.readOnly && current()) {
        // Notification failure is independent of account-access verification.
        try {
          const { error: welcomeError } = await supabase.rpc("ensure_my_welcome_notification");
          if (current() && !welcomeError) window.dispatchEvent(new Event("tenops:notifications-changed"));
        } catch { /* Keep the successfully verified access decision. */ }
      }
    } catch (cause) {
      if (!current()) return;
      verifiedSession.current = null;
      setProfile(null);
      const detail = cause && typeof cause === "object" && "message" in cause && typeof cause.message === "string" ? cause.message : "Please refresh and retry.";
      setProfileError(`Unable to verify your TenOps account access. ${detail}`);
      setAccessStatus("failed");
    }
  }, []);

  // Invalidate old requests immediately, before deferring any authenticated RPC.
  const beginResolution = useCallback((nextSession: Session | null, continuing = false) => {
    const request = ++generation.current;
    currentSession.current = nextSession;
    setSession(nextSession);
    if (!continuing) {
      verifiedSession.current = null;
      setProfile(null);
      setProfileError("");
      setAccessStatus(nextSession ? "pending" : "denied");
    }
    setReady(true);
    return request;
  }, []);

  useEffect(() => {
    mounted.current = true;
    let initialAuthSnapshotReceived = false;
    let authChangeProfileTimer: number | null = null;
    const bootstrap = generation.current;
    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted.current || generation.current !== bootstrap) return;
      if (error) throw error;
      const accountFlow = new URLSearchParams(window.location.search).get("account");
      setRequiresPasswordSetup((accountFlow === "setup" || accountFlow === "recovery") && Boolean(data.session));
      const request = beginResolution(data.session);
      if (data.session) await loadProfile(data.session, request);
    }).catch(() => {
      if (!mounted.current || generation.current !== bootstrap) return;
      setProfile(null);
      setProfileError("Unable to restore your TenOps session. Please refresh and retry.");
      setAccessStatus("failed");
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "INITIAL_SESSION") { initialAuthSnapshotReceived = true; return; }
      // Deduplicate only an already accepted bootstrap snapshot. A different
      // identity/session event must invalidate bootstrap even before INITIAL_SESSION.
      if (event === "SIGNED_IN" && !initialAuthSnapshotReceived && currentSession.current?.user.id === nextSession?.user.id && currentSession.current?.access_token === nextSession?.access_token) return;
      const accountFlow = new URLSearchParams(window.location.search).get("account");
      const callbackFlow = accountFlow === "setup" || accountFlow === "recovery";
      setRequiresPasswordSetup(Boolean(nextSession) && (event === "PASSWORD_RECOVERY" || callbackFlow));
      const continuing = !callbackFlow && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && sameAuthSession(verifiedSession.current, nextSession);
      const request = beginResolution(nextSession, continuing);
      // Supabase holds its auth-token lock while this callback runs.
      if (authChangeProfileTimer !== null) window.clearTimeout(authChangeProfileTimer);
      authChangeProfileTimer = window.setTimeout(() => {
        if (nextSession) void loadProfile(nextSession, request);
      }, 0);
    });
    return () => {
      mounted.current = false;
      // This is a generation counter, not a DOM ref: invalidate all current work.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      if (authChangeProfileTimer !== null) window.clearTimeout(authChangeProfileTimer);
      data.subscription.unsubscribe();
    };
  }, [beginResolution, loadProfile]);

  const refreshProfile = useCallback(async () => {
    const nextSession = currentSession.current;
    // Keep this callback stable across continued-session events, otherwise
    // Samples' mount/revalidation effect runs again on every refocus/rotation.
    const request = sameAuthSession(verifiedSession.current, nextSession)
      ? ++generation.current
      : beginResolution(nextSession);
    if (nextSession) await loadProfile(nextSession, request);
  }, [beginResolution, loadProfile]);
  const can = useCallback((capability: Capability) => {
    if (!session) return RBAC_MODE === "compatibility" && READ_CAPABILITIES.includes(capability);
    if (accessStatus !== "allowed" || !profile?.isActive || profile.userId !== session.user.id) return false;
    return accountHasCapability(profile.role, capability, profile.readOnly, profile.messagingWrite, profile.productionBlendManage, profile.sampleLabelsGenerate);
  }, [accessStatus, profile, session]);

  const value = useMemo<AuthContextValue>(() => ({
    ready,
    accessStatus,
    session,
    user: session?.user ?? null,
    profile,
    profileError,
    requiresPasswordSetup,
    isAuthenticated: Boolean(session),
    accessAllowed: accessStatus === "allowed",
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
  }), [accessStatus, can, profile, profileError, ready, refreshProfile, requiresPasswordSetup, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
