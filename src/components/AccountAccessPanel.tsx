"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/rbac";

export default function AccountAccessPanel({ onAuthenticated, showEyebrow = true }: { onAuthenticated(): void; showEyebrow?: boolean }) {
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "forgot" | "password">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const activeMode = auth.requiresPasswordSetup ? "password" : mode;

  async function signOutAccount() {
    setSaving(true);
    setError("");
    try {
      await auth.signOut();
      setMessage("Signed out of your TenOps account. Internal Access remains available.");
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
        await auth.signIn(email, password);
        onAuthenticated();
      } else if (activeMode === "forgot") {
        await auth.requestPasswordReset(email);
        setMessage("If this account exists, Supabase will send a secure password-reset email.");
      } else {
        if (password.length < 10) throw new Error("Use at least 10 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        await auth.updatePassword(password);
        setMessage("Password updated. You can continue to TenOps.");
        onAuthenticated();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete account access.");
    } finally {
      setSaving(false);
    }
  }

  if (auth.isAuthenticated && !auth.requiresPasswordSetup) {
    return (
      <div className="mt-5 border-t border-slate-300 pt-5">
        {showEyebrow ? <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">TenOps account access</div> : null}
        <div className="mt-3 font-bold text-slate-950">{auth.profile?.displayName || auth.user?.email || "Authenticated TenOps account"}</div>
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
    <div className="mt-5 border-t border-slate-300 pt-5">
      {showEyebrow ? <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        TenOps account access
      </div> : null}
      {activeMode !== "password" ? (
        <label className="mt-3 block text-xs font-bold text-slate-700">
          Email
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-10 w-full border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-blue-600" />
        </label>
      ) : null}
      {activeMode !== "forgot" ? (
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
        <button type="button" disabled={saving || (activeMode !== "password" && !email.trim()) || (activeMode !== "forgot" && !password) || (activeMode === "password" && !confirmPassword)} onClick={() => void submit()} className="h-9 border border-slate-950 bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50">
          {saving ? "Working…" : activeMode === "signin" ? "Sign in" : activeMode === "forgot" ? "Send reset email" : "Set password"}
        </button>
        {activeMode !== "password" ? <button type="button" onClick={() => { setMode(mode === "forgot" ? "signin" : "forgot"); setError(""); setMessage(""); }} className="h-9 px-2 text-xs font-bold text-slate-600 underline focus-visible:ring-2 focus-visible:ring-blue-600">{mode === "forgot" ? "Back to sign in" : "Forgot password?"}</button> : null}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-500">Account access is additive during the RBAC compatibility period. Internal Access remains available until the authorized cutover.</p>
    </div>
  );
}
