"use client";

import { Bell, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS, type AppRole } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";

export type AccountNotification = {
  kind: "job_update";
  update_id: string;
  job_id: string;
  job_number: string | null;
  job_name: string;
  body: string;
  created_at: string;
};

type WelcomeNotification = {
  kind: "welcome";
  id: string;
  notification_type: string;
  title: string;
  body: string;
  metadata: { role?: AppRole };
  created_at: string;
};

type NotificationItem = AccountNotification | WelcomeNotification;

export default function AccountNotifications({ onOpen }: { onOpen(notification: AccountNotification): void }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!auth.isAuthenticated || !auth.profile?.isActive) { setItems([]); return; }
    const [updates, account] = await Promise.all([
      supabase.rpc("list_my_job_update_notifications"),
      supabase.rpc("list_my_account_notifications"),
    ]);
    const queryError = updates.error ?? account.error;
    if (queryError) { setError(queryError.message); return; }
    const updateItems = ((updates.data ?? []) as Omit<AccountNotification, "kind">[]).map((item) => ({ ...item, kind:"job_update" as const }));
    const accountItems = ((account.data ?? []) as Omit<WelcomeNotification, "kind">[]).map((item) => ({ ...item, kind:"welcome" as const }));
    setItems([...accountItems, ...updateItems].sort((left, right) => right.created_at.localeCompare(left.created_at))); setError("");
  }, [auth.isAuthenticated, auth.profile?.isActive]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("tenops:notifications-changed", refresh);
    return () => { window.clearTimeout(initialLoad); window.removeEventListener("focus", refresh); window.removeEventListener("tenops:notifications-changed", refresh); };
  }, [load]);

  if (!auth.isAuthenticated || !auth.profile?.isActive) return null;
  return <div className="relative shrink-0">
    <button
      type="button"
      onClick={() => setOpen((current) => !current)}
      aria-label="Notifications"
      title="Notifications"
      aria-expanded={open}
      aria-haspopup="dialog"
      className="relative inline-flex h-9 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-200/40 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:h-10 sm:w-10"
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {items.length ? <span aria-label={`${items.length} actionable notifications`} className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">{items.length}</span> : null}
    </button>
    {open ? <div role="dialog" aria-label="Notifications" className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] border border-slate-300 bg-white p-2 text-left shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-2 pb-2"><strong className="text-sm">Notifications</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close Notifications" className="inline-flex h-7 w-7 items-center justify-center hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      {error ? <div role="alert" className="p-2 text-xs font-semibold text-red-700">Unable to load Notifications.</div> : null}
      {!error && !items.length ? <div className="p-3 text-xs text-slate-500">Nothing currently requires your attention.</div> : null}
      {items.map((item) => item.kind === "job_update" ? <button key={`update-${item.update_id}`} type="button" onClick={() => { setOpen(false); onOpen(item); }} className="block w-full border-b border-slate-100 px-2 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none">
        <span className="block text-xs font-bold text-slate-950">{item.job_number ? `${item.job_number} · ` : ""}{item.job_name}</span>
        <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-slate-600">{item.body}</span>
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-red-700">Needs your resolution</span>
      </button> : <button key={`account-${item.id}`} type="button" onClick={async () => { const { error: readError } = await supabase.rpc("mark_my_account_notification_read", { p_notification_id:item.id }); if (readError) { setError(readError.message); return; } setItems((current) => current.filter((candidate) => candidate !== item)); }} className="block w-full border-b border-slate-100 px-2 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none">
        <span className="block text-xs font-bold text-slate-950">{item.title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-600">{item.body}</span>
        {item.metadata.role && ROLE_LABELS[item.metadata.role] ? <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700">Role: {ROLE_LABELS[item.metadata.role]}</span> : null}
      </button>)}
    </div> : null}
  </div>;
}
