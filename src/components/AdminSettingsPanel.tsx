"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { APP_ROLES, CAPABILITIES, CAPABILITY_LABELS, type AppRole, ROLE_CAPABILITIES, ROLE_LABELS } from "@/lib/rbac";

type AdminUser = { user_id: string; display_name: string; email: string; role: AppRole; is_active: boolean };

async function adminFunctionErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json() as {
        error?: string | { message?: string };
      };
      if (typeof payload.error === "string") return payload.error;
      if (payload.error?.message) return payload.error.message;
    } catch {
      // Use the safe generic fallback below when the function response is not JSON.
    }
    return "The user administration service could not complete the request.";
  }
  return error instanceof Error ? error.message : "Admin action failed.";
}

export default function AdminSettingsPanel() {
  const auth = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState({ displayName: "", email: "", role: "member" as AppRole });
  const canManageUsers = auth.isAuthenticated && Boolean(auth.profile?.isActive) && auth.can("manageUsers");

  const request = useCallback(async (options?: RequestInit) => {
    const token = auth.session?.access_token;
    if (!token) throw new Error("Sign in with an Admin account to manage access.");
    const body = options?.body ? JSON.parse(String(options.body)) : { action: "list" };
    const { data, error } = await supabase.functions.invoke("admin-manage-users", {
      body,
      headers: { authorization: `Bearer ${token}` },
    });
    if (error) throw new Error(await adminFunctionErrorMessage(error));
    if (typeof data?.error === "string") throw new Error(data.error);
    if (data?.error?.message) throw new Error(data.error.message);
    return data;
  }, [auth.session?.access_token]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const payload = await request(); setUsers(payload.users ?? []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load users."); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { if (canManageUsers) void load(); }, [canManageUsers, load]);
  if (!canManageUsers) return null;

  async function action(body: Record<string, unknown>, success: string) {
    setLoading(true); setError(""); setMessage("");
    try { await request({ method: "POST", body: JSON.stringify(body) }); setMessage(success); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Admin action failed."); setLoading(false); }
  }

  return <section id="admin" className="mt-6 border border-slate-300 bg-white p-4">
    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Admin</div>
    <h2 className="mt-1 text-xl font-bold text-slate-950">Users &amp; Access</h2>
    <p className="mt-1 text-sm text-slate-600">Invite authenticated users and manage their system-defined TenOps role. Passwords are never visible to an Admin.</p>
    {error ? <div role="alert" className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</div> : null}
    {message ? <div role="status" className="mt-3 border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</div> : null}
    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1.25fr_0.8fr_auto]">
      <input aria-label="Invite display name" placeholder="Display name" value={invite.displayName} onChange={(event) => setInvite((current) => ({ ...current, displayName: event.target.value }))} className="h-10 border border-slate-300 px-2 text-sm" />
      <input aria-label="Invite email" type="email" placeholder="Email" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} className="h-10 border border-slate-300 px-2 text-sm" />
      <select aria-label="Invite role" value={invite.role} onChange={(event) => setInvite((current) => ({ ...current, role: event.target.value as AppRole }))} className="h-10 border border-slate-300 px-2 text-sm">{APP_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select>
      <button disabled={loading || !invite.displayName.trim() || !invite.email.trim()} onClick={() => void action({ action: "invite", ...invite }, "Invitation sent.")} className="tenops-selected-surface h-10 border px-3 text-xs font-bold disabled:opacity-50">Invite user</button>
    </div>
    <div className="mt-4 divide-y divide-slate-200 border border-slate-200">
      {users.map((user) => <div key={user.user_id} className="grid gap-2 p-3 sm:grid-cols-[1fr_1.25fr_0.8fr_auto_auto] sm:items-center">
        <input aria-label={`Display name for ${user.email}`} value={user.display_name} onChange={(event) => setUsers((current) => current.map((item) => item.user_id === user.user_id ? { ...item, display_name: event.target.value } : item))} className="h-9 border border-slate-300 px-2 text-sm" />
        <span className="truncate text-xs text-slate-600">{user.email}</span>
        <select aria-label={`Role for ${user.display_name}`} value={user.role} onChange={(event) => setUsers((current) => current.map((item) => item.user_id === user.user_id ? { ...item, role: event.target.value as AppRole } : item))} className="h-9 border border-slate-300 px-2 text-xs">{APP_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select>
        <label className="inline-flex items-center gap-1.5 text-xs font-bold"><input type="checkbox" checked={user.is_active} onChange={(event) => setUsers((current) => current.map((item) => item.user_id === user.user_id ? { ...item, is_active: event.target.checked } : item))} />Active</label>
        <div className="flex gap-1"><button disabled={loading} onClick={() => void action({ action: "update", userId: user.user_id, displayName: user.display_name, role: user.role, isActive: user.is_active }, "User access updated.")} className="h-8 border border-slate-400 px-2 text-[10px] font-bold">Save</button><button disabled={loading} onClick={() => void action({ action: "reset", email: user.email }, "Password reset email requested.")} className="h-8 border border-slate-300 px-2 text-[10px] font-bold">Reset</button></div>
      </div>)}
      {!loading && !users.length ? <div className="p-3 text-sm text-slate-500">No application users are configured.</div> : null}
    </div>
    <h2 className="mt-6 text-xl font-bold text-slate-950">Roles &amp; Permissions</h2>
    <p className="mt-1 text-sm text-slate-600">System-defined bundles are read-only in the MVP. Custom roles and dynamic permission editing are deferred.</p>
    <div className="mt-4 overflow-x-auto border border-slate-200"><table className="min-w-[760px] w-full border-collapse text-xs"><thead><tr className="bg-slate-100"><th className="p-2 text-left">Capability</th>{APP_ROLES.map((role) => <th key={role} className="p-2 text-center">{ROLE_LABELS[role]}</th>)}</tr></thead><tbody>{CAPABILITIES.map((capability) => <tr key={capability} className="border-t border-slate-200"><td className="p-2 font-semibold">{CAPABILITY_LABELS[capability]}</td>{APP_ROLES.map((role) => <td key={role} className="p-2 text-center">{ROLE_CAPABILITIES[role].includes(capability) ? "✓" : "—"}</td>)}</tr>)}</tbody></table></div>
  </section>;
}
