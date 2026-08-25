"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { operationalFirstName } from "@/lib/identity-presentation";
import { ROLE_LABELS } from "@/lib/rbac";

const CUTOVER_NOTICE_KEY = "tenops-account-cutover-notice-dismissed";

export default function AccountAccessPanel({
  onAuthenticated,
  showEyebrow = true,
  showCutoverNotice = false,
  separated = true,
}: {
  onAuthenticated(): void;
  showEyebrow?: boolean;
  showCutoverNotice?: boolean;
  separated?: boolean;
}) {
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "account-help" | "password">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [noticeVisible, setNoticeVisible] = useState(false);

  const activeMode = auth.requiresPasswordSetup ? "password" : mode;

  useEffect(() => {
    if (!showCutoverNotice) return;
    setNoticeVisible(window.sessionStorage.getItem(CUTOVER_NOTICE_KEY) !== "true");
  }, [showCutoverNotice]);

  useEffect(() => {
    if (!noticeVisible) return;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissNotice();
    };
    window.addEventListener("keydown", dismissOnEscape);
    return () => window.removeEventListener("keydown", dismissOnEscape);
  }, [noticeVisible]);

  function dismissNotice() {
    window.sessionStorage.setItem(CUTOVER_NOTICE_KEY, "true");
    setNoticeVisible(false);
  }

  async function signOutAccount() {
    setSaving(true);
    setError("");
    try {
      await auth.signOut();
      setMessage("Signed out of your TenOps account.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign out of the account.");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (activeMode === "signin") {
        window.dispatchEvent(new Event("tenops:prepare-hero-boot"));
        try {
          await auth.signIn(email, password);
        } catch (cause) {
          window.dispatchEvent(new Event("tenops:cancel-hero-boot"));
          throw cause;
        }
        onAuthenticated();
      } else {
        if (password.length < 10) throw new Error("Use at least 10 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        await auth.updatePassword(password);
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
        setMessage("Password updated. Sign in to continue to TenOps.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete account access.");
    } finally {
      setSaving(false);
    }
  }

  async function requestAccountEmail(kind: "setup" | "recovery") {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (kind === "setup") await auth.requestAccountSetup(email);
      else await auth.requestPasswordReset(email);
      setMessage("If that email has a TenOps account, we've sent account instructions.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send account instructions.");
    } finally {
      setSaving(false);
    }
  }

  if (auth.isAuthenticated && !auth.requiresPasswordSetup) {
    return (
      <div className={separated ? "mt-5 border-t border-slate-300 pt-5" : ""}>
        {showEyebrow ? <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">TenOps account access</div> : null}
        <div className="mt-3 font-bold text-slate-950">{operationalFirstName(auth.profile?.displayName) || auth.user?.email || "Authenticated TenOps account"}</div>
        {auth.user?.email ? <div className="mt-1 text-xs text-slate-600">{auth.user.email}</div> : null}
        {auth.profile ? <div className="mt-2 text-xs text-slate-600">Role: <strong>{ROLE_LABELS[auth.profile.role]}</strong> · {auth.profile.isActive ? "Active" : "Inactive"}</div> : null}
        {!auth.profile && auth.profileError ? <div role="alert" className="mt-2 text-xs font-semibold text-red-700">{auth.profileError}</div> : null}
        {error ? <div role="alert" className="mt-3 text-xs font-semibold text-red-700">{error}</div> : null}
        {message ? <div role="status" className="mt-3 text-xs font-semibold text-emerald-800">{message}</div> : null}
        <button type="button" disabled={saving} onClick={() => void signOutAccount()} className="mt-3 h-9 border border-slate-400 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50">{saving ? "Working…" : "Sign out of account"}</button>
      </div>
    );
  }

  return (
    <div className={separated ? "mt-5 border-t border-slate-300 pt-5" : ""}>
      {noticeVisible ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" aria-labelledby="tenops-cutover-notice-title" className="relative w-full max-w-md border border-slate-400 bg-white p-5 text-left text-slate-800 shadow-[0_24px_70px_rgba(15,23,42,0.35)] sm:p-6">
            <button type="button" aria-label="Dismiss account sign-in notice" title="Close" onClick={dismissNotice} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center text-xl leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-blue-600">×</button>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Account access</div>
            <h2 id="tenops-cutover-notice-title" className="mt-1 pr-8 text-lg font-bold text-slate-950">TenOps account sign-in is changing</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
              <p>TenOps now uses individual account sign-in and role-based access.</p>
              <p>If you&apos;ve already set up your account, close this message and sign in normally.</p>
              <p>If you haven&apos;t set your password yet, choose <strong>Set up account</strong> on this screen and we&apos;ll send you a fresh account setup email.</p>
              <p>If you&apos;ve already used TenOps but forgot your password, choose <strong>Reset password</strong>.</p>
            </div>
            <div className="mt-4 border-t border-slate-300 pt-3 text-xs font-semibold text-slate-600">The legacy TenOps access method has been disabled.</div>
            <div className="mt-4 flex justify-end">
              <button type="button" autoFocus onClick={dismissNotice} className="h-9 border border-slate-950 bg-slate-900 px-4 text-xs font-bold text-white transition hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-blue-600">Got it</button>
            </div>
          </div>
        </div>
      ) : null}
      {showEyebrow ? <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        TenOps account access
      </div> : null}
      {activeMode !== "password" ? (
        <label className="mt-3 block text-xs font-bold text-slate-700">
          Email
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-10 w-full border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-blue-600" />
        </label>
      ) : null}
      {activeMode !== "account-help" ? (
        <label className="mt-3 block text-xs font-bold text-slate-700">
          {activeMode === "password" ? "New password" : "Password"}
          <input type="password" autoComplete={activeMode === "password" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && activeMode !== "password") void submit(); }} className="mt-1 h-10 w-full border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none focus:ring-2 focus-visible:ring-blue-600" />
        </label>
      ) : null}
      {activeMode === "password" ? <label className="mt-3 block text-xs font-bold text-slate-700">
        Confirm new password
        <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} className="mt-1 h-10 w-full border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none focus:ring-2 focus-visible:ring-blue-600" />
      </label> : null}
      {error ? <div role="alert" className="mt-3 text-xs font-semibold text-red-700">{error}</div> : null}
      {message ? <div role="status" className="mt-3 text-xs font-semibold text-emerald-800">{message}</div> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {activeMode === "account-help" ? (
          <div className="grid w-full gap-3">
            <div className="border border-slate-300 bg-slate-50 p-3">
              <div className="text-xs font-bold text-slate-950">Set up account</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">Use this if you have a TenOps account but haven&apos;t set your password yet.</p>
              <button type="button" disabled={saving || !email.trim()} onClick={() => void requestAccountEmail("setup")} className="mt-2 h-9 border border-slate-950 bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50">{saving ? "Working…" : "Set up account"}</button>
            </div>
            <div className="border border-slate-300 bg-slate-50 p-3">
              <div className="text-xs font-bold text-slate-950">Reset password</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">Use this if you previously signed in but need a new password.</p>
              <button type="button" disabled={saving || !email.trim()} onClick={() => void requestAccountEmail("recovery")} className="mt-2 h-9 border border-slate-400 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50">Reset password</button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={saving || (activeMode !== "password" && !email.trim()) || !password || (activeMode === "password" && !confirmPassword)} onClick={() => void submit()} className="h-9 border border-slate-950 bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50">
            {saving ? "Working…" : activeMode === "signin" ? "Sign in" : "Set password"}
          </button>
        )}
        {activeMode !== "password" ? <button type="button" onClick={() => { setMode(mode === "account-help" ? "signin" : "account-help"); setError(""); setMessage(""); }} className="min-h-9 px-2 text-xs font-bold text-slate-600 underline focus-visible:ring-2 focus-visible:ring-blue-600">{mode === "account-help" ? "Back to sign in" : "Need to set or reset your password?"}</button> : null}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-500">Sign in with your individual TenOps account to continue.</p>
    </div>
  );
}
